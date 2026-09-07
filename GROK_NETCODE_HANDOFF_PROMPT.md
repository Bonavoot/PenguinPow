# PUMO PUMO — Netcode continuation mega prompt (for Grok 4.6 in Cursor)

You are taking over the online/netcode work on PUMO PUMO, a commercial 1v1 sumo fighting game shipping on Steam. Electron client (React + Vite, `client/`), Node + Socket.IO match server (`server-io/`), Electron shell (`main.js`, `preload.js`). A previous agent (Claude) completed a large netcode overhaul that the owner has hand-tested and confirmed feels good on LAN. Your job is to carry it forward in the phases below, in order, without regressing what works.

Read this whole document before touching code. Then read `FRESH_NETCODE_INFRASTRUCTURE_AUDIT.md` (the change log and rationale) and the files named in "Project map". Do not re-audit the codebase from scratch and do not rewrite working systems for style.

## Hard rules
- Never commit, push, deploy, or purchase anything. The owner deploys.
- Do not run the rendered game in a browser or with Electron to "check" things — the owner tests by hand, and the embedded IDE browser throttles rAF to ~2 fps which makes visual judgments meaningless. Verify with unit tests, headless socket harnesses, and builds.
- Keep offline modes (VS CPU, Training, Basho) working. They spawn `server-io/index.js` as an Electron utility process (`main.js`), so every server change affects them too.
- Never trust client-supplied identity or results. Server handlers use `pid()` (session identity), never `data.playerId`/`socket.id` from the client.
- Match-specific state, inputs, timers, effects, and results must never leak between rooms.
- After every step: run the test block below. Any NEW failure means your change is wrong. The 14 pre-existing failures are gameplay-tuning tests unrelated to netcode — do not "fix" them.
- `pkill -f <pattern>` kills your own shell when the pattern appears in your command line. Use `pgrep -f pattern` then `kill <pid>` in a separate call. Do not start the dev server (3001) or Vite (5173) unless a task says so; the owner runs them.
- When you change a protocol constant, change all three mirrors (see below).
- Report plainly; the implementation is the deliverable, reports are secondary.

## Project map (what to read, what it does)
Server (`server-io/`):
- `index.js` — Express + Socket.IO bootstrap, the 64 Hz game loop (`tick`), `/health`, `/metrics`, graceful SIGTERM drain, 10 fixed PvP rooms (`Room 1`..`Room 10`) plus dynamically created CPU/training/basho rooms. Pre-bout ritual gate ≈ line 908 (`room.matchInitiated !== false && player1.isReady && player2.isReady ...`). Broadcast at ≈ line 4488 (`BROADCAST_EVERY_N_TICKS`, `room.forceBroadcast`).
- `socketHandlers.js` — every socket event: `join_room` (acked), `ready_count` (emits `initial_game_start`, sets `room.matchInitiated`), `pre_match_complete` (waits for all humans or `PREMATCH_READY_CAP_MS`), `fighter_action` (input; `acceptInputSeq`, `noteInputConsumed`), `leave_room`, `disconnect`, rematch, power-ups, CPU/training/basho creation. Lifecycle helpers: `abandonMatch`, `leaveLobbySeat`, `resetRoomToLobby`, `unseat`, `removePlayerFromRoom`.
- `netSession.js` — session store, `hello` handshake (protocol version gate), resume token, reconnect hold/resume (`beginReconnectHold`, `resumeHeldPlayer`, `isRoomHeldForReconnect`), seat takeover when a socket is replaced, input-seq contract, `_telemetry`.
- `netProtocol.json` — byte-identical MIRROR of `shared/netProtocol.json` (Heroku app root is `server-io/`).
- `constants.js` — TICK_RATE=64, BROADCAST_EVERY_N_TICKS=1 (64 Hz broadcast), `DELTA_TRACKED_PROPS`/`ALWAYS_SEND_PROPS` (wire diet), all gameplay tuning.
- `gameUtils.js` — `gameNow()` (hrtime wall clock), `simNow(room)`, `advanceRoomSimTime`, `TimeoutManager` (`timeoutManager`), lag compensation.
- `gameFunctions.js`, `projectileUpdates.js`, `roomManagement.js`, `playerFactory.js`, `playerCleanup.js` (`cleanupRoomState`), `fighterBroadcast.js` (packet build), `deltaState.js` (delta compression).
- Tests: `server-io/test/net/*.test.js` (session, protocol contract, real-socket reconnect integration) plus a large gameplay suite (`npm test` in `server-io/`).

