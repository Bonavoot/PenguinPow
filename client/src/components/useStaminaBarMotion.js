import { useLayoutEffect, useRef } from "react";

/*
 * Stamina bar motion — smooth melt + move-loss ghost.
 *
 * Live fill: server stamina is Math.round'd at 32 Hz. Between packets we
 * integrate the measured stam/sec so a rope clamp / grab-push melts
 * instead of stepping. Discrete chunks still ease. Regen eases up.
 *
 * Ghost: parks at the start of the move. After a short beat it
 * empties toward the live fill at a constant stam/sec.
 */

const TAU_BURN = 0.05;
const TAU_CHUNK = 0.08;
const TAU_UP = 0.16;
const EPS = 0.06;
const SNAP_UP = 10.5;
const MAX_DT = 0.05;
const CHUNK_DROP = 5.5;
const RATE_WINDOW_MS = 220;
const PREDICT_CAP = 0.09;
const RATE_SETTLE_S = 0.22;
const GHOST_HOLD_MS = 120;
const GHOST_CATCH_PER_SEC = 95;

function expFollow(current, target, tau, dt) {
  const err = target - current;
  if (Math.abs(err) < EPS) return target;
  return current + err * (1 - Math.exp(-dt / tau));
}

function writeWidth(ref, pct) {
  const el = ref.current;
  if (!el) return;
  const v = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  el.style.width = `${v}%`;
}

function measureRate(samples, now) {
  const cutoff = now - RATE_WINDOW_MS;
  while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
  if (samples.length < 2) return null;
  const a = samples[0];
  const b = samples[samples.length - 1];
  const span = (b.t - a.t) / 1000;
  if (span < 0.04) return null;
  return (b.v - a.v) / span;
}

function tickGhost(m, dt, { parked }) {
  if (parked) {
    m.catching = false;
    m.ghost = Math.max(m.live, m.ghostPeak);
    return;
  }

  if (!m.catching) {
    m.ghost = Math.max(m.ghost, m.ghostPeak);
    if (m.ghost - m.live < 0.8) {
      m.ghost = m.live;
      m.ghostPeak = m.live;
      m.inEpisode = false;
      return;
    }
    m.catching = true;
  }

  m.ghost = Math.max(m.live, m.ghost - GHOST_CATCH_PER_SEC * dt);
  if (m.ghost <= m.live + 0.15) {
    m.ghost = m.live;
    m.ghostPeak = m.live;
    m.catching = false;
    m.inEpisode = false;
  }
}

/**
 * @param {object} opts
 * @param {number} opts.target  Server stamina 0–100
 * @param {number} opts.roundId Snap on round change
 * @param {boolean} opts.isGassed Snap to 0 while gassed
 * @param {string|number} opts.snapKey Parry / second-wind token — snap to target
 */
