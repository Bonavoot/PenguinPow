# PUMO PUMO — Fresh Netcode, Online Performance & Live Infrastructure Audit

Clean-room audit of the executable online path (no prior Markdown, comments, or git history used as evidence), a two-client measured baseline, a rollback feasibility proof on the real simulation, an architecture decision, and the first durable implementation phase with before/after verification.

All scratch material (harness, proxy, probes, raw captures, analyses) lives in `/tmp/pumo_net_audit/` and is referenced by name below. Nothing in this pass was committed, pushed, deployed, or purchased.

---

## UPDATE 2 — disconnect redesign, room-join fix, first-match smoothness, prediction/interpolation (protocol v3)

This section supersedes the disconnect and prediction parts of the original report where they conflict. The implementation is the deliverable; this is a summary.

### Problems reported by the developer, root-caused

1. **A disconnect left the match stuck with no way to continue/rejoin.** The old server marked the room `opponentDisconnected` and kept it that way; `getCleanedRoomsData` injected a fake `disconnected_placeholder` so the room read as *full and unjoinable*, and the client showed a 3-second exit overlay that fired `exit_disconnected_game`. If any step raced (or the survivor sat), the room stayed occupied-but-dead and the survivor had no clean path back. **Fix:** a single `abandonMatch()` path — the survivor is told (`match_abandoned`) and immediately re-seated as host of a pristine, joinable lobby; the leaver's session forgets the room; every client's room list is refreshed. There is no `opponentDisconnected` limbo state anymore.

2. **A second pair could not join/play another room once one room was full.** `join_room` was fire-and-forget: the client entered the lobby view optimistically off a possibly-stale room list, and seat changes were broadcast only to the room, not to browsing clients — so two players could both act on stale counts, and a client that "joined" a room it was not seated in got a Ready button that did nothing. **Fix:** `join_room` is now an **acked request** (`{ok,reason}`); the client enters the lobby only on `ok:true`; every seat change is broadcast to **all** clients (`io.emit("rooms", …)`); duplicate/again-full/already-seated joins are rejected with a reason shown in the browser.

3. **"Online is bad at the start, smooth after loading."** This was **not** the network — it was the renderer. A CPU profile of a real rendered match (`/tmp/pumo_net_audit/profile_dev_tab.json`) showed the opening seconds dominated by **sprite recolor on the main thread** (`recolorCore.processImageData` + `getImageData`/`toBlob`, seen as 1–2 s long-tasks) because the worker was disabled on Electron's `file://` origin, plus a steady **per-frame forced layout** from the camera loop and each balance gauge reading `offsetWidth`/`getBoundingClientRect` every frame (~26 s + ~9 s of main-thread time over a 165 s match). **Fix:** (a) recolor now runs the **whole** pipeline off-thread via an inline classic worker (ImageBitmap → OffscreenCanvas → PNG blob) that works on `file://`; (b) the camera reads a `ResizeObserver`-cached container size and the balance gauge observes instead of measuring per frame; (c) the bout does not start until **every** human has reported `pre_match_complete` (preload done), capped at `PREMATCH_READY_CAP_MS` so one slow client can't stall the match.

### Disconnect design (chosen, implemented)

The 15 s frozen hold was wrong for a 1v1 sumo bout. New model, differentiated by cause:

| Event | Behaviour |
|---|---|
| **Intentional leave** (Leave button / clean close) | immediate `abandonMatch("left")` → opponent wins by forfeit, re-seated as host; no hold |
| **Brief transport loss** (Wi-Fi blip) mid-bout | server **holds the bout ≤ 5 s** (`RECONNECT_GRACE_MS`), opponent sees "OPPONENT RECONNECTING"; the client auto-reconnects (fast retry) and resumes the SAME fighter via its session token |
| **Full disconnect** (grace lapses / dead peer) | `abandonMatch("disconnected")` → forfeit, survivor re-seated; dead-peer detection cut from **28.4 s → 6.2 s** via engine.io `pingInterval 2.5 s / pingTimeout 5 s` |
| **Server failure / can't resume** | `server_shutdown` or `reconnect_failed`/failed resume → client leaves to the menu with a message; never a frozen screen |
| **Future Basho** | per-room `reconnectGraceMs` hook already in `netSession.js` so a tournament coordinator can lengthen the window for scheduled matches without changing ranked play |

5 s is long enough to ride out a router hiccup but short enough that a real disconnect isn't a boring frozen wait. Every terminal path routes to the lobby or menu — proven by `test/net/session.test.js` and the rendered test below.

### Netcode quality (implemented + unit-proven)

- **Tick-anchored reconciliation** (`movementPredictor.onServerSnapshot`): the server echoes, per fighter, the last consumed input seq **and the sim time it was consumed** (`inputSeqAck` + `inputAckSimTime`), and every packet carries `simTime`. The client maps server-sim-time → local-wall-time through that ack and reconciles its prediction against the exact local moment — **no `now − rtt` guess**. Result (`movementPredictor.anchor.test.js`): anchored reconciliation error is ~0 median, ≤ one 64 Hz step p95, and **flat from 60→250 ms RTT**, versus the old heuristic that moved its lookup point with the (lagging, wrong) RTT estimate.
- **Server-clock jitter buffer for the remote fighter** (`net/snapshotInterpolator.js`): remote motion is played back on the server clock a small adaptive delay (~40 ms + measured jitter, ≤160 ms) behind the newest snapshot, interpolating between the two snapshots that bracket the playback time. Bunched/​stalled arrivals no longer speed up or reverse remote motion; it also freezes and resumes correctly with server hitstop. Unit test (`snapshotInterpolator.test.js`): constant-velocity render speed std drops >2× vs the old undelayed path under ±30 ms jitter; a 250 ms stall never reverses; teleports snap. The local fighter still renders undelayed (its X is predicted).
  - **Regression found in manual play and fixed:** when `push()` gained its server-time argument (`push(arrivalMs, serverT, x, y)`), the `GameFighter` call site was still passing the old three arguments, so `x` was read as server time, `y` as `x`, and `y` came out `undefined`. Symptoms: fighters drawn at wrong X, drifting on Y, facing the wrong way, camera following positions that were not where the sprites were, and `PlayerShadow`/`IceReflection`/`EdgeDangerEffect` "prop `y` is undefined" + `NaN opacity` console warnings. Fixed at the call site (`GameFighter.jsx`, now passes `shared.simTime`) and `push()` now rejects non-finite samples so a malformed packet can never poison the render timeline again. Re-verified in the rendered dev client against a headless opponent: debug anchors read `sim=(543,286) rend=(543,286)` / `sim=(854.4,286) rend=(854.4,286)`, zero prop-type/NaN warnings during a full bout.
  - **Both fighters now render on the same server-time playback timeline.** The local fighter had been drawn "undelayed" — literally the newest packet, a 32 Hz step function — whenever the movement predictor was not driving X (grab-push, being hit, slides, slide-jumps, any action). That was the reported choppiness on everything fast, and because the remote fighter WAS delayed (~50 ms+), a grab-push drew the two fighters from different moments and visibly closer together than they were. The predictor still takes X over immediately while moving and hands back onto the shared timeline with a blended offset. Teleport detection now scales with the server-time span between samples so a skipped broadcast is never mistaken for a teleport.
- **Session token is in-memory only** (`lib/netSessionClient.js`). Persisting it in `sessionStorage` caused three real defects found in manual play: a duplicated tab inherited the token and evicted the original ("kicked offline when I open another tab"), a reload mid-bout was resumed into the held match while the UI sat on the title screen, and an evicted tab could ping-pong with its twin. Reconnects within the running page still resume the same fighter; a page load is always a fresh identity. Crash-relaunch reconnection (Basho) needs an explicit UI flow and durable store, not implicit resume.
- **Seat follows the session when a socket is replaced without a hold** (`netSession.js`): when the same token arrives on a new socket while the old one is still "connected" (half-open TCP after a Wi‑Fi flap, or a second client), the new socket now joins the room, gets `socket.roomId`, and delta compression is re-baselined for a keyframe. Previously the new socket received no room broadcasts and — because the evicted socket's disconnect owned nothing — the seat could never be released (observed as a ghost player stuck in Room 1). The disconnect handler now finds the seat by identity rather than by the socket's `roomId` property. Regression tests: 2 (lobby + mid-bout takeover).
- **Lobby ready-up ordering bug (pre-existing, likely to hit real players):** if player 1 clicked Ready before player 2 joined, `cleanupRoomState` on the second join zeroed `readyCount` but left player 1's `isReady` flag. Player 2's Ready then only reached 1 (no `initial_game_start`; both clients stuck in the lobby UI) while the tick loop saw two `isReady` flags and started the bout with nobody watching. Fixed by keeping the count consistent with the waiting player's flag (and telling the joiner the live count), plus a `matchInitiated` lobby guard so `isReady` flags alone can never start the pre-bout ritual. Reproduced with two raw sockets before the fix (`ready_count:1 gyoji_call game_start`) and after (`ready_count:2 initial_game_start …`); regression test added.
- **Wire diet**: identity/cosmetic fields (`id, fighter, color, mawashiColor, bodyColor, gearIds`) moved off the 32 Hz always-send set into the delta set. Per-client bandwidth **~22 KB/s → ~15 KB/s** (delta packet p50 595 B → 361 B), verified by the server encoder probe.