Client (`client/src/`):
- `lib/serverConnection.js` — `SocketFacade` (single active raw socket; `on/off/emit`; `socket.id` = stable playerId after hello; stamps `seq` on `fighter_action`; `selectGameServer` switches to the local utility-process server for solo modes).
- `lib/netSessionClient.js` — client half of the session contract. The resume token is IN-MEMORY ONLY by deliberate design (persisting it caused duplicate-tab evictions and resume-into-a-match-with-no-UI bugs). Do not persist it.
- `lib/netProtocol.js` — ESM twin of `shared/netProtocol.json`.
- `net/fighterSnapshotBus.js` — merges `fighter_action` deltas into full state, fans out to subscribers, records `inputSeqAck`.
- `net/snapshotInterpolator.js` — server-time playback with adaptive jitter buffer. Remote fighter: base `REMOTE_INTERP_DELAY_MS` (24 ms) + measured jitter, ≤160 ms. Local fighter: fixed `LOCAL_INTERP_DELAY_MS` (one 64 Hz snapshot). `SERVER_SNAPSHOT_INTERVAL_MS` = 1000/64. Unit tests in `net/snapshotInterpolator.test.js`.
- `prediction/movementPredictor.js` — local X prediction while walking; tick-anchored reconciliation using `inputAckSimTime`/`simTime` mapped to local send times. Tests in `prediction/movementPredictor.anchor.test.js`.
- `components/Game.jsx` — match container; `netHold` overlay state (`opponent_reconnecting`, `match_resumed`, `match_abandoned`, `reconnect_failed`, `server_shutdown`), `NetHoldOverlay.jsx`.
- `components/GameFighter.jsx` — the fighter renderer (huge). Interpolation loop ≈ line 2915 (`snapshotInterpRef.current.sample(timestamp, isLocalPlayer ? LOCAL_INTERP_DELAY_MS : null)`), predictor integration right below, snapshot ingestion ≈ line 3796 (`snapshotInterpRef.current.push(currentTime, shared.simTime, x, y)`).
- `components/Lobby.jsx`, `Rooms.jsx`, `Room.jsx` (acked `join_room`), `MainMenu.jsx` (also listens to `initial_game_start` for Basho), `Ready.jsx`.
- `context/PlayerColorContext.jsx` — sprite preload ("[Preload] ..." logs), `utils/SpriteRecolorizer.js` + `utils/recolorWorker.js` (off-main-thread recolor with OffscreenCanvas), `hooks/useCamera.js`.
- `constants.js` — `SERVER_BROADCAST_HZ` = 64 (informational).

Shared: `shared/netProtocol.json` — PROTOCOL_VERSION 3, RECONNECT_GRACE_MS 5000, PREMATCH_READY_CAP_MS 25000, PING_*, REMOTE_INTERP_DELAY_MS 24, EVENTS. Three mirrors: `shared/netProtocol.json`, `server-io/netProtocol.json`, `client/src/lib/netProtocol.js`. `server-io/test/net/protocol-contract.test.js` fails if they drift.

## What is already done and verified (do not redo)
- Stable session identity, protocol versioning with an "UPDATE REQUIRED" client banner on mismatch, resume tokens, 5 s mid-bout reconnect hold with room frozen, seat takeover on socket replacement, disconnect lookup by identity (no ghost seats).
- Disconnect design: brief loss → automatic resume; intentional leave, hold expiry, or server failure → `match_abandoned`, remaining player wins, room resets to lobby, both clients get a clear notice. No stuck matches. Rooms are reusable.
- Input sequence contract (dup/stale rejection, `inputSeqAck` echoed), server-authoritative everything.
- Lobby ready-up ordering fix (P1 ready before P2 joins) + `matchInitiated` guard.
- 64 Hz broadcast, wire diet (static props delta-tracked), server-time interpolation with jitter buffer, tick-anchored prediction reconciliation, both fighters on a consistent timeline.
- Renderer stalls: sprite recolor moved to a worker + OffscreenCanvas; per-frame layout reads removed from camera and balance gauge.
- `/metrics` (tick p50/p99, event-loop lateness, net telemetry), graceful drain with `server_shutdown`.