export function useStaminaBarMotion({
  target,
  roundId,
  isGassed = false,
  snapKey = 0,
}) {
  const fillRef = useRef(null);
  const ghostRef = useRef(null);
  const regenRef = useRef(null);
  const flashRef = useRef(null);

  const cfgRef = useRef({ target, roundId, isGassed, snapKey });
  cfgRef.current = { target, roundId, isGassed, snapKey };

  const motionRef = useRef(null);
  if (motionRef.current == null) {
    const t = target;
    motionRef.current = {
      live: t,
      ghost: t,
      lastNow: 0,
      lastRound: roundId,
      lastSnap: snapKey,
      lastGoal: t,
      lastPacketAt: 0,
      lastDrainAt: 0,
      rate: 0,
      chunkUntil: 0,
      inEpisode: false,
      ghostPeak: t,
      catching: false,
      regenUntil: 0,
      samples: [],
    };
  }

  const apply = (live, ghost) => {
    writeWidth(fillRef, live);
    writeWidth(ghostRef, ghost);
    writeWidth(regenRef, live);
    writeWidth(flashRef, live);
  };

  const bindersRef = useRef(null);
  if (bindersRef.current == null) {
    bindersRef.current = {
      fill: (el) => {
        fillRef.current = el;
        if (el) writeWidth(fillRef, motionRef.current.live);
      },
      ghost: (el) => {
        ghostRef.current = el;
        if (el) writeWidth(ghostRef, motionRef.current.ghost);
      },
      regen: (el) => {
        regenRef.current = el;
        if (el) writeWidth(regenRef, motionRef.current.live);
      },
      flash: (el) => {
        flashRef.current = el;
        if (el) writeWidth(flashRef, motionRef.current.live);
      },
    };
  }

  const snapTo = (value, now) => {
    const m = motionRef.current;
    const v = Math.max(0, Math.min(100, value));
    m.live = v;
    m.ghost = v;
    m.ghostPeak = v;
    m.inEpisode = false;
    m.catching = false;
    m.regenUntil = 0;
    m.rate = 0;
    m.chunkUntil = 0;
    m.lastGoal = v;
    m.lastPacketAt = now;
    m.lastDrainAt = 0;
    m.samples.length = 0;
    apply(v, v);
  };

  useLayoutEffect(() => {
    const m = motionRef.current;
    const now = performance.now();
    snapTo(cfgRef.current.target, now);
    m.lastRound = cfgRef.current.roundId;
    m.lastSnap = cfgRef.current.snapKey;
    m.lastNow = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- round snap only
  }, [roundId]);

  useLayoutEffect(() => {
    let raf = 0;

    const tick = (now) => {
      const m = motionRef.current;
      const { target: tgt, roundId: rid, isGassed: gassed, snapKey: snap } =
        cfgRef.current;

      if (rid !== m.lastRound) {
        m.lastRound = rid;
        snapTo(tgt, now);
        m.lastNow = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (snap !== m.lastSnap) {
        m.lastSnap = snap;
        snapTo(tgt, now);
        m.lastNow = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (gassed) {
        if (m.live > EPS || m.ghost > EPS) snapTo(0, now);
        m.lastNow = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      let dt = m.lastNow ? (now - m.lastNow) / 1000 : 1 / 60;
      if (dt > MAX_DT) dt = MAX_DT;
      if (dt < 0) dt = 0;
      m.lastNow = now;

      const goal = Math.max(0, Math.min(100, tgt));

      if (goal > m.live + SNAP_UP) {
        snapTo(goal, now);
        raf = requestAnimationFrame(tick);
        return;
      }

      if (Math.abs(goal - m.lastGoal) > 0.04) {
        const prevGoal = m.lastGoal;
        const dGoal = goal - prevGoal;
        const packetDt = m.lastPacketAt ? (now - m.lastPacketAt) / 1000 : 0;
        m.lastPacketAt = now;
        m.lastGoal = goal;

        if (dGoal < 0) {
          // New drain, or another bite in this sequence. If we were
          // catching up, park again from the current ghost so it never
          // jumps back up to a stale peak or snaps down to live.
          if (!m.inEpisode || m.catching) {
            m.ghostPeak = Math.max(m.ghost, m.live, prevGoal);
            m.inEpisode = true;
          }
          m.catching = false;
          m.lastDrainAt = now;
          m.regenUntil = 0;

          if (dGoal <= -CHUNK_DROP) {
            m.rate = 0;
            m.samples.length = 0;
            m.chunkUntil = now + 180;
          } else {
            m.samples.push({ t: now, v: goal });
            const measured = measureRate(m.samples, now);
            if (measured != null) {
              m.rate =
                m.rate < -1.2 ? m.rate * 0.62 + measured * 0.38 : measured;
            } else if (packetDt >= 0.02 && packetDt < 0.22) {
              const inst = dGoal / packetDt;
              m.rate = m.rate < -1.2 ? m.rate * 0.62 + inst * 0.38 : inst;
            }
          }
        } else if (dGoal > 0) {
          m.rate = 0;
          m.samples.length = 0;
          m.regenUntil = now + 480;
        }
      }

      const sincePacket = m.lastPacketAt ? (now - m.lastPacketAt) / 1000 : 1;
      const inChunk = m.chunkUntil > now;
      const sinceDrain = m.lastDrainAt ? now - m.lastDrainAt : 1e9;
      const burning = m.rate < -1.2 && sincePacket < RATE_SETTLE_S;
      const parked = m.inEpisode && sinceDrain < GHOST_HOLD_MS;
      const regen = m.regenUntil > now;

      if (regen) {
        m.rate = 0;
        m.samples.length = 0;
        m.live = expFollow(m.live, Math.max(goal, m.live), TAU_UP, dt);
      } else if (inChunk) {
        m.live = expFollow(m.live, goal, TAU_CHUNK, dt);
      } else if (burning) {
        let next = m.live + m.rate * dt;
        const floor = Math.max(0, goal + m.rate * PREDICT_CAP);
        if (next < floor) next = floor;
        if (next > m.live) next = m.live;
        if (next > goal + 2.5) {
          next = expFollow(m.live, goal, TAU_BURN, dt);
        }
        m.live = next;
        if (m.live < 0) m.live = 0;
        if (m.live > 100) m.live = 100;
      } else {
        m.live = expFollow(m.live, goal, TAU_CHUNK, dt);
        m.rate *= Math.exp(-dt * 10);
        if (m.rate > -1.2) m.rate = 0;
      }

      tickGhost(m, dt, { parked });
      apply(m.live, m.ghost);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    apply(motionRef.current.live, motionRef.current.ghost);

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF owns motion
  }, []);

  return bindersRef.current;
}
