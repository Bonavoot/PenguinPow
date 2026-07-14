// Headless verification for MASTERY Phase 3 (tsuppari cadence).
// Connects two clients, walks them into slap contact, and drives P1's slaps
// two ways: MASH (hold mouse1 → buffered early → normal) vs RHYTHM (tap timed
// late in each cycle → buffered late → enhanced). Reports cadenceChain (delta
// prop) and isCadence (player_hit) observed for each.
//
// Usage: node scripts/cadenceTest.js            (defaults to ws://localhost:3199)
//        PORT=3001 node scripts/cadenceTest.js
const { io } = require("/home/bonavoot/Development/PenguinPow/client/node_modules/socket.io-client");

const PORT = process.env.PORT || 3199;
const URL = `http://localhost:${PORT}`;
const KEYS = { w:false, a:false, s:false, d:false, " ":false, shift:false, e:false, f:false, mouse1:false, mouse2:false };

function makeClient(name) {
  const socket = io(URL, { transports: ["websocket"] });
  const c = { name, socket, keys: { ...KEYS }, id: null, state: {}, slot: null,
              maxChain: 0, cadenceHits: 0, slapStarts: 0 };
  c.send = (patch) => {
    const events = [];
    for (const k in patch) {
      if (!!c.keys[k] !== !!patch[k]) events.push({ k, a: patch[k] ? "down" : "up", t: Date.now() });
    }
    c.keys = { ...c.keys, ...patch };
    socket.emit("fighter_action", { id: c.id, keys: c.keys, events });
  };
  return c;
}

const p1 = makeClient("P1");
const p2 = makeClient("P2");
const roomId = "Room 1";
let started = false;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wire(c) {
  const DBG = process.env.DBG;
  const log = (...a) => { if (DBG) console.log(c.name, ...a); };
  c.socket.on("connect", () => {
    c.id = c.socket.id;
    log("connect", c.id);
    c.socket.emit("join_room", { roomId, socketId: c.id });
    setTimeout(() => c.socket.emit("ready_count", { roomId, playerId: c.id, isReady: true }), 400 + (c === p2 ? 400 : 0));
  });
  c.socket.on("initial_game_start", () => { log("initial_game_start"); if (c === p1) c.socket.emit("pre_match_complete", { roomId }); });
  c.socket.on("power_up_selection_start", (data) => {
    log("power_up_selection_start", data && data.availablePowerUps);
    const pick = data.availablePowerUps[0];
    c.socket.emit("power_up_selected", { roomId, playerId: c.id, powerUpType: pick, powerUp: pick, selectedPowerUp: pick });
  });
  ["room_joined","waiting_for_opponent","match_found","pre_match_start","hakkiyoi","round_start"].forEach(ev =>
    c.socket.on(ev, (d) => log("EVT", ev)));
  c.socket.on("fighter_action", (data) => {
    if (!data || !data.isDelta) return;
    if (c.slot === null) {
      if (data.player1 && data.player1.id === c.id) c.slot = "player1";
      else if (data.player2 && data.player2.id === c.id) c.slot = "player2";
    }
    if (c.slot && data[c.slot]) {
      const prevAnim = c.state.slapAnimation;
      const prevSlap = c.state.isSlapAttack;
      Object.assign(c.state, data[c.slot]);
      if (typeof c.state.cadenceChain === "number") c.maxChain = Math.max(c.maxChain, c.state.cadenceChain);
      // Each real slap toggles slapAnimation 1<->2 (reliable per-slap signal even
      // when isSlapAttack stays latched across a chained string).
      if (c.state.slapAnimation !== prevAnim && (c.state.slapAnimation === 1 || c.state.slapAnimation === 2)) {
        c.slapStarts++;
      }
      if (!prevSlap && c.state.isSlapAttack) c.slapStarts++;
    }
    if (c.state.canMoveToReady && !c.state.isReady && !c._walking) {
      c._walking = true;
      c.send(c.state.x < 640 ? { d: true } : { a: true });
    }
    if (c._walking && c.state.isReady) { c._walking = false; c.send({ a: false, d: false }); }
  });
  // Capture attacker-side cadence confirms (fires on the attacker's client).
  c.socket.on("player_hit", (d) => {
    if (d && d.attackerId === c.id && d.isCadence) c.cadenceHits++;
  });
  c.socket.on("game_start", () => {
    log("game_start");
    if (c === p1 && !started) { started = true; runTest().catch(e => { console.error(e); process.exit(1); }); }
  });
}
wire(p1); wire(p2);