### Measured verification (protocol v3 harness + rendered)

- **Two rooms / four rooms simultaneously** (`p2_two_rooms`, `p2_four_rooms`): all clients start and fight; independent snapshot/hit counts; **0 cross-room seq gaps**; rooms are distinct. No inputs/state/effects/results leak between rooms.
- **Transport drop** (`p2_kill_p1`): opponent notified +31 ms, `match_resumed` +856 ms, 415 snapshots resume to the survivor — a blip recovers in <1 s.
- **Dead peer** (`p2_silentkill`): detected in 6.2 s (was 28.4 s).
- **Rematch** (`p2_rematch`): `match_over → rematch → game_start` — room reused.
- **Rendered (two Electron/Chromium tabs, dev client on :5173):** with one room active, a second pair joined **Room 2** and played a live bout (screenshot evidence); closing one player's tab mid-bout showed the other player **"OPPONENT DISCONNECTED — WIN BY FORFEIT / Waiting for a new challenger…"** and returned them to a clean, joinable Room 2 lobby (never stuck). Server telemetry confirmed `holdsStarted → holdsExpired → matchesAbandonedDisconnected`.
- **Regression**: full server suite 1402 tests, 1388 pass — the **same 14 pre-existing (combat-WIP) failures**, 0 new. Client unit tests 26/26. `vite build` succeeds (inline worker bundles). VS-CPU/BASHO/Training path (CPU rooms) unaffected — `liveRoomSoak` 2 rooms fighting, 0 gaps.

### Still unfinished before Steam launch (unchanged from the roadmap, most important first)

Steam session-ticket identity + a control plane / regional match-workers (the biggest item), the deterministic-simulation boundary (Phase 2), a dedicated asset/preload pass (this update fixed the worst renderer stalls but did not redesign preloading), and real-WAN/packaged-build/Steam-Deck validation. **Single best next step:** the deterministic simulation boundary (tick-based hitstop, injected clock, seeded RNG, events returned from `tick()`), because it unlocks both client replay prediction and replay/anti-cheat and removes the last wall-clock coupling.

---

## A. Executive verdict

**Online play is not ready for a commercial Steam launch.** The simulation core is strong; the layers around it are prototype-grade. Before this pass:

1. **Identity was the Socket.IO connection id.** Any transport drop removed the player from the room within one tick, the opponent's match ended, and the automatic socket reconnect restored nothing (measured: P2 flagged 32 ms after P1's TCP close; P1 reconnected 1.6 s later with a new id and all 56 post-reconnect inputs were ignored; P2 received 0 further snapshots).
2. **A silent dead peer (no FIN) took 28.4 s to detect** (engine.io defaults `pingInterval` 25 s / `pingTimeout` 20 s), then the same forfeit.
3. **Several handlers trusted client-supplied ids** (`join_room.socketId`, `ready_count.playerId`, `power_up_selected.playerId`), one client could ready or pick power-ups for the other, and an unauthenticated debug event (`test_force_disconnect`) let any socket kill any room.
4. **No protocol version**: an old client and a new server met silently.
5. **Input packets had no sequence**: a replayed stale key snapshot was consumed as truth (measured: stale replays drained with p99 481 ms, i.e. applied after newer state).
6. **Steam identity is not wired**: `client/src/steam/steamClient.js` depends on `window.require`, which `main.js` disables (`contextIsolation: true`, `nodeIntegration: false`), and `main.js` registers no `steam-init` IPC handler.
7. **Hosting**: one Heroku dyno, one Node process, **10 hard-coded PvP rooms** (`Room 1..10`; an 11th match cannot join — verified by the load run), in-memory state, `MemoryStore` sessions with a hard-coded secret, `cors: "*"`, no SIGTERM handling (Heroku sends SIGTERM on every deploy/restart).
8. **Bandwidth**: 32 Hz delta snapshots average ~600 B (p50) with 6.7 KB keyframes every 2 s → **~22 KB/s per client (~176 kbps down)** for two fighters, because 11 "always-send" props include static identity/cosmetic fields and 143 tracked props ride the wire.

**Central technical pattern:** the server simulation is fixed-step, authoritative and — under controlled clocks — deterministic (20/20 snapshot→restore→replay trials reproduced the wire state hash bit-for-bit). Everything that makes online play *fragile* sits outside the sim: identity tied to a transport handle, an unversioned/unsequenced protocol, and single-process hosting. That is good news: the expensive part (the sim) is a *keep*; the fragile parts are *redesign*.

**Chosen target architecture (plain language):** keep the server as the single authority. Make the simulation a pure function of (state, inputs, tick) and share that module with the client so the client can predict its own fighter by *replaying its unacknowledged inputs* on top of the last authoritative snapshot (client-side rollback against server truth — no peer-to-peer, no client authority). Run matches on small regional stateful **match workers** (several 1v1s per Node process, capacity measured), fronted by a **control plane** (Steam ticket verification, matchmaking, allocation tokens, durable results). Keep Socket.IO/WebSocket for the launch path; the transport is not the measured bottleneck and can be swapped for Steam Networking Sockets/SDR later as an isolated change.

**First production phase implemented (this pass):** protocol version gate, stable per-session player identity with a resume token, mid-match **reconnect hold/resume** (bout freezes up to 15 s, the returning socket resumes the same fighter), a per-session **input sequence contract** (dupes/stale rejected, last-consumed seq acked in the state stream), removal of the unauthenticated room-kill event, graceful SIGTERM drain, and a `/metrics` endpoint. Verified with 49 new server tests (unit + real-socket integration), 7 client tests, and the two-client harness.

---

## B. Evidence and limitations

### Inspected runtime paths (executable code, not prose)
- Electron: `main.js` (spawns `server-io/index.js` as a utility process for solo modes; loads `client/dist/index.html`), `preload.js`.
- Server: `server-io/index.js` (boot, 10 fixed rooms, `setInterval(15ms)` accumulator loop, `tick()`, connection handler), `socketHandlers.js` (all gameplay events, `processInputPacket`), `gameUtils.js` (sim clock, `TimeoutManager`, lag-comp clamps, hitstop), `fighterBroadcast.js` + `deltaState.js` (snapshot/keyframe), `roomManagement.js` (power-up/salt/ready flow), `gameFunctions.js` (round end, ready positions), `constants.js` (tick/broadcast/tracked props), `inputAuditLog.js`.
- Client: `client/src/lib/serverConnection.js` (socket facade, remote/local routing), `lib/serverClock.js` (time_sync, hitstop alignment), `net/fighterSnapshotBus.js` (delta merge, seq-gap resync), `prediction/movementPredictor.js`, `components/Game.jsx` (input capture, 16 ms emit throttle, edge events), `components/GameFighter.jsx` (interpolation loop, snapshot consumption, disconnect overlay), `Room.jsx`, `Lobby.jsx`, `Rematch.jsx`, `App.jsx`, `steam/steamClient.js`, `vite.config.js`, `Procfile`, `package.json` (electron-builder files), `client/netlify.toml`.
- Dependency versions: socket.io 4.7.1 / engine.io 6.5.1 (server), socket.io-client 4.7.1 (client), express 4.18.2, electron 31.7.7, steamworks.js 0.4.0 (unused at runtime), Node v22.14.0.

