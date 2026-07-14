// Headless check for MASTERY Phase 3 CPU cadence. Creates a VS CPU match at
// IMPOSSIBLE (92% in-window), lets the CPU pressure a mostly-idle human, and
// watches the CPU's broadcast cadenceChain climb — confirming scheduleCpuCadence
// runs without error and produces enhanced slaps at the top tier.
const { io } = require("/home/bonavoot/Development/PenguinPow/client/node_modules/socket.io-client");

const PORT = process.env.PORT || 3210;
const URL = `http://localhost:${PORT}`;
const KEYS = { w:false, a:false, s:false, d:false, " ":false, shift:false, e:false, f:false, mouse1:false, mouse2:false };

const socket = io(URL, { transports: ["websocket"] });
let id = null, roomId = null, keys = { ...KEYS };
let humanSlot = null, cpuSlot = null;
let human = {}, cpu = {};
let cpuMaxChain = 0, cpuEnhancedHits = 0, started = false;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function send(patch) {
  const events = [];
  for (const k in patch) if (!!keys[k] !== !!patch[k]) events.push({ k, a: patch[k] ? "down" : "up", t: Date.now() });
  keys = { ...keys, ...patch };
  socket.emit("fighter_action", { id, keys, events });
}

socket.on("connect", () => {
  id = socket.id;
  socket.emit("create_cpu_match", { socketId: id });
});
socket.on("cpu_match_created", (d) => {
  roomId = (d && d.roomId) || roomId;
  socket.emit("set_cpu_difficulty", { roomId, difficulty: "IMPOSSIBLE" });
  setTimeout(() => socket.emit("ready_count", { roomId, playerId: id, isReady: true }), 300);
});
socket.on("initial_game_start", () => {
  socket.emit("set_cpu_difficulty", { roomId, difficulty: "IMPOSSIBLE" });
  socket.emit("pre_match_complete", { roomId });
});
socket.on("power_up_selection_start", (data) => {
  const pick = data.availablePowerUps[0];
  socket.emit("power_up_selected", { roomId, playerId: id, powerUpType: pick, powerUp: pick, selectedPowerUp: pick });
});
socket.on("fighter_action", (data) => {
  if (!data || !data.isDelta) return;
  if (!roomId && data.roomId) roomId = data.roomId;
  if (humanSlot === null) {
    if (data.player1 && data.player1.id === id) { humanSlot = "player1"; cpuSlot = "player2"; }
    else if (data.player2 && data.player2.id === id) { humanSlot = "player2"; cpuSlot = "player1"; }
  }
  if (humanSlot && data[humanSlot]) Object.assign(human, data[humanSlot]);
  if (cpuSlot && data[cpuSlot]) {
    Object.assign(cpu, data[cpuSlot]);
    if (typeof cpu.cadenceChain === "number") cpuMaxChain = Math.max(cpuMaxChain, cpu.cadenceChain);
  }
  if (human.canMoveToReady && !human.isReady && !human._walking) {
    human._walking = true;
    send(human.x < 640 ? { d: true } : { a: true });
  }
  if (human._walking && human.isReady) { human._walking = false; send({ a:false, d:false }); }
});
socket.on("player_hit", (d) => {
  if (d && d.attackerId && d.attackerId !== id && d.isCadence) cpuEnhancedHits++;
});
socket.on("game_start", () => { if (!started) { started = true; run().catch(e => { console.error(e); process.exit(1); }); } });

async function run() {
  console.log(`\n=== CPU CADENCE TEST @ ${URL} (IMPOSSIBLE) ===`);
  await sleep(400);
  // Stand still in the ring and let the CPU come pressure us. Occasionally step
  // toward the CPU so we stay in contact (the CPU tsuppari self-spaces us).
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const toward = human.x < cpu.x ? "d" : "a";
    // Drift toward the CPU to keep the slap war in range.
    send({ [toward]: true });
    await sleep(120);
    send({ a:false, d:false });
    await sleep(120);
  }
  send({ a:false, d:false });
  console.log(`[CPU] maxCadenceChain=${cpuMaxChain}  enhancedHitsOnHuman=${cpuEnhancedHits}  (IMPOSSIBLE: expect > 0)`);
  process.exit(0);
}
setTimeout(() => { console.error("[cpuCadenceTest] TIMEOUT (humanSlot=" + humanSlot + ")"); process.exit(2); }, 45000);