function towardKey(self, other) { return self.state.x < other.state.x ? "d" : "a"; }
async function closeIn() {
  // Walk both fighters into slap contact (~110px).
  for (let g = 0; g < 120; g++) {
    const d = Math.abs(p1.state.x - p2.state.x);
    if (d <= 112) break;
    p1.send({ [towardKey(p1, p2)]: true });
    p2.send({ [towardKey(p2, p1)]: true });
    await sleep(40);
  }
  p1.send({ a:false, d:false }); p2.send({ a:false, d:false });
  await sleep(150);
  console.log(`[closeIn] distance=${Math.round(Math.abs(p1.state.x - p2.state.x))}`);
}

async function phase(label, driver, ms) {
  p1.maxChain = 0; p1.cadenceHits = 0; p1.slapStarts = 0;
  await closeIn();
  const tw = towardKey(p1, p2);
  p1.send({ [tw]: true }); // hold toward so connecting slaps don't self-space out of range
  const done = driver(tw);
  await sleep(ms);
  if (typeof done === "function") done();
  p1.send({ mouse1:false, a:false, d:false });
  await sleep(300);
  console.log(`[${label}] slapStarts=${p1.slapStarts} maxCadenceChain=${p1.maxChain} cadenceHits=${p1.cadenceHits}`);
  return { maxChain: p1.maxChain, cadenceHits: p1.cadenceHits };
}

async function runTest() {
  await sleep(400);
  console.log(`\n=== PHASE 3 CADENCE TEST @ ${URL} ===`);

  // MASH: hold mouse1 down the whole time (buffered press lands early → normal).
  const mash = await phase("MASH (hold M1)", () => {
    p1.send({ mouse1: true });
  }, 3000);

  // RHYTHM: tap mouse1 timed LATE in each slap cycle. Detect each slap start from
  // the broadcast, wait most of the cycle, then tap → buffer lands in-window.
  const rhythm = await phase("RHYTHM (late taps)", (tw) => {
    let stop = false;
    (async () => {
      let lastStart = -1;
      while (!stop) {
        // Wait for a fresh slap to begin (isSlapAttack rising edge count).
        const startCount = p1.slapStarts;
        if (startCount !== lastStart && p1.state.isSlapAttack) {
          lastStart = startCount;
          await sleep(190);            // land the tap late in the ~230ms cycle
          if (stop) break;
          p1.send({ mouse1: true });
          await sleep(40);
          p1.send({ mouse1: false });
        } else if (!p1.state.isSlapAttack && p1.slapStarts === 0) {
          // Kick off the first slap.
          p1.send({ mouse1: true }); await sleep(40); p1.send({ mouse1: false });
        }
        await sleep(15);
      }
    })();
    return () => { stop = true; };
  }, 4500);

  console.log("\n=== RESULT ===");
  console.log(`MASH   → maxChain ${mash.maxChain}, cadenceHits ${mash.cadenceHits}  (expect 0 both when working correctly)`);
  console.log(`RHYTHM → maxChain ${rhythm.maxChain}, cadenceHits ${rhythm.cadenceHits}  (flag ON: expect > 0; flag OFF: expect 0)`);
  process.exit(0);
}

setTimeout(() => { console.error("[cadenceTest] TIMEOUT"); process.exit(2); }, 60000);
