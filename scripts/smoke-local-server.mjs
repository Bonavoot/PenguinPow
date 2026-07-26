// Throwaway smoke test: connects to the local game server the way the
// Electron-spawned solo path does, creates a VS CPU match, and measures the
// fighter_action broadcast rate (expect ~64Hz with LOCAL_TIGHT_BROADCAST=1,
// ~32Hz without).
import { createRequire } from "module";
const require = createRequire(new URL("../client/package.json", import.meta.url));
const { io } = require("socket.io-client");

const port = process.env.TEST_PORT || 3777;
const socket = io(`http://127.0.0.1:${port}`, { transports: ["websocket"] });

let packets = 0;
let firstAt = 0;
let lastAt = 0;
const seenEvents = new Set();

socket.onAny((event) => {
  if (!seenEvents.has(event)) {
    seenEvents.add(event);
    console.log("first event:", event);
  }
});

socket.on("connect", () => {
  console.log("connected as", socket.id);
  socket.emit("create_cpu_match", {
    socketId: socket.id,
    mawashiColor: "#8b0000",
    bodyColor: null,
    gearIds: [],
  });
});

socket.on("connect_error", (err) => {
  console.error("connect_error:", err.message);
  process.exit(1);
});

socket.on("fighter_action", (payload) => {
  const now = performance.now();
  if (!packets) {
    firstAt = now;
    console.log(
      "prediction-gate props in first packet:",
      "actionLockRemainingMs" in (payload.player1 || {}),
      "attackCooldownRemainingMs" in (payload.player1 || {})
    );
  }
  lastAt = now;
  packets++;
});

setTimeout(() => {
  const secs = (lastAt - firstAt) / 1000;
  const hz = packets > 1 ? (packets - 1) / secs : 0;
  console.log(`fighter_action: ${packets} packets over ${secs.toFixed(2)}s → ${hz.toFixed(1)} Hz`);
  console.log("events seen:", [...seenEvents].join(", "));
  process.exit(0);
}, 5000);