## Test block (run after every step)
```
cd server-io && npm test                     # expect 1391 pass / 14 fail (pre-existing, unrelated)
node --test server-io/test/net/session.test.js server-io/test/net/protocol-contract.test.js server-io/test/net/reconnect-resume.integration.test.js
node --test client/src/net/snapshotInterpolator.test.js client/src/lib/netSessionClient.test.js client/src/prediction/movementPredictor.anchor.test.js
cd client && npx eslint src && npx vite build
```
Baseline lint: `src` currently has a couple of pre-existing warnings (`handleClinchTech`, an unused `data`); new errors are yours.

---

# PHASE A — do now, before the owner tests with friends (in this order)

## A1. Repo-resident network lab + adverse matrix (highest priority)
The previous matrix runs lived in `/tmp` and are gone; the interpolation, broadcast rate, and local-delay changes since then are untested under WAN conditions. Build the lab INTO the repo so it can be rerun forever.

Create `tools/netlab/` (ESM, Node 22, dependencies only from `client/node_modules` via `createRequire` or a tiny `package.json` in the folder):
1. `impairProxy.mjs` — TCP proxy in front of the server (`--listen 3999 --target 3001 --delay 60 --jitter 20 --stall-every 5000 --stall 250 --loss 0`). Ordered delivery is mandatory (Socket.IO is TCP): implement each direction as ONE FIFO queue drained monotonically — never independent `setTimeout`s per chunk (they reorder). "Loss" for TCP means an extra stall, not a drop.
2. `harness.mjs` — two headless clients that play a real match: `hello` with `PROTOCOL_VERSION` from `server-io/netProtocol.json`, acked `join_room`, `ready_count`, both emit `pre_match_complete` after `initial_game_start`, pick the first power-up on `power_up_selection_start` each round, then run scripted inputs (walk, slap, grab, slide) via `fighter_action` with `seq` and `events[{k,a,t}]` exactly like `client/src/components/Game.jsx` sends them (look at its emit path). Record per client: snapshot arrival times and `simTime`, `inputSeqAck` latency (send → first snapshot with `inputSeqAck >= seq`), bytes/s, seq gaps, lifecycle events. Reuse `client/src/net/snapshotInterpolator.js` and `client/src/prediction/movementPredictor.js` directly in the harness to compute rendered-speed std (interpolator) and correction magnitude (predictor) offline.
3. `runMatrix.mjs` — starts a server on a free port with `PORT`, then for each of: RTT {0, 60, 120, 200} × jitter {0, 30, 80} × stall {none, 250 ms every 5 s} runs a 25 s match and prints a table (JSON + markdown) of: input→ack p50/p95, inter-arrival p99, interpolator delay settled value, rendered-speed std, predictor hard corrections per minute, KB/s per client, seq gaps, and whether the match completed. Also a 2-room concurrency case (two matches through one server; assert no cross-room events: each client must only ever see `fighter_action` for its own room — add a `roomId` check).
4. Pass criteria (document them in `tools/netlab/README.md`): match completes in all cells; input→ack p50 ≤ RTT + 40 ms; interpolator delay ≤ jitter + 40 ms; zero reversals in rendered remote motion; predictor hard corrections < 3/min at ≤120 ms RTT; zero cross-room leakage. If a cell fails, fix the CODE (interpolator/predictor/server), not the criteria — and explain the fix.
5. Add `"netlab": "node tools/netlab/runMatrix.mjs"` to the root `package.json` scripts.

