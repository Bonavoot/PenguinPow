// Headless repro for the "BACK + M1 gets stuck in place" report — v2.
// Mid-ring tests only: P1 repositions to ~600 between tests so the left
// wall can't mask movement. Samples every 50ms including during taps.
const { io } = require("/home/bonavoot/Development/PenguinPow/client/node_modules/socket.io-client");

const URL = "http://localhost:3199";
const KEYS = { w:false, a:false, s:false, d:false, " ":false, shift:false, e:false, f:false, mouse1:false, mouse2:false };

function makeClient(name) {
  const socket = io(URL, { transports: ["websocket"] });
  const c = { name, socket, keys: { ...KEYS }, id: null, state: {}, slot: null };
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
let roomId = "Room 1";
let started = false;

function flags(s) {
  const interesting = ["x","facing","isAttacking","attackType","isRecovering","isChargingAttack","isPalmThrust","isSlapAttack","isStrafing","currentAction","movementVelocity"];
  const out = {};
  for (const k of interesting) if (s[k] !== undefined) out[k] = typeof s[k] === "number" ? Math.round(s[k]*10)/10 : s[k];
  return JSON.stringify(out);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wire(c) {
  c.socket.on("connect", () => {
    c.id = c.socket.id;
    c.socket.emit("join_room", { roomId, socketId: c.id });
    setTimeout(() => c.socket.emit("ready_count", { roomId, playerId: c.id, isReady: true }), 400 + (c === p2 ? 400 : 0));
  });
  c.socket.on("initial_game_start", () => {
    if (c === p1) c.socket.emit("pre_match_complete", { roomId });
  });
  c.socket.on("power_up_selection_start", (data) => {
    const pick = data.availablePowerUps[0];
    c.socket.emit("power_up_selected", { roomId, playerId: c.id, powerUpType: pick, powerUp: pick, selectedPowerUp: pick });
    // (powerUpType is the field the server reads; powerUp/selectedPowerUp kept for back-compat)
  });
  c.socket.on("fighter_action", (data) => {
    if (!data || !data.isDelta) return;
    if (c.slot === null) {
      if (data.player1 && data.player1.id === c.id) c.slot = "player1";
      else if (data.player2 && data.player2.id === c.id) c.slot = "player2";
    }
    if (c.slot && data[c.slot]) Object.assign(c.state, data[c.slot]);

    if (c.state.canMoveToReady && !c.state.isReady && !c._walking) {
      c._walking = true;
      c.send(c.state.x < 640 ? { d: true } : { a: true });
    }
    if (c._walking && c.state.isReady) {
      c._walking = false;
      c.send({ a: false, d: false });
    }
  });
  c.socket.on("game_start", () => {
    if (c === p1 && !started) {
      started = true;
      runTest().catch(e => { console.error(e); process.exit(1); });
    }
  });
}
wire(p1); wire(p2);

async function reposition(targetX) {
  // walk P1 toward targetX
  for (let guard = 0; guard < 80; guard++) {
    const dx = targetX - p1.state.x;
    if (Math.abs(dx) < 25) break;
    p1.send(dx > 0 ? { d: true, a: false } : { a: true, d: false });
    await sleep(80);
  }
  p1.send({ a: false, d: false });
  await sleep(500);
  console.log(`[reposition] x=${Math.round(p1.state.x)}`);
}

async function sample(label, ms, step = 50) {
  for (let t = 0; t < ms; t += step) {
    await sleep(step);
    console.log(`${label} t+${t + step}ms`, flags(p1.state));
  }
}

async function runTest() {
  await sleep(300);
  const back = p1.state.facing === -1 ? "a" : "d";
  console.log(`[P1] HAKKIYOI. facing=${p1.state.facing}, back='${back}', x=${Math.round(p1.state.x)}`);

  console.log("\n=== TEST A: hold BACK+M1 (M1 stays down) mid-ring ===");
  await reposition(600);
  p1.send({ [back]: true, mouse1: true });
  await sample("holdA", 1500);
  p1.send({ mouse1: false });
  await sample("relA ", 1000);
  p1.send({ [back]: false });
  await sleep(300);

  console.log("\n=== TEST B: spam BACK+M1 x5 mid-ring, sampling during ===");
  await reposition(600);
  p1.send({ [back]: true });
  (async () => {
    for (let i = 0; i < 5; i++) {
      p1.send({ mouse1: true });
      await sleep(70);
      p1.send({ mouse1: false });
      await sleep(180);
    }
  })();
  await sample("spamB", 2600);
  p1.send({ [back]: false });
  await sleep(300);

  console.log("\n=== TEST C: BACK+M1 tap, then IMMEDIATELY try to walk back (a held throughout) ===");
  await reposition(600);
  const xc = p1.state.x;
  p1.send({ [back]: true });
  await sleep(60);
  p1.send({ mouse1: true });
  await sleep(60);
  p1.send({ mouse1: false });
  await sample("tapC ", 1400);
  console.log(`[C] x ${Math.round(xc)} -> ${Math.round(p1.state.x)}`);
  p1.send({ [back]: false });
  await sleep(400);

  console.log("\n=== TEST D: BACK+M1 tapped DURING palm recovery (gets buffered), then hold back only ===");
  await reposition(600);
  p1.send({ [back]: true });
  await sleep(60);
  // First palm
  p1.send({ mouse1: true });
  await sleep(70);
  p1.send({ mouse1: false });
  // Tap again mid-recovery (~250ms in) — this goes through the inputBuffer path
  await sleep(180);
  p1.send({ mouse1: true });
  await sleep(70);
  p1.send({ mouse1: false });
  await sample("bufD ", 2000);
  p1.send({ [back]: false });
  await sleep(400);

  console.log("\n=== TEST E: S+FORWARD+M1 TAP during slap (buffered chargedAttack), M1 released before buffer fires ===");
  await reposition(600);
  const fwd = back === "a" ? "d" : "a";
  // Start a slap
  p1.send({ mouse1: true });
  await sleep(60);
  p1.send({ mouse1: false });
  await sleep(60);
  // Quick S+forward+M1 tap during the slap — buffers a chargedAttack
  p1.send({ s: true, [fwd]: true, mouse1: true });
  await sleep(70);
  p1.send({ mouse1: false, s: false, [fwd]: false });
  await sample("bufE ", 2500, 100);
  console.log("[E] then press back to try walking:");
  p1.send({ [back]: true });
  await sample("walkE", 800, 100);
  p1.send({ [back]: false });

  console.log("\n[repro] done");
  process.exit(0);
}

setTimeout(() => { console.error("[repro] TIMEOUT. P1:", flags(p1.state)); process.exit(2); }, 120000);