### Harness and measurements (all in `/tmp/pumo_net_audit/`)
- `harness.mjs`: spawns the **real** `server-io/index.js`, drives **two real socket.io clients** through the real PvP flow (connect → time_sync ×5 → join_room → ready → initial_game_start → pre_match_complete → power_up_selected → power_ups_revealed → salt → walk → game_start → fight → game_over/auto-reset → match_over → rematch). Packets are the real client shape (`{id, keys, events[{k,a,t}], clientSynced, clientOffset, clientRtt}`) with the real 16 ms throttle. Runs the real `MovementPredictor` module against the live stream for correction telemetry.
- `serverProbe.cjs`: `-r` preload, zero repo changes; hooks `processInputPacket` (drain time), `registerSocketHandlers` (receipt time), the socket.io encoder (real encoded bytes per broadcast), the 15 ms game-loop wakeup (duration, gap, ticks per wakeup), `monitorEventLoopDelay`, GC, CPU/RSS. All timestamps on `CLOCK_MONOTONIC` shared with the harness process.
- `impairProxy.mjs`: TCP proxy with per-direction latency, jitter, periodic stalls, one-off spikes, hard kill, and silent stall. **Strict per-direction FIFO** (a first version reordered bytes at equal deadlines and produced `seq` gaps that a real TCP path cannot; those runs were discarded and re-run).
- `analyze.mjs`: joins client/server logs into distributions (n, min, p50, p95, p99, max).
- `rollback/`: `indexHarness.cjs` (generated copy of `index.js` exposing `tick`/`rooms`, no port bound) + `rollbackProof.cjs`.
- Sample counts per scenario: 20 s fights, ~130–160 input packets per client, ~580–720 snapshots per client, ~1,100–1,400 loop wakeups; load runs 15 s with 2N clients. Every table below states n.