## A2. First-match smoothness / preload pass
Owner report: online play was rough at the start of the FIRST match and smooth afterwards. The worst causes (main-thread sprite recolor, layout thrash) are fixed; finish the job properly.
1. Instrument, don't guess: add a dev-only long-task recorder (`PerformanceObserver` `longtask`, enabled when `localStorage.pumo_perf_trace === "1"` or `import.meta.env.DEV`) that logs tasks > 50 ms with a timestamp relative to `game_start` for the first 15 s of a bout, to `console.info("[perf] ...")` and to a ring buffer readable via `window.__PUMO_PERF()`.
2. Read `client/src/context/PlayerColorContext.jsx` preload: "Step 6 readiness timeout after 2550ms; 743 sources still cold" appears in the owner's console — the preload gives up with most sources cold. Make the pre-match screen actually gate on readiness for the sprites the first bout will use (both fighters' base poses, walk, slap, grab, hit, dodge, slide sets, the dohyo, HUD), decoded via `createImageBitmap`/`img.decode()` off the main thread, before the client emits `pre_match_complete`. The server already waits for every human's `pre_match_complete` (cap `PREMATCH_READY_CAP_MS` = 25 s), so a slower client delays the ritual instead of stuttering through it. Keep total pre-match wait reasonable (< 8 s on a normal PC); defer rarely used sprites to idle time after `game_start` with `requestIdleCallback`.
3. Verify with a Node-side test of the priority list (pure function: given colors/gear → ordered list of sources), and by building. The owner will confirm feel.

## A3. Hygiene fixes
a) `SocketFacade.off(event)` with no handler removes ALL listeners for that event; `Lobby.jsx` cleanup calls `socket.off("initial_game_start")`, which also removes `MainMenu.jsx`'s Basho handler. Make every `socket.off(...)` in `Lobby.jsx`, `Ready.jsx`, `Game.jsx`, `GameFighter.jsx`, `MainMenu.jsx`, `App.jsx` pass the specific handler function. Do not change facade semantics.
b) The server relies on the client's `game_reset` (sent by `Lobby.jsx` on `initial_game_start`) to clear lobby `isReady` flags before the ritual. Do it server-side: in the `ready_count` handler right after `room.matchInitiated = true`, call the same player-reset code the `"game_reset"` handler uses (extract a shared function). Keep accepting client `game_reset` as a harmless no-op. Add a test in `server-io/test/net/session.test.js` (harness helpers `connect`, `hello`, `seatTwo` at the top of the file): P1 ready, P2 joins, P2 ready → `initial_game_start` emitted AND both `isReady` false afterwards.

## A4. Packaged-build and deploy readiness (verify, then hand the owner a checklist)
Friends will run the PACKAGED client against the DEPLOYED server. The deployed Heroku server still runs the OLD protocol-2 code; until the owner deploys `server-io/`, packaged clients will show "UPDATE REQUIRED". Your job:
1. Confirm what URL the client uses in production (`REMOTE_URL` in `client/src/lib/serverConnection.js`, and any Vite env), and that `client/netlify.toml` / `package.json` build scripts still work: run the client build and the electron-builder package step if it runs headless on Linux (`npm run build` at root; if it needs a display or Wine, stop and say so).
2. Confirm `Procfile` (`web: cd server-io && npm start`) still starts the current server, that `server-io/netProtocol.json` is byte-identical to `shared/netProtocol.json`, and that the server handles `PORT` from the environment.
3. Write `DEPLOY_CHECKLIST.md` (≤40 lines): exact steps for the owner to deploy `server-io` to Heroku, verify `/health` and `/metrics` show `protocolVersion: 3`, build and share the packaged client, and what to watch in `/metrics` during friend sessions (`socketReplaced`, `holdsExpired`, `matchesAbandonedDisconnected`, `eventLoopLatenessMs.p99`, `tickMs.p99`). Note Heroku eco/basic dyno sleep and daily restarts as known launch blockers (not to fix now).

---

# PHASE B — after the owner has played real internet matches with friends

