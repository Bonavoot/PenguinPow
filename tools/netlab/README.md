# PUMO netlab

Repo-resident adverse-network lab. Two real Socket.IO clients play a real match
through a FIFO TCP proxy in front of `server-io`. The client interpolator and
movement predictor run offline on the recorded stream.

```
npm run netlab
node tools/netlab/runMatrix.mjs --seconds 25
node tools/netlab/runMatrix.mjs --filter 60,30,none
node tools/netlab/impairProxy.mjs --listen 3999 --target 3001 --delay 60 --jitter 20 --stall-every 5000 --stall 250 --loss 0
node tools/netlab/harness.mjs --url http://127.0.0.1:3999 --room "Room 1" --seconds 25
```

`runMatrix` starts `server-io` on a free `PORT`. It does not bind 3001 or 5173.
Do not start those yourself for this lab.

## Pieces

1. `impairProxy.mjs` — TCP proxy. Each direction is one FIFO queue drained
   monotonically (never independent `setTimeout`s per chunk). `--delay` /
   `--jitter` are one-way ms; matrix RTT = `2 * delay`. `--loss` is an extra
   stall, not a drop (Socket.IO is TCP). Up and down on one connection share
   a jitter phase, and negative sine accrues credit, so median one-way stays
   ≈ `--delay` (independent phases were adding `|sin|*jitter` to every RTT).
2. `harness.mjs` — `hello` with `PROTOCOL_VERSION` from `server-io/netProtocol.json`,
   acked `join_room`, `ready_count`, both `pre_match_complete` after
   `initial_game_start`, first offered power-up on every `power_up_selection_start`,
   then scripted walk / slap / grab / slide via `fighter_action` with `seq` and
   `events[{k,a,t}]`.
3. `runMatrix.mjs` — RTT {0, 60, 120, 200} × jitter {0, 30, 80} × stall
   {none, 250 ms every 5 s}, 25 s each, plus two concurrent rooms on one server.

## Pass criteria

- Match completes in every cell (`game_start`, snapshots still arriving, no abandon).
- Input → ack p50 ≤ RTT + 40 ms.
- Interpolator delay (settled `_delay` at end of bout) ≤ jitter + 40 ms.
- Zero reversals in rendered remote motion (rendered step opposite the last
  server-path segment, excluding teleports).
- Predictor hard corrections &lt; 3 / min at RTT ≤ 120 ms.
- Zero cross-room leakage: every `fighter_action` carries `roomId` and each
  client only ever sees its own room.

If a cell fails, fix interpolator / predictor / server — not these numbers.

## Output

JSON + markdown tables go to `tools/netlab/out/`.
