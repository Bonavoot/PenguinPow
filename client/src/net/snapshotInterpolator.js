// ============================================
// SNAPSHOT INTERPOLATOR — server-clock playback with an adaptive jitter buffer
// ============================================
// The state stream arrives at ~64 Hz but unevenly: under jitter the measured
// inter-arrival p99 was 80 ms (bunching), and a stall delivers several
// snapshots at once. The old renderer interpolated "previous → latest" against
// the measured *arrival* interval, so remote motion sped up and slowed down
// with the network and extrapolated into corners it then snapped out of.
//
// This module plays the remote fighter back on the SERVER clock: every
// snapshot carries the room's simTime, and we render at a playback time that
// trails the newest simTime by an adaptive delay. Positions are interpolated
// between the two snapshots whose simTimes bracket the playback time, so
// motion is a smooth function of server time no matter how arrivals bunch.
// The playback clock advances by real dt each frame and is gently resynced
// toward (newestSimTime − delay), which also means it naturally FREEZES when
// the server pauses simTime during hitstop and resumes with it.
//
// Pure and DOM-free so it is unit-tested with synthetic arrival patterns.

import { REMOTE_INTERP_DELAY_MS } from "../lib/netProtocol.js";

const RING = 48;
const GAP_RING = 80; // ~1.25 s of arrival gaps at 64 Hz
const SNAP_JUMP_PX = 90; // per expected interval: teleports (round reset) never ease. 90 lets a 2-tick cinematic rocket (~64 px) interpolate.
const MAX_EXTRAPOLATE_MS = 30; // keep moving briefly if the stream pauses
const MAX_DELAY_MS = 160;
const PAUSE_RESYNC_MS = 80; // sample() gap (hitstop) — snap the playhead, don't invent sim time
export const SERVER_SNAPSHOT_INTERVAL_MS = 1000 / 64; // server-io BROADCAST_EVERY_N_TICKS=1 @ 64 Hz
/**
 * Local fighter: fixed delay of ONE snapshot interval. Still interpolated (so no
 * 64 Hz stepping) but does not inherit the remote fighter's jitter-adaptive
 * delay — your own slides/pushes show up as soon as the bracketing sample is
 * in. Under heavy jitter the two fighters can be a few ms apart in time; that
 * is far better than the old 0 ms vs ≤160 ms split.
 */
export const LOCAL_INTERP_DELAY_MS = SERVER_SNAPSHOT_INTERVAL_MS;
const DELAY_ATTACK = 0.3; // raise the delay quickly when jitter spikes
const DELAY_DECAY = 0.02; // lower it slowly when the connection is clean
const RESYNC_RATE = 0.08; // per-frame pull of the playback clock toward target
const RESYNC_SNAP_MS = 250; // beyond this drift, jump the playback clock