### Existing tests (methodology checked)
- `server-io` suite: 1,368 tests, **14 pre-existing failures** (combat-contact tests touched by the developer's in-progress, uncommitted gameplay work — not networking). After this pass: 1,400 tests, 1,386 pass, **the same 14 failures**.
- `test/foundation/authored-catalog-deploy-mirror.test.js` asserts no runtime `require` above `server-io/` because *`server-io/` is the Heroku app root* and documents that a prior `../shared` require took the live server down. It caught my first draft; the final code ships `server-io/netProtocol.json` as a byte-identical mirror (guarded by a new test).
- `scripts/liveRoomSoak.mjs` uses CPU matches; `scripts/roomLoadBaseline.mjs` is serialize-only. Neither is a two-client network test; both were treated as such.

### What could not be executed or verified
- **Rendered client under impairment.** Two real browser tabs (Vite dev client) were driven into a real PvP match and rematch against the modified server (hello/session/resume-identity verified via `/metrics`: `hellos: 4, sessionsResumedIdentity: 1, protocolMismatches: 0`). Simulating a mid-bout transport drop inside the browser (offline emulation / reload) was blocked by the tool's safety review, so the **hold/resume overlay was not observed visually**; it is verified at the real-socket layer only.
- **Client frame time / long tasks / asset decode** were not measured (headless harness has no renderer; see §M).
- **Real WAN, Electron packaged build, Steam Deck, Steam SDK**: not exercised.
- **Load beyond 10 concurrent matches**: blocked by the 10-room cap; the 64-client single-process harness is also a limit at N ≥ 24.
- Vendor claims are labelled *verified (official docs fetched)* or *provisional*.

### Direct evidence vs inference
Everything in §D, §F, §L is direct measurement. §G/§I/§N contain recommendations (labelled). Statements about how the rendered client *looks* under impairment are inference from the interpolation code, not observation.

---

## C. Actual end-to-end architecture (as found)

```
Electron main (main.js) ─ utilityProcess.fork(server-io/index.js, PORT=random, LOCAL_TIGHT_BROADCAST=1)  ← solo modes only
        │ IPC: get-local-server-port
Renderer (React, client/dist) ── SocketFacade (serverConnection.js)
        ├─ remoteSocket: io("https://secure-beach-….herokuapp.com")   websocket→polling fallback, reconnection 5 attempts
        └─ localSocket:  io("http://127.0.0.1:<port>")                 VS CPU / Basho / Training

Heroku "web" dyno (Procfile: cd server-io && npm start) ── ONE Node process
   express + socket.io 4.7  (cors:*, express-session MemoryStore secret "my-secret" — unused by gameplay)
   rooms = 10 fixed PvP rooms + dynamic cpu-/training-/basho- rooms (in-memory arrays)
   setInterval(15ms) → accumulator → tick(15.625ms) for EVERY room (64 Hz):
       advanceRoomSimTime (paused during hitstop) → TimeoutManager.processRoom → drain inputQueue (processInputPacket)
       → collision/contact/clinch/projectiles/AI → bout clock → auto round reset
       → every 2nd tick (32 Hz): buildFighterActionPacket (delta vs previous, keyframe every 64) → io.in(room).emit("fighter_action")
   gameplay side-effects emitted INSIDE the sim: player_hit, hitstop, screen_shake, ring_out, cinematic_kill, game_over, …
```

**Input → render timeline (measured, LAN):** key edge → Game.jsx pushes `{k,a,t}` → emit ≤16 ms throttle → server rx (+0.4 ms) → enqueue → **next tick drains** (queue wait p50 9 ms, held during hitstop: p99 29–65 ms) → action executes synchronously (`executeSlapAttack`) → **next broadcast** (+0–31 ms) → client merges delta, sets discrete flags immediately, **interpolates position from previous→current snapshot over the measured inter-arrival (~31 ms), extrapolating to 1.25×** → DOM write in rAF. Remote player: same path plus their one-way latency. The local player's *movement* is predicted (strafe/coast only, time-based reconciliation `now − rtt`); *actions* show an unconfirmed pose/sound in the renderer (not measurable headlessly) and are confirmed after RTT + ~15 ms.

---

## D. Measured baseline (pre-change server, protocol v1 harness)

Symmetric RTT set via proxy. All ms. `input→drain` = client emit → server tick consumption. `m1→own` = mouse1 edge emit → first snapshot with own `isAttacking` (authoritative confirmation, not the predicted pose). `age@rx` = server encode → client receive. `ia` = snapshot inter-arrival.

| scenario | who | RTT | input→drain p50 / p95 / p99 | m1→own p50 / p95 | m1→remote p50 | age@rx p50 / p99 | ia p50 / p95 / p99 / max | B/s | gaps/resync | pred. corr. rate / err p95 px / vis.off p95 px | n(in) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lan0 | p1 | 1 | 9.7 / 15.9 / 29.2 | 14.9 / 31.1 | 15.0 | 0.3 / 0.7 | 30.2 / 44.8 / 46.1 / 47 | 21,932 | 0/0 | 0.30 / 3.0 / 2.3 | 131 |
| rtt30 | p1 | 32 | 23.1 / 37.5 / 41.1 | 40.6 / 69.0 | 40.6 | 15.7 / 16.3 | 30.3 / 44.8 / 46.0 / 46.5 | 21,846 | 0/0 | 0.70 / 4.6 / 4.3 | — |
| rtt60 | p1 | 62 | 37.4 / 51.9 / 67.9 | 80.8 / 196.1 | 80.9 | 30.4 / 31.5 | 30.3 / 44.3 / 46.2 / 46.8 | 22,167 | 0/0 | 0.70 / 6.2 / 4.2 | — |
| rtt100 | p1 | 103 | 57.5 / 67.5 / 77.7 | 117.2 / 129.8 | 117.0 | 50.9 / 52.1 | 30.3 / 44.8 / 46.1 / 47.7 | 22,105 | 0/0 | 0.80 / 6.5 / 5.8 | 159 |
| rtt150 | p1 | 152 | 83.4 / 91.1 / 104.4 | 170.3 / 180.4 | 170.4 | 75.5 / 76.5 | 30.3 / 44.8 / 46.2 / 47.8 | 22,084 | 0/0 | 0.80 / 8.9 / 10.9 | — |
| rtt250 | p1 | 252 | 133.0 / 141.5 / 171.1 | 259.0 / 276.7 | 259.0 | 125.5 / 126.4 | 30.4 / 44.6 / 46.3 / 46.5 | 21,956 | 0/0 | 0.70 / 6.4 / 7.4 | 129 |
| asym 30/150 | p1 (30) | 32 | 23.3 / 55.7 / 127.9 | 50.4 / 62.6 | 110.0 | 15.7 / 16.7 | 30.4 / 44.0 / 45.7 / 46.7 | 22,033 | 0/0 | 0.51 / 5.7 / 4.4 | 88 |
| asym 30/150 | p2 (150) | 152 | 84.5 / 162.2 / 182.0 | 166.6 / 177.0 | 106.2 | 75.7 / 76.7 | 30.4 / 44.4 / 45.9 / 46.5 | 21,548 | 0/0 | — | 76 |
| jitter 100±30 | p1 | 94 | 58.4 / 93.9 / 151.3 | 129.2 / 216.2 | 115.8 | 51.2 / 80.2 | 30.2 / **68.3 / 79.4 / 100** | 22,156 | 0/0 | 0.78 / 9.0 / **12.5** | 137 |
| spikes (250 ms every 3 s, p1 only) | p1 | 63 | 38.9 / 120.8 / 234.6 | 76.6 / 154.9 | 76.8 | 30.8 / **222** | 30.2 / 44.6 / **221 / 250** | 21,775 | 0/0 | 0.74 / 6.8 / 5.1 | 144 |
| loss-like (60 ms stall every 0.7–0.9 s) | p1 | 63 | 39.7 / 51.8 / 107.1 | 76.1 / 91.3 | 76.3 | 30.8 / 55.1 | 30.4 / 44.9 / 54.5 / 58.6 | 22,045 | 0/0 | 0.70 / 6.9 / 5.5 | 159 |

Reading: authoritative response = one-way + tick quantization (p50 ≈ one-way + 8–10 ms; p99 adds 30–50 ms whenever inputs are held during hitstop). Strike confirmation ≈ RTT + 15 ms. Snapshot age ≈ one-way (server encode is sub-millisecond). On ordered TCP there are **no** seq gaps under jitter/stalls — delivery bunches instead (inter-arrival p99 79 ms with ±30 ms jitter; 250 ms freeze-then-burst on a spike). Movement-prediction corrections (>1.5 px) rise from 30 % of snapshots on LAN to 70–80 % at ≥60 ms RTT because reconciliation looks up predicted history at `now − rtt` instead of an acknowledged tick.

**Held-input quantization.** Queue wait p50 ≈ 8–10 ms (half a tick) everywhere; p99 29–65 ms = inputs held while the room is in hitstop (70–216 ms freezes measured).

**Tick / loop health (1 match):** wakeup duration p50 0.26–0.30 ms, p99 1.1–1.9 ms, max 4.5 ms; wakeup gap p50 15.1 ms, p99 16.0 ms; 1 tick per wakeup in ~97 % of wakeups, 0 in ~3 % (accumulator), ≥2 in <0.2 %; event-loop delay ≈ resolution floor; CPU 3.6–5 %; RSS 72–82 MB; GC pauses max 2.4–3.2 ms.

**Bandwidth:** `fighter_action` delta p50 595–600 B, p95 ~770 B, keyframe 6.6–6.8 KB (every 64 broadcasts); 32/s → ~22 KB/s per client. `lobby` broadcasts send **full player objects (~25.6 KB each)**; `player_hit` events ~1.2 KB. Per-player state: 568–601 own keys, 14.5–16.2 KB JSON, of which 143 props (3.1–3.3 KB) are wire-tracked.

**Concurrency (pre-change, 2N real clients, all active):**

| matches | wake p50 / p95 / p99 / max ms | CPU p50 % | RSS p50 MB | snapshot ia p50 / p99 (client) |
|---|---|---|---|---|
| 2 | 0.38 / 1.20 / 1.94 / 3.65 | 6.2 | 74 | 30.3 / 46.0 |
| 4 | 0.51 / 1.80 / 2.72 / 5.26 | 8.0 | 82 | 30.3 / 45.8 |
| 8 | 0.70 / 2.37 / 3.71 / 6.91 | 11.1 | 107 | 30.2 / 45.9 |
| 10 (post-change run) | 0.52 / 1.91 / 2.82 / 3.91 | 7.4 | 103 | — |
| 11+ | **cannot join — 10 fixed rooms** | | | |

Roughly +0.25 ms p99 per additional match. Extrapolation (labelled): half the 15.6 ms tick budget at p99 would be reached near 25–30 concurrent matches per process on this host, *before* counting socket writes to real WAN clients. Admission limit recommendation: 12 matches per worker process until measured on the target instance class.

**Recovery (pre-change):** hard TCP close → opponent flagged +32 ms, forfeit; silent dead peer → detected +28.4 s (ping timeout), forfeit; reconnect never restored a match. Rematch: `match_over` → both `rematch_count` → `rematch` in <1 ms → new match start OK.

**Protocol defences (pre-change):** duplicates are harmless (edge detector sees no change); **stale replays are applied** (drained p95 224 ms / p99 481 ms after send in `stale_lan`); a 3rd `join_room` on a full room joined the socket.io room (received all broadcasts) without being seated; `join_room` with an unknown id threw `TypeError` (swallowed by `uncaughtException`).

---

## E. Ranked root causes and launch risks

| # | Symptom | Verified mechanism (path) | Alternatives considered | Severity / confidence | Decision | Correction & success criterion |
|---|---|---|---|---|---|---|
| 1 | Any Wi-Fi blip ends the match for both players | `socketHandlers.js disconnect` removes the player immediately; identity = `socket.id`; socket.io reconnect yields a new id (kill_p1 run) | client not re-emitting; server slow to detect (it was 32 ms) | Blocker / direct | **Redesign → done this pass** | Resume within grace on real sockets; `holdsResumed` telemetry; test `reconnect-resume.integration.test.js` |
| 2 | Silent dead peer holds the opponent 28 s, then forfeit | engine.io `pingInterval` 25 s + `pingTimeout` 20 s defaults (`silentkill_p1`) | app-level keepalive missing | High / direct | Harden (next phase: 5 s/5 s ping + app heartbeat) | detection ≤10 s before hold starts |
| 3 | Spoofable ready/power-up/join; any client can kill any room | client-supplied `playerId/socketId` trusted; `test_force_disconnect` unauthenticated | none | High / direct | **Redesign → done** | all handlers bound to session; event removed; `session.test.js` |
| 4 | Old client vs new server fails silently | no version anywhere in handshake | none | High / direct | **Redesign → done** | explicit `protocol_mismatch` ack + client banner |
| 5 | Stale/duplicated input applied as truth | `fighter_action` has no seq; `player.keys = data.keys` last-wins | TCP order (does not help self-replay/flush after reconnect) | Medium / direct | **Redesign → done** | `inputStaleOrDup` counter; stale p99 481 ms → rejected |
| 6 | Prediction corrections 70–80 % of snapshots at ≥60 ms RTT; 12.5 px p95 visual offset under jitter | `movementPredictor.onServerSnapshot` compares against history at `now − rtt` (estimate), not an acked tick; strikes not predicted at all (confirm = RTT+15 ms) | renderer stalls (excluded: headless shows same) | High feel / direct | Redesign (phase 2: frame-addressed inputs + client replay of real sim) | correction rate <10 % at 100 ms; own-action visible ≤ 1 frame |
| 7 | Deploy/restart drops every live match with no notice | no SIGTERM handler; Heroku sends SIGTERM on every deploy | none | High / direct (docs) | **Harden → done** (drain notice); migrate matches later | `server_shutdown` seen by clients; `draining` in /health |
| 8 | Capacity capped at 10 matches; single US process; in-memory rooms | `rooms = Array.from({length:10})`; MemoryStore; one dyno | more dynos (do NOT share in-memory rooms) | Blocker for launch scale / direct | Redesign (control plane + workers, §I) | dynamic allocation; measured admission limit |
| 9 | 22 KB/s per client; 25 KB `lobby` payloads | 143 tracked props, 11 always-send incl. static cosmetics; `lobby` emits raw player objects | compression (engine.io deflate off) | Medium / direct | Harden (phase 3: field budget, cosmetics once, binary/quantized) | ≤6 KB/s per client at 32 Hz |
| 10 | Sim outcome depends on wall clock | `hitstopUntil` uses `gameNow()`; tight-loop replay froze 86–112 ticks instead of 3–8 (`rollbackProof` P0) | — | Medium now, blocker for replay/rollback / direct | Redesign (phase 2 sim boundary) | hitstop in ticks; run-twice hash identical under production scheduler |

---

## F. Rollback feasibility verdict

Proof: `/tmp/pumo_net_audit/rollback/rollbackProof.cjs` drives the **real `tick()`** (generated harness copy of `index.js`, real `socketHandlers`, real join/ready/power-up/salt/HAKKIYOI flow via fake sockets) with recorded per-tick input scripts for both fighters (movement, approach+slap, slap/parry/dash, grab/clinch, charge/palm).

**Results**
- **P0 – wall-clock coupling (production clocks, tight loop):** hitstop episodes lasted **112, 106, 88 ticks** (should be ~3–8). The sim is *not* a function of (state, inputs, tick): `room.hitstopUntil` is an absolute `process.hrtime` deadline.
- **P1 – production clocks, identical run twice:** wire-state hash diverged at **tick 138–143**; full-state hash at tick 0 (17 `Date.now()`-stamped fields: `lastHitTime`, `attackCooldownUntil`, `_lifecycleLast*`, …).
- **P2b – controlled clocks (virtual hrtime/Date.now, seeded PRNG), run twice, 300 ticks:** wire hash **identical every tick**; full hash differs only in `_lastCombatContactResolution` (interaction id built from module-level `_interactionSeq`).
- **P2 – snapshot → run 64 ticks → restore → replay, 20 trials (5 scripts × K∈{40,80,120,200}):** wire hash **identical in 20/20**, including trials with hits, hitstop (4–14 frozen ticks), grabs and charge/palm; full hash differs only in the same `_lastCombatContactResolution` id.
- **Costs:** snapshot 36.6–41.8 KB JSON (both players + room; 0–4 live timers); capture 0.4–3.0 ms (`structuredClone`); restore 0.4–1.9 ms; **tick 0.062 ms p50 / 0.22 ms p99 / 0.80 ms max**; **64-tick replay 3.3–6.0 ms**; 0 GC pauses during the proof.
- **State shape:** 601 own keys per player (275 numbers, 201 booleans, 101 nulls, 8 nested objects, 1 **function** — `slapCycleEndCallback` closure, not serializable), 124 time-like keys, 37 `_debug` keys; 143 wire props.
- **Blockers found:** hitstop on wall clock; `Date.now()`/unseeded `Math.random()` in ids and debug stamps (harmless for the wire hash, fatal for exact-state checks); module-level state outside room/player (`TimeoutManager` maps — restored in-process by copying, `_interactionSeq`, `_lastSlapChargedResolution`, `_lastResolve/_lastCommitted`); closures stored in state; `io.emit` side effects **inside** the sim (`player_hit`, `hitstop`, `screen_shake`, `cinematic_kill`, `game_over`) that would double-fire on replay; lobby power-up shuffle uses global RNG (lobby-only). Cross-runtime: Electron 31 (V8 12.6) vs Node 22 (V8 12.4) — pure JS arithmetic is IEEE-754 identical; transcendental functions are fdlibm-derived and stable across these versions but must be pinned or avoided (risk, not proof).

**Verdict: reject full peer-to-peer GGPO rollback; build toward a deterministic simulation boundary and use it for server-authoritative *client-side* rollback (predict-by-replay) — the "server authority + broader prediction/reconciliation" family, evolving into the hybrid.**

Why: (1) the game already has a strong server authority and a commercial Steam title needs result integrity — P2P rollback moves outcome authority to clients; (2) rollback shines when most frames are neutral; sumo is contact-dominated (clinch, grab, throw, edge pushing) where mis-predicted contacts teleport bodies — worst-case artifacts on the most important frames; (3) the deterministic core exists (P2) but the client currently contains *none* of the ~25 K-line sim, and the side-effect/clock/closure blockers must be fixed regardless. Fixing them yields a shared sim module the client can run for its **own** fighter (inputs known locally → exact prediction, replaying unacked inputs on each snapshot), keeping the server as arbiter and eliminating the time-based reconciliation error (root cause #6). Engineering cost: large but incremental (see §N Phases 2–3); operational cost: none extra; failure mode: mis-prediction → smooth correction against the authoritative snapshot, never a divergent match.

---

## G. Architecture decision record

| Criterion | 1. Hardened regional server-auth + snapshots (status quo, hardened) | 2. Server-auth + client replay prediction (**selected target**) | 3. Deterministic P2P/relayed GGPO rollback | 4. Hybrid: server-auth + client rollback (= 2, mature form) |
|---|---|---|---|---|
| Local responsiveness | movement only; actions RTT+15 ms | own fighter 0-frame (exact replay of real sim) | 0-frame | 0-frame |
| Remote motion quality | interp 1 interval behind, bunching under jitter | same as 1 (+ optional jitter buffer) | remote appears N frames late or rolls back | as 2 |
| Fairness sym/asym | server-time arbitration; asym players see own confirm at RTT | same; server still arbiter | input delay tuned per RTT; asym handled by frame delay | as 2 |
| Jitter/spikes/loss | freeze-then-burst | same for remote; local unaffected | rollbacks pile up; visual pops | as 2 |
| Artifacts | small strafe pops (measured ≤12.5 px p95) | corrections only on mis-prediction of *own* inputs vs contact | teleporting contacts | as 2 |
| Cheat/result integrity | strong | strong | weak (client authority) | strong |
| Determinism needed | no | yes (client-side, proven feasible) | yes, strictly, cross-platform | yes |
| Bandwidth/CPU | 22 KB/s/client now; tick 0.3 ms | + input redundancy (bytes) ; client runs sim (~0.06 ms/tick) | inputs only (tiny); every client runs sim | as 2 |
| Electron/JS integration | exists | share `server-io` sim module via bundler (repo already does CJS/ESM twins) | same + relay | as 2 |
| Steam identity/relay | ticket → control plane; SDR optional for servers | same | SDR P2P natural fit | same as 2 |
| Disconnect/recovery | hold/resume (done) | same | peer dropout = pause/forfeit, no authority to continue | as 2 |
| Migration risk | low | medium, staged | very high (whole sim to client, presentation rewrite) | medium |
| Testability | harness (done) | + deterministic replay tests | desync tests across platforms | + replay tests |
| Ops complexity/cost | workers + control plane | same | relay + still need results server | same |
| Agent-implementable here | yes | yes (proof exists) | not without a presentation rewrite | yes |

**Selected target:** #2 → #4. **Fallback:** #1 (hardened status quo: keep Socket.IO, add ack-based reconciliation without a shared sim) if the sim-boundary refactor stalls. **Rejected:** #3 (P2P rollback) for integrity and contact-artifact reasons above. **Transport:** WebSocket/Socket.IO is *kept* at launch — measured loop and encode costs are sub-millisecond and WAN behaviour is dominated by one-way latency, not head-of-line blocking at the 1–5 % loss-like profiles tested; a UDP/Steam Networking Sockets transport is a later, isolated swap behind the same message contract (§H), justified only by measured HOL stalls on real player traffic. **Migration:** Phase 1 (done) → Phase 2 sim boundary + frame-addressed inputs → Phase 3 client replay prediction + wire diet → Phase 4 control plane/workers/Steam. No dual netcode stack at any step: each phase replaces its predecessor's path.

---

## H. Target protocol and simulation contract

Envelope: Socket.IO events over one ordered reliable stream (TCP/TLS) at launch; every class below is defined so it survives a later unreliable transport unchanged.

| Class | Message | Direction | Reliability / redundancy | Identity | Idempotent | Size/rate bound | Discardable | Persisted |
|---|---|---|---|---|---|---|---|---|
| Version/handshake (**done**) | `hello{protocolVersion, resumeToken?}` → ack `{ok, playerId, token, resumed, roomId}` / `{ok:false, reason:"protocol_mismatch", serverVersion}` | c→s, ack | reliable, once per connect | token 192-bit | yes (repeat hello returns binding) | 1/connect; unauthenticated sockets dropped after 10 s | no | session store (process) |
| Continuous input state (**seq done**; tick addressing = phase 2) | `fighter_action{seq, keys, events[{k,a,t}], clientTick*, clientSynced, clientOffset, clientRtt}` | c→s | ordered; **seq monotonic**; stale/dup dropped; *phase 2: redundantly include last 3 unacked frames* | `seq`, later `clientTick` | duplicate = no-op | ≤16 ms cadence, 30-token bucket/200 s⁻¹, ≤16 events, 1 MB frame cap (engine.io) | oldest dropped beyond 40 queued | audit log (opt-in) |
| Input edges / one-shots | inside `events[]` with client `t` | c→s | as above; server clamps `t` to receipt−cap (RTT/2+16 ms, ≤120 ms), monotonic ±8 ms | — | — | — | — | — |
| Authoritative state | `fighter_action{seq, simTime, isDelta|isKeyframe, player1, player2, inputSeqAck*}` (*done) | s→c room | superseding; keyframe every 64 or forced; **`inputSeqAck` per fighter** | broadcast `seq`; phase 2: `tick` | latest wins | 32 Hz; ≤~1 KB delta now → target ≤200 B | yes (older seq) | no |
| Speculative state | client-only; phase 3: predicted own fighter from replay of inputs > `inputSeqAck` | — | — | — | — | — | — | — |
| Corrections | implicit: snapshot vs prediction; phase 3: replay from acked snapshot | — | — | — | — | — | — | — |
| Irreversible events | `player_hit, hitstop, ring_out, cinematic_kill, game_over, match_over, …` | s→c | reliable, ordered after the snapshot that caused them (same stream) | phase 2: `eventId = tick:seq` | dedupe by id | bounded per tick | no | results only |
| Round/match results | `game_over`, `match_over` (in-process) | s→c | reliable | phase 4: `matchId`, signed result to control plane | control plane dedupes by `matchId` | 1/round | no | **yes (control plane)** |
| Clock/latency | `time_sync{clientSent}` ack `{serverNow}` ×5 then every 30 s | c→s | best-effort | — | yes | 5+3/30 s | yes | no |
| Connection health | engine.io ping (25/20 s) → **recommend 5/5 s**; `server_shutdown{reason, retryAfterMs}` (**done**) | both | — | — | — | — | — | — |
| Resync | `request_fighter_resync` → keyframe `isResync` (client on seq gap / visibility) | c→s→c | reliable, ≥750 ms apart | room `seq` | yes | 6.7 KB | — | — |
| Reconnect/resume (**done**) | hello with token during hold → `match_resumed{roomId, playerId}` to room; `opponent_reconnecting{roomId, playerId, graceMs}` at hold start | s→c | reliable | token | yes | 15 s grace | — | — |
| Matchmaking/allocation (phase 4) | control plane HTTPS: `POST /queue` → `{matchId, workerUrl, joinToken(signed, exp)}` | c↔cp | HTTPS | Steam ID + matchId | yes | — | — | yes |
| Version policy | `PROTOCOL_VERSION` (shared/netProtocol.json ↔ client/src/lib/netProtocol.js, drift-tested) | — | — | — | — | — | — | config |

**Defined behaviours:** gaps in room `seq` → client requests keyframe (existing, verified); late input → applied on arrival tick (no rewind; phase 2 bounds lateness by `clientTick` and drops > 8 ticks late with a counter); duplicates/stale → dropped, counted; impossible seq jump (>4096) → accepted, counted (client restart); clock uncertainty → lag-comp uses receipt−cap clamps only (client offsets can never move a press earlier than receipt−cap); malicious timestamps → same clamp; backpressure → per-player queue cap 40 (oldest dropped, newest key state survives); slow clients → snapshots are superseding, no server-side buffering per client; version mismatch → explicit ack + disconnect; partial recovery → identity resumes even when the match cannot (`resumed:false`), client returns to menu.

**Simulation contract (phase 2 target):** `step(state, inputsForTick, tick) → state′ + events[]`; fixed 64 Hz; hitstop expressed in ticks; per-match seeded PRNG in state; no `Date.now`/`hrtime` inside `step`; no closures in state; all side effects returned as events and emitted by the host after the step; `snapshot(state)`/`restore(state)` pure; canonical hash = wire projection (already deterministic) → extended to full state.

---

## I. Hosting and Steam launch architecture

### Control plane vs match data plane
- **Control plane (stateless HTTPS, one region, replicated later):** Steam ticket verification (`ISteamUserAuth/AuthenticateUserTicket` via `partner.steam-api.com` with a *publisher* Web API key — server-side only), ownership check, matchmaking queue, region selection, worker allocation, **signed join token** (`matchId, steamId, workerId, exp`), durable results/ratings/sanctions (Postgres), config + compatible `PROTOCOL_VERSION` policy, future Basho scheduling.
- **Match data plane (stateful, regional):** the current `server-io` process becomes a **match worker**: N concurrent 1v1 rooms per process (admission limit from `/metrics`; start at 12), joins by token only, exposes `/health` (`OK|DRAINING`) and `/metrics` (done), holds live reconnect windows (done), reports results to the control plane exactly-once by `matchId` (idempotent upsert), drains on SIGTERM (done: notice; phase 4: stop admitting, finish bouts ≤30 s or forfeit-with-refund policy).

### Region measurement and placement
Client pings each region's worker `/health` (or SDR ping locations if Steam networking is adopted) and submits its RTT vector with the queue request. Placement: choose the region minimizing **max(rttA, rttB)**; tie-break on |rttA−rttB| (fairness) then on capacity. A player pair US-West/EU gets a US-East or EU-West worker with ~90/90 ms rather than 20/170. Queue relaxation: 0–20 s require max RTT ≤ 100 ms; 20–45 s ≤ 150 ms; >45 s accept ≤ 250 ms and show "high latency"; region outage → exclude region, re-place; no region meets threshold → offer the match with a warning or decline (developer decision §O).

### Provider comparison (Heroku facts verified against Heroku Dev Center; others *provisional*)
| Option | Regions/routing | Stateful sockets | Lifecycle/drain | Allocation API | Warm capacity | Observability | DDoS | Small-team burden | Lock-in | Cost drivers |
|---|---|---|---|---|---|---|---|---|---|---|
| **Heroku Common Runtime (current)** | `us` or `eu` only per app (verified); no multi-region app | WebSockets OK; **dynos never share memory** — a 2nd dyno is a 2nd unrelated server | SIGTERM, 30 s to exit (verified); daily-ish restarts | none (formation scaling) | none | logs, basic metrics | platform-level | very low | low | dyno-hours |
| Minimal regional containers/VMs (Fly.io / Hetzner / small EC2) | many regions, you place | yes | you implement drain | your control plane | you keep spares | you wire it | provider basic | medium | low | vCPU-hours × regions, egress |
| Managed game-server/session platform (e.g. Hathora, Edgegap) — *provisional* | many regions, on-demand rooms | yes (WS/UDP) | managed | yes (room/deployment API) | managed | built-in | included | low–medium | medium | room-minutes/CPU-seconds |
| Major-cloud game servers (Amazon GameLift / PlayFab Multiplayer Servers) — *provisional* | many regions, fleets | yes | managed scale-in protection | yes (placement/FlexMatch) | fleet min sizes | cloud metrics | cloud | medium–high | high | instance-hours, min fleets |
| Self-operated orchestrator (Agones/K8s) | any | yes | yes | yes | you | you | you | **high** | low | not appropriate at this team size |

**Recommendation:** *Prototype→staging:* keep Heroku (one `us` app + one `eu` app) running the phase-1 worker with the control plane still in-process — cheapest way to test real-WAN behaviour with the new session layer. *Steam launch:* split control plane (any managed Node/Postgres host) from workers on **minimal regional containers or a managed game-server platform** in 3–4 regions chosen from the wishlist geography (US-East, US-West, EU-West, + Asia/Oceania if data supports), 1 warm worker per region, admission ≤12 matches/process, scale by adding processes. *Growth:* same design, more processes/regions; adopt Steam Networking Sockets + SDR for workers if measured HOL blocking or DDoS becomes real.

**Cost formula (no fabricated bill):** `monthly ≈ Σ_regions(warm_workers × worker_hours × $/hour) + Σ(matches × avg_match_minutes / capacity_per_worker) × $/worker-minute + egress(GB: matches × minutes × 2 clients × ~1.3 MB/min at 22 KB/s → ~0.35 MB/min after phase-3 diet) + control_plane_host + Postgres + observability`. Inputs still needed: expected concurrent matches by region, hours of peak, acceptable queue time, warm-spare policy.

### Steamworks as components (official docs fetched 2026-09-05)
- **Identity:** client calls `GetAuthTicketForWebApi` → ticket → control plane calls `ISteamUserAuth/AuthenticateUserTicket` (HTTPS to `partner.steam-api.com`, publisher key server-side) → 64-bit SteamID; ownership via `ISteamUser/CheckAppOwnership`. This replaces the random `playerId` in `netSession.js` with the SteamID while keeping the exact resume-token flow.
- **Integration risk:** `steamworks.js` README requires `contextIsolation: false` + `nodeIntegration: true` for renderer use — **unacceptable** (security); use it in the Electron **main** process and expose `steam-get-web-api-ticket` via the existing `contextBridge` pattern in `preload.js`. `main.js` currently has no Steam init at all; `steamworks.js` binaries must ship next to the app (already in `extraResources`).
- **Networking:** `ISteamNetworkingSockets` + **SDR for dedicated servers** hides worker IPs and gives DDoS protection; requires partner configuration and native SDK on the worker (Linux `steamnetworkingsockets` open-source build is available). Not a hosting service. Optional for launch.
- **Lobbies/matchmaking:** not needed with an own control plane; Steam lobbies could carry invites later.
- **Player IP exposure:** none today (client↔server only); keep it so (never P2P without SDR).
- **Partner-only steps (developer):** app id/publisher Web API key, SDR/game-server auth config, depot build with `steam_appid.txt` removed from release.

### Drain, deploy, outage, observability
Deploy = start new workers, mark old `DRAINING` (`/health`), control plane stops allocating to them, old workers finish or hold bouts ≤30 s then `server_shutdown` (done); Heroku's 30 s SIGTERM window is enough only if matches are not accepted during deploys (control plane gate). Outage = region excluded by health; players in flight lose the match (results marked `abandoned_server`, no rating change). Observability = `/metrics` counters (done) scraped to any dashboard; alert on `tickMs.p99 > 7.8`, `eventLoopLatenessMs.p99 > 10`, `holdsExpired/holdsStarted > 0.5`, `protocolMismatches` spikes.

---

## J. Future online Basho compatibility (not built)

- **Tournament coordinator** lives in the control plane: durable `tournamentId`, 8 entrants by **SteamID** (never socket/session id), round-robin schedule (7 rounds × 4 matches), standings, playoff rules, timers.
- Each round allocates **four independent 1v1 matches** through the same allocation API as ranked play — on possibly different workers/regions chosen per pair (placement rule from §I). A worker exit affects at most the matches on it; the coordinator re-allocates or applies the abandoned-match policy.
- **Results** arrive as signed `{tournamentId, round, matchId, winnerSteamId, loserSteamId, reason}`; the coordinator upserts by `matchId` (idempotent; duplicates from retries are harmless).
- **Reconnect** inside a match uses the phase-1 hold/resume; **no-show** = entrant fails to join within T after allocation → forfeit; **abandoned** = hold expired → forfeit; **server failure** = both entrants re-allocated once, else a recorded draw/void per rules.
- Progress is control-plane state, never in a match worker's memory — surviving any single worker exit is automatic. Coupling eight entrants to one live sim process is unnecessary and rejected.

---

## K. Security and failure findings (material only)

| Risk | Exploitability / impact | Evidence | Correction |
|---|---|---|---|
| Identity = connection id; client-supplied ids trusted (`join_room.socketId`, `ready_count.playerId`, `power_up_selected.playerId`) | trivial from a modified client; ready/unready or pick power-ups for the opponent, seat under a chosen id | `socketHandlers.js` (pre-change) | **Fixed:** all handlers bound to server-issued session id; client ids ignored; tested |
| `test_force_disconnect` unauthenticated room kill | any connected socket ends any live match | handler existed, no client usage | **Removed** |
| Third joiner enters the socket.io room and receives all broadcasts | info leak / spectate | `join_room` joined before capacity check | **Fixed:** capacity/hold/unknown-room checks before `socket.join`; test |
| Unknown room id → `TypeError` swallowed by `uncaughtException` | DoS-ish noise, inconsistent socket state | `rooms[roomIndex]` on −1 | **Fixed** |
| No protocol version | silent incompatibility | — | **Fixed** (gate + telemetry) |
| Input without seq → stale replay applied | self-inflicted only on TCP, but undefined semantics; flush-after-reconnect applies old keys | `stale_lan` p99 481 ms | **Fixed** |
| `power_up_selected` accepted any type string and repeated picks | forged power-ups / double effects | handler | **Fixed:** must be an offered type; first pick wins |
| `rematch_count` counted repeated accepts | one player could satisfy both votes | handler | **Fixed:** one idempotent vote per seated player after `match_over` |
| Session token theft | resume as victim; token is 192-bit random, never logged, TLS in prod, sessionStorage per tab | design | Acceptable for phase 1; SteamID binding in phase 4 removes long-lived value |
| `cors: "*"`, `express-session` `MemoryStore` with secret `"my-secret"` | browser-origin abuse, none of it used by gameplay | `index.js` | Phase 4: remove express-session; restrict origins for the web build |
| `maxHttpBufferSize` 1 MB default; 30-token/200 s⁻¹ input bucket per socket | memory pressure from oversized frames; flooding bounded | engine.io defaults | Phase 4: lower to 64 KB; per-IP connection limits at the edge |
| Publisher secrets in client | none present (no Steam wiring yet) | — | Keep Web API key server-side only |
| Result integrity | in-process only; no persistence | — | Phase 4 control plane with `matchId` idempotency |
| Stale workers / split brain | single process today; phase 4 must make the control plane the only owner of `matchId → worker` | — | design constraint recorded |

---

## L. Implemented first phase — session identity, protocol gate, reconnect hold/resume, input sequence contract

### Files (all changes surgical; developer's uncommitted work preserved)
- **New:** `shared/netProtocol.json` (source of truth), `server-io/netProtocol.json` (byte-identical deploy mirror — `server-io/` is the Heroku app root), `server-io/netSession.js`, `client/src/lib/netProtocol.js` (ESM twin), `client/src/lib/netSessionClient.js`, `client/src/components/NetHoldOverlay.jsx`.
- **Modified:** `server-io/index.js` (session store, `attachHello`, hold gate in `tick()`, tick-duration ring + event-loop lateness, `/metrics`, `/health` draining, SIGTERM/SIGINT graceful drain), `server-io/socketHandlers.js` (every handler bound to session id; `join_room` guards; input seq gate + ack; `rematch_count` idempotent votes; `power_up_selected` validation; `disconnect` → hold or `removeDisconnectedPlayer`; `leave_room` evicts a held opponent; `test_force_disconnect` removed), `server-io/constants.js` (`inputSeqAck`, `isDisconnected` on the delta wire), `client/src/lib/serverConnection.js` (hello on every raw connect incl. auto-reconnect, `connect` synthesized only after session ready, `id` = stable playerId, `seq` stamping on `fighter_action`, `waitForSession` for the local server, `protocol_mismatch` event), `client/src/App.jsx` (localId from session, mismatch/shutdown handling), `client/src/components/MainMenu.jsx` (update-required banner), `client/src/components/Game.jsx` (hold state machine + overlay + key re-send on resume), `client/src/net/fighterSnapshotBus.js` (ack telemetry), `server-io/scripts/{cadenceTest,reproBackM1,cpuCadenceTest}.js`, `scripts/liveRoomSoak.mjs` (protocol v2).
- **Tests added:** `server-io/test/net/session.test.js` (26), `server-io/test/net/protocol-contract.test.js` (4), `server-io/test/net/reconnect-resume.integration.test.js` (2, real server process + real sockets), `client/src/lib/netSessionClient.test.js` (7). `npm run test:net` → 49/49.

### Why this slice
It attacks the top verified launch blockers (#1, #3, #4, #5, #7 in §E), is end-to-end (protocol + server + client + tests), and is the permanent foundation of the target: stable identity is what the control plane, Steam binding, result integrity and Basho entrant identity attach to; the input sequence/ack is the hook phase 2's frame-addressed ledger extends; hold/resume is the same mechanism a worker uses during drain.

### Intentional behaviour/protocol changes
- Protocol v2 requires `hello`; unauthenticated sockets get explicit `*_failed{reason:"unauthenticated"}` replies and are dropped after 10 s. Legacy (v1) clients cannot play — by design (no dual stack); they see nothing new, the server logs `protocolMismatches/unauthenticatedRejects`.
- Mid-bout transport loss in a 2-human room **freezes the bout for 15 s** (`RECONNECT_GRACE_MS`) instead of forfeiting; opponent sees `opponent_reconnecting`; resume re-arms the interrupted hitstop, forces a keyframe, emits `match_resumed`; expiry runs the pre-existing forfeit flow. Lobby drops and CPU/training/Basho rooms keep the old immediate behaviour.
- `fighter_action` without a numeric `seq`, or with `seq ≤ last`, is dropped; `inputSeqAck` rides the delta wire.
- Client `socket.id` (facade) is now the stable playerId; `connect` fires only after the session is ready; the local solo server waits for session readiness before use.
- Server sends `server_shutdown` and refuses new sessions while draining.

### Removed / superseded
`test_force_disconnect` handler; client-supplied identity fields are ignored (still sent by UI code for compatibility of shape, harmless); `waitForConnect` in the facade replaced by `waitForSession`.

### Baseline vs post-change evidence (like-for-like harness runs, protocol v2)
| Scenario / metric | Baseline | Post-change | Mechanism |
|---|---|---|---|
| Hard TCP drop mid-bout | opponent flagged +32 ms → **match dead**; reconnected client's 56 inputs ignored; 0 snapshots to either | `opponent_reconnecting` **+31 ms**; hello(resume) **+763 ms**, same playerId; `match_resumed` to both; **419 snapshots each afterwards**; first post-resume packet is a keyframe; sim advanced **62.5 ms during an 802 ms wall gap** (frozen) | hold in `tick()`, resume via token |
| Silent dead peer | detected +28.4 s → forfeit | detected +28.4 s → hold → resumed +29.3 s, bout continued | ping defaults unchanged (next phase) |
| Stale input replay (`stale_lan`) | consumed: input→drain p95 224 / p99 481 ms | rejected before enqueue: p95 16 / p99 45 ms | seq gate |
| Duplicate input | harmless (edge detector) | dropped at gate (`inputStaleOrDup`) | seq gate |
| Third joiner / unknown room | joined socket.io room / TypeError | `join_room_failed` | guards |
| Rematch | ok | ok (`rematch_ack` 0 ms, new `game_start`) | idempotent votes |
| LAN input→drain p50/p95 | 9.7 / 15.9 ms | 8.8 / 19.2 ms | unchanged path (noise) |
| RTT100 m1→own p50/p95 | 117.2 / 129.8 | 119.2 / 129.5 | unchanged (foundational phase; no latency claim) |
| Snapshot B/s per client | 21.9–22.2 K | 22.2–22.5 K (+2 small props) | unchanged |
| Load 2/4/8 wake p99 ms | 1.94 / 2.72 / 3.71 | 1.58 / 1.83 / 2.46 | no regression (run variance) |
| Real renderer (2 Vite tabs) | — | joined, fought, rematched on v2; `hellos:4, sessionsResumedIdentity:1 (tab reload), protocolMismatches:0`; hold overlay **not visually verified** | |

### Regressions checked
Full server suite: same 14 pre-existing failures, 0 new. ESLint on touched client files: same 1 error/2 warnings as before (pre-existing), 0 new. `vite build` to a scratch dir succeeds. Solo path: `liveRoomSoak` (VS-CPU rooms) 2/2 fighting, 0 gaps. Training/Basho: unchanged code path (CPU rooms not held) — exercised only by existing tests. `git diff` contains no assets, generated files, or formatting churn; `client/dist` untouched.

### Remaining limitations
Identity is per server process (a server restart cannot resume — clients get `resumed:false` → menu). A renderer reload/crash resumes identity but the UI does not re-enter the match view (hold expires → forfeit flow, as before). Dead-peer detection still 28 s before the hold starts. Hold policy is fixed at 15 s (developer decision §O). Tokens live in `sessionStorage` (per tab).

---

## M. Asset-loading handoff (measured boundary only)

- Not measured in this pass: renderer frame time, long tasks, image decode/upload, cache misses, GC — the harness is headless and the browser session could not be instrumented mid-bout.
- Separation achieved anyway: every network metric above (input→drain, snapshot age, inter-arrival, correction rate) was captured *without* a renderer, so none of the reported network latency is an asset stall; conversely, any visible first-use hitch in the real client that does not appear as snapshot inter-arrival bunching is a client-runtime stall.
- Executable asset paths identified for the dedicated pass: `Game.jsx` `preloadSprites(...)` + `loadGyojiOutfit` gating `pre_match_complete` (server waits for it, so slow preload delays the bout for both); `rewarmTagged("rematch"|"basho_begin_bout")` and rewarm on `power_ups_revealed`; `requestFighterResync` on `visibilitychange`; `clearDecodedImageCache`/recolor LRU/hat composite caches on unmount; `PerfRecorder` (`?perf=1`) already exists and should be the measurement tool there. The developer's `localStorage` debug HUD (`pumo_combat_fidelity_debug`) was active during the browser session and should be off for measurements.
- New network instrumentation cost: `/metrics` ring buffer + `monitorEventLoopDelay(5 ms)` on the server only; client adds one counter per snapshot. No renderer work added.

---

## N. Remaining roadmap

**Phase 2 — Deterministic simulation boundary + frame-addressed input ledger (recommended next).**
Outcome: replayable matches, exact-tick reconciliation, server-side rewind for lag compensation, desync detection; prerequisite for phase 3. Scope: hitstop in ticks; virtual clock injected into `gameUtils`; per-match seeded PRNG in room state; remove `Date.now` from sim fields (move debug stamps to a side ledger); events returned from `tick()` and emitted by the host; `slapCycleEndCallback` → data; module-level `_interactionSeq`/last-resolution caches into room state; `TimeoutManager` owned by the room; `clientTick` on inputs, `tick` + per-fighter `ack{seq, clientTick}` in snapshots; engine.io ping 5/5 s + app heartbeat. Acceptance: `rollbackProof` P1 (production scheduler, run twice) identical **full** hash; 64-tick replay <8 ms; `session.test`+harness green; input→drain unchanged. Rollback boundary: env flag for tick-based hitstop during soak only, removed at exit. Learn first: nothing blocking; needs the developer's in-progress contact work to land to avoid merge churn in `collisionSystem.js`.

**Phase 3 — Client replay prediction + wire diet.** Outcome: own-fighter actions visible in 0–1 frames at any RTT; corrections <10 % of snapshots at 100 ms; ≤6 KB/s per client. Scope: bundle the sim module into the client (ESM twin or build step), predict own fighter by replaying inputs > `ack`, render remote with a 1-interval jitter buffer, cosmetics/identity sent once, quantized positions, event ids. Acceptance: harness correction-rate/visual-offset gates; renderer A/B with `PerfRecorder`. Learn first: measured client CPU for sim replay in Electron.

**Phase 4 — Control plane, match workers, Steam identity.** Outcome: multi-region, unlimited rooms, verified players, durable results, safe deploys. Scope: Steam ticket verification in main→control plane; allocation tokens; worker admission from `/metrics`; results with `matchId`; drain policy; remove express-session/CORS *; regional deployment per §I. Acceptance: two regions live, forced worker restart during matches with correct policy, load to admission limit with `tickMs.p99 < 7.8 ms`.

**Phase 5 — Optional transport swap (Steam Networking Sockets/SDR) and online Basho coordinator** — only if measured need / product go-ahead.

---

## O. Genuine developer decisions

1. **Reconnect grace window** (default **15 s**, implemented): shorter reduces opponent waiting; longer saves more matches. Consequence: forfeit rate vs annoyance.
2. **Launch regions and warm capacity** (default: US-East, US-West, EU-West, 1 warm worker each, admission 12 matches/process): drives the cost formula; needs wishlist geography.
3. **Matchmaking quality vs wait** (default: ≤100 ms max-RTT for 20 s, relax to 150 then 250 ms; decline above 250 ms with a warning option).
4. **Budget envelope and provider path** (default: Heroku us+eu for staging; minimal regional containers or a managed game-server platform for launch — pick after a 2-week staging run with real players).
5. **Appetite for native Steamworks in Electron main** (default: yes for identity/ownership via Web API ticket at launch; SDR/native sockets deferred). Consequence: without it, no verified identity and no anti-cheat/ownership gate.
6. **Hold policy during deploys** (default: stop admitting, let bouts finish ≤30 s, otherwise void with no rating change).
7. **Steam Deck target** (unknown): affects client CPU budget for phase-3 client-side simulation.

---

## P. Phase A continuation (2026-09-06)

Repo-resident netlab + first-bout preload + session hygiene + deploy checklist. No protocol bump (still v3). Owner deploys; no commit/push.

**A1.** `tools/netlab/` (FIFO TCP proxy, two-client harness, 24-cell matrix). Packets carry `roomId`. Interpolator delay uses p90 of gaps (a 250 ms stall must not pin at 160). Predictor counts `hardSnaps`. Proxy: one jitter phase per connection + sine credit so median one-way ≈ `--delay` (independent phases put input→ack p50 on the RTT+40 line at delay 0). Full 25 s matrix **PASS** (24 cells + Room 9/10 concurrency): 0 reversals, 0 hard snaps, 0 seq gaps, 0 cross-room leaks. Tables: `tools/netlab/out/matrix.md`.

**A2.** `boutLongTaskTrace` (`[perf]` / `window.__PUMO_PERF()`). Preload gates on `listFirstBoutSources` (7 s readiness, not 743 cold sources). Rest + recolor blobs decode on idle after `game_start`.

**A3.** `socket.off(event, handler)` in Lobby / Ready / App (Game / GameFighter / MainMenu already did). `applyGameReset` after `matchInitiated = true`; client `game_reset` is a no-op. Session suite +1 test (both `isReady` false after start).

**A4.** Prod `REMOTE_URL` unchanged. `Procfile` + `PORT` unchanged. Mirrors byte-identical. `DEPLOY_CHECKLIST.md`. Client `SKIP_BAKE=1 npm run build` and `vite build` succeed. Linux AppImage built headless (`dist/PenguinPow-1.0.0.AppImage`). Root `npm run build` is a leftover vite with no `index.html`.

**Tests.** server-io `npm test`: 1406 / 1392 pass / 14 fail (same 14 combat-WIP; +1 new pass). Net + interpolator + predictor + firstBoutPriority: 38 + 25 pass. Client eslint still has the pre-existing unused-`data` / `handleClinchTech` / unused-`React` errors; no new ones on the Phase A files.

**Next.** Owner deploys `server-io` then friend-tests with the packaged client. Phase B1 only after those notes. Do not start B2.