## B1. Tuning from play notes
Knobs: `REMOTE_INTERP_DELAY_MS` (three mirrors), `LOCAL_INTERP_DELAY_MS` / `MAX_DELAY_MS` / `DELAY_ATTACK` / `DELAY_DECAY` in `snapshotInterpolator.js`, `RECONNECT_GRACE_MS` (three mirrors), predictor hand-off decay (`_decayedHandoff` in `movementPredictor.js`). One knob per note; rerun the netlab matrix (A1) after each change; explain the tradeoff in one sentence.

## B2. Deterministic simulation boundary (the single most valuable architectural step)
Goal: the server simulation becomes a pure function of (state, inputs, tick) so that (a) the client can later replay-predict everything, not just walking, and (b) results can be re-verified from an input log (anti-cheat, dispute resolution, Basho replays). The previous rollback proof showed the sim is already deterministic under CONTROLLED clocks; these are the remaining couplings (counts measured today):
- Wall clock inside sim paths: `gameNow()` (hrtime) and `Date.now()` — index.js 8, gameUtils.js 11, socketHandlers.js 4, projectileUpdates.js 3, roomManagement.js 1. `simNow(room)` already exists; every gameplay timing must read `room.simTime` (or tick counts), never wall time. Wall time may remain ONLY in transport/telemetry code.
- RNG: `Math.random` in socketHandlers.js (4, power-up offers/CPU colors) and roomManagement.js (2). Replace with a per-room seeded PRNG (`room.rng`, xorshift128+ or mulberry32), seeded at match start from a server secret + room id + match counter; log the seed with the match.
- Timers: `setTimeout` in index.js (1), gameUtils.js (1), socketHandlers.js (1), roomManagement.js (2) that affect gameplay (round start, power-up notify, pre-match cap) must become sim deadlines checked in `tick` (`room.roundStartAtSim`, etc.). The `TimeoutManager` in gameUtils.js is the natural home; make it sim-clock driven for gameplay timers. Network/lifecycle timers (reconnect hold, hello timeout, pre-match cap) may stay wall-clock.
- Side effects inside the tick: `io.in(room.id).emit(...)` calls in gameFunctions.js (9), projectileUpdates.js (5), index.js (11). Refactor so `tick(room, dt)` pushes events onto `room.pendingEvents` and a single post-tick `flushRoomEvents(room, io)` emits them. Identical ordering, identical payloads.
- Non-serializable state: function-valued or closure fields on players (the rollback proof had to special-case them). Move them off the player object or make them data.
Method: do it in small steps with the full suite green after each (this workspace is NOT a git repo — there are no branches, so each step must leave the game working). Add `server-io/test/sim/determinism.test.js`: build two rooms with identical seeds, feed identical input logs for 2,000 ticks (include hits, grabs, projectiles, a ring-out and a round reset), hash the gameplay-relevant state each tick (positions, velocities, flags, stamina, power-ups, projectiles) and assert the hash sequences are identical; then a second test that runs the same log with a different wall-clock offset (mock `gameNow`) and asserts identical hashes. Also assert `room.pendingEvents` sequences are identical.
Do NOT start B2 before Phase A is complete and the owner has friend-test feedback.

---

# PHASE C — later (only when the owner explicitly asks)
- Steam session-ticket identity replacing anonymous session ids (needs the Steamworks app id); Steam Datagram Relay is a separate decision.
- Control plane + regional match workers replacing the single process with 10 fixed rooms.
- Basho crash-relaunch rejoin: persist `{playerId, token, roomId, expiresAt}` via Electron IPC only while a Basho bout is live; "Rejoin bout?" prompt on launch; longer per-room grace via `reconnectGraceFor` in `netSession.js`. Never for normal PvP.
- Production host: `Dockerfile` for `server-io/` (node:22-slim, `npm ci --omit=dev`, `PORT` env). Do not pick a provider without the owner.

## Report format at the end of each phase step
Plain, ≤25 lines: files changed and why; test results with pass/fail counts before and after; the matrix table (A1) or perf numbers (A2) when applicable; anything you were unsure about; the single next step. Append a short dated section to `FRESH_NETCODE_INFRASTRUCTURE_AUDIT.md` — do not rewrite it.