function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export class SnapshotInterpolator {
  constructor({ baseDelayMs = REMOTE_INTERP_DELAY_MS, expectedIntervalMs = SERVER_SNAPSHOT_INTERVAL_MS } = {}) {
    this.baseDelayMs = baseDelayMs;
    this.expectedIntervalMs = expectedIntervalMs;
    this.reset();
  }

  reset() {
    this.samples = []; // oldest → newest: { st, x, y }  (st = server simTime ms)
    this.gaps = []; // recent inter-arrival gaps (wall ms)
    this.lastArrival = null;
    this._delay = this.baseDelayMs;
    this.playbackT = null; // server-time playhead
    this.lastNow = null;
  }

  get size() {
    return this.samples.length;
  }

  /**
   * Record a snapshot. `arrivalMs` is wall-clock (performance.now); `serverT`
   * is the room simTime the snapshot carries. When serverT is missing (older
   * payloads) arrival time is used as a monotonic stand-in.
   */
  push(arrivalMs, serverT, x, y) {
    // A malformed sample must never poison the render timeline (an undefined
    // y here once put both fighters at the wrong place and broke the camera).
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.lastArrival != null) {
      const gap = arrivalMs - this.lastArrival;
      this.gaps.push(gap);
      if (this.gaps.length > GAP_RING) this.gaps.shift();
      // Delay must cover the largest recent gap between arrivals plus a margin,
      // or the playhead catches the newest sample and has to extrapolate.
      // p90 of recent gaps, not the max: a single 250 ms stall must not pin the
      // buffer at MAX_DELAY_MS. Jitter still raises the delay; stalls freeze.
      const typicalGap = percentile(this.gaps, 0.9);
      const maxGap = Math.max(this.expectedIntervalMs, typicalGap);
      const target = Math.min(MAX_DELAY_MS, Math.max(this.baseDelayMs, maxGap + this.expectedIntervalMs * 0.5));
      const rate = target > this._delay ? DELAY_ATTACK : DELAY_DECAY;
      this._delay += (target - this._delay) * rate;
    }
    this.lastArrival = arrivalMs;
    const st = typeof serverT === "number" ? serverT : arrivalMs;
    const s = this.samples;
    if (s.length && st <= s[s.length - 1].st) {
      // simTime did not advance (hitstop, or a duplicate): keep newest position.
      s[s.length - 1] = { st: s[s.length - 1].st, x, y };
      return;
    }
    s.push({ st, x, y });
    if (s.length > RING) s.shift();
  }

  get delayMs() {
    return this._delay;
  }

  latest() {
    return this.samples.length ? this.samples[this.samples.length - 1] : null;
  }

  /**
   * Pin the timeline to one sample (contact freeze / cinematic plant).
   * Next sample() starts on this pose instead of easing out of pre-pin history.
   */
  seed(serverT, x, y) {
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    const st = typeof serverT === "number" && Number.isFinite(serverT) ? serverT : 0;
    this.samples = [{ st, x, y }];
    this.playbackT = st;
    this.lastNow = null;
  }

  /**
   * Position to draw at wall time `nowMs`. Returns null before any sample.
   * `delayOverrideMs = 0` returns the newest sample undelayed (a raw 32 Hz step
   * — kept for tests/diagnostics only; the game renders BOTH fighters on the
   * delayed timeline so they share one moment in time).
   */
  sample(nowMs, delayOverrideMs = null) {
    const s = this.samples;
    const n = s.length;
    if (n === 0) return null;
    const newest = s[n - 1];
    const delay = delayOverrideMs == null ? this._delay : delayOverrideMs;

    if (delayOverrideMs === 0) {
      // Undelayed: newest authoritative position (diagnostics only).
      this.lastNow = nowMs;
      return { x: newest.x, y: newest.y, extrapolated: false, delayMs: 0, segmentDx: 0 };
    }

    // Advance / resync the server-time playhead.
    const target = newest.st - delay;
    if (this.playbackT == null) {
      this.playbackT = target;
    } else {
      const rawDt = this.lastNow == null ? 0 : nowMs - this.lastNow;
      // Hitstop (and any other display freeze) skips sample() for hundreds of
      // ms while simTime is frozen. Adding even the 100 ms clamp invents a
      // playhead hole: we then extrapolate the next rocket tick and resync
      // backward — the cinematic-kill stutter. Snap onto the live target.
      if (this.lastNow == null || rawDt > PAUSE_RESYNC_MS) {
        this.playbackT = target;
      } else {
        const dt = Math.max(0, Math.min(rawDt, 100));
        this.playbackT += dt; // real time advances the server-time playhead 1:1
        const drift = target - this.playbackT;
        if (Math.abs(drift) > RESYNC_SNAP_MS) this.playbackT = target;
        else this.playbackT += drift * RESYNC_RATE;
      }
    }
    this.lastNow = nowMs;
    const p = this.playbackT;

    if (n === 1 || p >= newest.st) {
      // Ahead of the newest sample: bounded extrapolation along the last segment.
      if (n >= 2) {
        const prev = s[n - 2];
        const span = newest.st - prev.st;
        const dx = newest.x - prev.x;
        const dy = newest.y - prev.y;
        if (span > 0 && !this._isTeleport(prev, newest)) {
          const ahead = Math.min(p - newest.st, MAX_EXTRAPOLATE_MS);
          const f = ahead / span;
          const y = dy < 0 ? Math.max(newest.y + dy * f, Math.min(prev.y, newest.y)) : newest.y + dy * f;
          return { x: newest.x + dx * f, y, extrapolated: ahead > 0, delayMs: delay, segmentDx: dx };
        }
      }
      return { x: newest.x, y: newest.y, extrapolated: false, delayMs: delay, segmentDx: 0 };
    }

    // Bracketing pair by server time.
    let i = n - 1;
    while (i > 0 && s[i - 1].st > p) i--;
    if (i === 0) return { x: s[0].x, y: s[0].y, extrapolated: false, delayMs: delay, starved: true, segmentDx: 0 };
    const a = s[i - 1];
    const b = s[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (this._isTeleport(a, b)) {
      // Teleport: jump the playhead onto the newer sample so we don't ease across.
      return { x: b.x, y: b.y, extrapolated: false, delayMs: delay, segmentDx: dx };
    }
    const span = b.st - a.st;
    const f = span > 0 ? (p - a.st) / span : 1;
    return { x: a.x + dx * f, y: a.y + dy * f, extrapolated: false, delayMs: delay, segmentDx: dx };
  }

  /** Is a→b a teleport (round reset, ring-out) rather than motion? Scales with the server-time span so a skipped broadcast is never mistaken for one. */
  _isTeleport(a, b) {
    const span = Math.max(this.expectedIntervalMs, b.st - a.st);
    const limit = SNAP_JUMP_PX * (span / this.expectedIntervalMs);
    return Math.abs(b.x - a.x) >= limit || Math.abs(b.y - a.y) >= limit;
  }
}
