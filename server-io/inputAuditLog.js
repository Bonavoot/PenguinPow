// ============================================
// PER-MATCH INPUT AUDIT LOG (B7 — Phase 4)
// ============================================
// Append-only JSONL of every fighter_action packet that survives the
// rate limiter, written to disk per match. Used to investigate cheat
// reports, macro accusations, and impossibly-fast-play disputes.
//
// Design choices:
//   - One file per match. Opened on first round_start of a match,
//     closed on matchOver / disconnect / room reset.
//   - JSONL (one packet per line) — easy to grep, tail, slice.
//   - fs.createWriteStream with flags:'a' so Node's internal buffer
//     coalesces ~120 writes/sec/match into far fewer fs syscalls.
//     (Compared to fs.appendFile per packet, which would fsync-storm.)
//   - Retention: 100 matches OR 7 days, whichever first. Aggressive
//     so disk footprint stays well under 100 MB even on a busy host.
//   - All errors are caught and logged; a failed log write must NEVER
//     throw into the game loop.
//
// Investigation flow:
//   - Logs live at <repo>/server-io/match-logs/.
//   - Use `node server-io/scripts/inspectMatch.js <file>` for a
//     per-player summary with macro suspicion signals.

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "match-logs");
const MAX_FILES = 100;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Audit logging is opt-in. By default it is disabled to remove the
// per-input JSON.stringify + disk write cost from the server hot path.
// Enable explicitly for tournament/competitive servers via env:
//     AUDIT_LOG=1 node index.js
// or
//     AUDIT_LOG=true node index.js
const AUDIT_ENABLED = (() => {
  const v = process.env.AUDIT_LOG;
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
})();

let dirReady = false;

function ensureDir() {
  if (dirReady) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    dirReady = true;
  } catch (err) {
    console.error("[inputAuditLog] Failed to create log dir:", err.message);
  }
}

function sanitizeRoomId(roomId) {
  return String(roomId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Sweep stale logs. Best-effort: drops files older than MAX_AGE_MS, then
// if more than MAX_FILES remain, drops oldest by mtime until <=MAX_FILES.
// Runs at module load and on every openLog. Async so it never blocks the
// game loop (caller doesn't await).
async function rotateLogs() {
  ensureDir();
  let entries;
  try {
    entries = await fs.promises.readdir(LOG_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return;
    console.error("[inputAuditLog] readdir failed:", err.message);
    return;
  }

  const stats = [];
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const full = path.join(LOG_DIR, name);
    try {
      const stat = await fs.promises.stat(full);
      stats.push({ full, mtimeMs: stat.mtimeMs });
    } catch {
      // Ignore stat failures (file may have been deleted concurrently).
    }
  }

  const now = Date.now();
  const survivors = [];
  for (const s of stats) {
    if (now - s.mtimeMs > MAX_AGE_MS) {
      try {
        await fs.promises.unlink(s.full);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("[inputAuditLog] unlink failed:", err.message);
        }
      }
    } else {
      survivors.push(s);
    }
  }

  if (survivors.length > MAX_FILES) {
    survivors.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toDelete = survivors.length - MAX_FILES;
    for (let i = 0; i < toDelete; i++) {
      try {
        await fs.promises.unlink(survivors[i].full);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("[inputAuditLog] unlink failed:", err.message);
        }
      }
    }
  }
}

// Idempotent open: safe to call repeatedly across rounds within a single
// match. Stream lives on `room.__auditStream` so the call site doesn't
// need to track per-room state separately. Filename includes room id and
// open timestamp so multiple matches in the same room produce distinct
// files.
function openLog(room) {
  if (!AUDIT_ENABLED) return;
  if (!room || !room.id) return;
  if (room.__auditStream) return; // already open for this match
  ensureDir();
  if (!dirReady) return;

  const filename = `${sanitizeRoomId(room.id)}-${Date.now()}.jsonl`;
  const fullPath = path.join(LOG_DIR, filename);
  try {
    const stream = fs.createWriteStream(fullPath, { flags: "a" });
    stream.on("error", (err) => {
      console.error(`[inputAuditLog] stream error (${filename}):`, err.message);
      // Best-effort cleanup: if the stream errors, drop our reference so
      // the room won't keep trying to write into a broken stream.
      if (room.__auditStream === stream) {
        room.__auditStream = null;
        room.__auditPath = null;
      }
    });
    room.__auditStream = stream;
    room.__auditPath = fullPath;
  } catch (err) {
    console.error("[inputAuditLog] createWriteStream failed:", err.message);
    return;
  }

  // Fire-and-forget rotation on each new match opening. Dropped logs
  // won't affect this match's stream since rotation skips files in use
  // by virtue of being "newest."
  rotateLogs().catch((err) =>
    console.error("[inputAuditLog] rotation error:", err.message),
  );
}

// One-line append. Called from the fighter_action handler AFTER the
// rate-limit gate, so dropped malicious packets are not logged. Safe to
// call when no stream is open (no-op).
function appendInput(room, entry) {
  // Fast path: when audit logging is disabled (the default), this is a single
  // pointer-comparison no-op, avoiding JSON.stringify cost in the hot input
  // handler path.
  if (!AUDIT_ENABLED) return;
  if (!room || !room.__auditStream) return;
  try {
    room.__auditStream.write(JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error("[inputAuditLog] write failed:", err.message);
  }
}

// Idempotent close. Safe to call from multiple cleanup paths
// (matchOver, opponent disconnect, full disconnect, room reset).
function closeLog(room) {
  if (!room || !room.__auditStream) return;
  const stream = room.__auditStream;
  room.__auditStream = null;
  room.__auditPath = null;
  try {
    stream.end();
  } catch (err) {
    console.error("[inputAuditLog] close failed:", err.message);
  }
}

// Run rotation once at module load to clean up any stale files left by
// a previous server process.
if (AUDIT_ENABLED) {
  rotateLogs().catch(() => {});
}

module.exports = {
  openLog,
  appendInput,
  closeLog,
  rotateLogs,
  LOG_DIR,
  AUDIT_ENABLED,
};
