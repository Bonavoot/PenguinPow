// ============================================
// SERVER CLOCK SYNC + HITSTOP DISPLAY ALIGNMENT
// ============================================
// Maintains an estimate of (serverGameNow - clientPerformanceNow) so the UI
// can schedule events at server-clock moments. Used to align the visual
// hitstop freeze across clients with asymmetric ping: today the freeze
// starts whenever the state stream pauses on each client (ping-staggered),
// after this it ENDS at the same server-clock moment on both clients so
// combat resumes simultaneously and "both clients land on the same frame."
//
// The server uses gameNow() (process.hrtime-based, monotonic, NTP-immune).
// The client uses performance.now() (also monotonic). Neither will jump.
//
// Sampling: 5 round trips spaced ~200ms apart on connect, then a small
// re-sample every 30s to absorb any drift. Median of samples is used to
// reject transient latency spikes.

const INITIAL_SAMPLES = 5;
const RESAMPLE_SAMPLES = 3;
const SAMPLE_INTERVAL_MS = 200;
const RESYNC_INTERVAL_MS = 30_000;
const ACK_TIMEOUT_MS = 2000;

let offsetMs = 0; // serverGameNow - clientPerformanceNow (median of samples)
let rttMs = 60; // median round-trip estimate; conservative default pre-handshake
let activeSocket = null;
let resyncTimer = null;

// Latest scheduled visual-hitstop end time (in client performance.now() ms).
// Read by the GameFighter interpolation loop to decide whether to pin the
// rendered position to its last-rendered value (visual freeze).
let displayHitstopUntilMs = 0;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function takeOneSample(socket) {
  return new Promise((resolve) => {
    const clientSent = performance.now();
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ACK_TIMEOUT_MS);

    socket.emit("time_sync", { clientSent }, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (!ack || typeof ack.serverNow !== "number") {
        resolve(null);
        return;
      }
      const clientReceived = performance.now();
      const rtt = clientReceived - clientSent;
      // Best estimate without hardware timestamps: assume symmetric one-way.
      // Server's serverNow was sampled "midway" through the round trip:
      //   serverMidwayInClientClock = clientSent + rtt/2
      //   offset = serverNow - serverMidwayInClientClock
      const offset = ack.serverNow - (clientSent + rtt / 2);
      resolve({ offset, rtt });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runHandshake(socket, sampleCount) {
  const collected = [];
  const rtts = [];
  for (let i = 0; i < sampleCount; i++) {
    if (socket !== activeSocket) return; // disconnected mid-handshake
    const result = await takeOneSample(socket);
    if (result) {
      collected.push(result.offset);
      rtts.push(result.rtt);
    }
    if (i < sampleCount - 1) await sleep(SAMPLE_INTERVAL_MS);
  }
  if (collected.length > 0) {
    offsetMs = median(collected);
    rttMs = median(rtts);
  }
}

function handleHitstopEvent(payload) {
  if (!payload || typeof payload.startsAt !== "number" || typeof payload.duration !== "number") {
    return;
  }
  const localStartAt = payload.startsAt - offsetMs;
  const localEndAt = localStartAt + payload.duration;
  // End-alignment: both clients pin their freeze deadline to the same server
  // moment. The freeze starts on packet arrival (ping-staggered) but ends in
  // sync, so combat resumes simultaneously on both screens. If a later
  // hitstop arrives while one is still active, we extend (max), matching the
  // server-side `triggerHitstop` which also takes the max.
  if (localEndAt > displayHitstopUntilMs) {
    displayHitstopUntilMs = localEndAt;
  }
}

export function startServerClock(socket) {
  if (activeSocket === socket) return;
  stopServerClock();
  activeSocket = socket;

  socket.on("hitstop", handleHitstopEvent);

  runHandshake(socket, INITIAL_SAMPLES);
  resyncTimer = setInterval(() => {
    if (activeSocket !== socket) return;
    runHandshake(socket, RESAMPLE_SAMPLES);
  }, RESYNC_INTERVAL_MS);
}

export function stopServerClock() {
  if (activeSocket) {
    activeSocket.off("hitstop", handleHitstopEvent);
  }
  if (resyncTimer) {
    clearInterval(resyncTimer);
    resyncTimer = null;
  }
  activeSocket = null;
  displayHitstopUntilMs = 0;
}

export function getServerOffset() {
  return offsetMs;
}

// Median RTT from the latest clock-sync handshake. Used by the movement
// predictor to estimate how old an incoming state snapshot is.
export function getEstimatedRtt() {
  return rttMs;
}

export function getDisplayHitstopUntil() {
  return displayHitstopUntilMs;
}

export function isDisplayHitstopActive() {
  return displayHitstopUntilMs > performance.now();
}
