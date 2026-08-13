import React, { useEffect, useState, useRef, useMemo, memo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import slapHitSheet from "../assets/slapattack-hit-effect.png";
import chargedHitSheet from "../assets/charged-attack-hit-effect.png";
import { getDisplayHitstopUntil } from "../lib/serverClock";

// ─────────────────────────────────────────────────────────────────────────────
// Per-attack hit-spark config. Each move points at its own sprite sheet with its
// own grid/frame-range/timing/size, plus a per-status FILTER map that recolors
// the SAME bright sprite (hue-rotate + saturate + brightness + colored glow).
// Filtering keeps the art's hot cores, filaments and glow — so recolors stay as
// flashy as the untouched art — while the hue shifts to the status color.
//
// IMPORTANT: hue-rotate is measured from each sheet's OWN base hue, so the two
// sheets need different angles for the "same" target color:
//   • slap sheet base = YELLOW  (~55°) → normal = untouched
//   • charged sheet base = RED/ORANGE (~12°) → normal is rotated UP to yellow so
//     the color language stays consistent (yellow = normal, red = counter) across
//     both moves. Counter keeps the charged sheet's natural red/orange.
//
// `null` filter = paint the sheet untouched.
// ─────────────────────────────────────────────────────────────────────────────
const HIT_FX = {
  slap: {
    src: slapHitSheet,
    grid: 4,
    startFrame: 2, // frames 0–1 are empty windup
    endFrame: 15,
    durationMs: 200, // dissipation AFTER the hitstop peak-hold
    sizeCqw: 12.6,
    // Horizontal anchor (% of 1280): base + facing*dir.
    // More negative dirXPct = further toward attacker; less negative = deeper
    // into the opponent. Nudged a touch into the body (was -2.5).
    baseXPct: -5.5,
    dirXPct: -1.5,
    offsetYPct: 0, // vertical nudge (% of 720)
    peakFrame: 5, // hold this frame through hitstop — the impact money shot
    filters: {
      normal: null, // untouched yellow art
      // Rope-clamp slap — hotter white punch so the posture grind reads.
      ropeEdge:
        "brightness(1.4) saturate(0.9) drop-shadow(0 0 0.65cqw rgba(255, 250, 235, 1)) drop-shadow(0 0 1.1cqw rgba(160, 220, 255, 0.55))",
      counter:
        "hue-rotate(-52deg) saturate(2) brightness(1.15) drop-shadow(0 0 0.4cqw rgba(255, 70, 55, 0.8))",
      punish:
        "hue-rotate(232deg) saturate(1.7) brightness(1.12) drop-shadow(0 0 0.4cqw rgba(196, 96, 255, 0.8))",
      armorBreak:
        "hue-rotate(-25deg) saturate(1.45) brightness(1.06) drop-shadow(0 0 0.35cqw rgba(255, 155, 45, 0.75))",
      // Cadence intentionally shares the normal yellow spark — timing reward
      // lives on the attacker hand-flash + rising-pitch crack, not a fifth
      // status-color at the contact point (that fought counter/punish reads).
    },
    edgeSizeCqw: 15.2, // fatter burst on rope-clamp slaps
  },
  charged: {
    src: chargedHitSheet,
    grid: 4,
    startFrame: 1, // frame 0 empty; content 1–15 (peaks early, long fading tail)
    endFrame: 15,
    durationMs: 280, // dissipation after hitstop peak-hold
    sizeCqw: 18, // impact hierarchy: spark louder than lunge trails
    // Same base as slap; dirXPct less negative = deeper into the opponent
    // (more negative = toward attacker). Pushed further in from -3.5.
    baseXPct: -5.5,
    dirXPct: -1.0,
    offsetYPct: 0,
    peakFrame: 4,
    filters: {
      // Base art is two-toned (red/orange spikes + yellow-white core). A plain
      // hue-rotate turns the red yellow but pushes the already-yellow core into
      // GREEN. So for WARM targets (yellow, amber) use `sepia`, which collapses
      // every hue to a uniform warm gold first — no green — then tune with
      // saturate/hue-rotate/brightness. COOL targets (purple, cyan) can use a
      // plain hue-rotate since they rotate fully away from green.
      normal:
        "sepia(1) hue-rotate(8deg) saturate(3.2) brightness(1.12) drop-shadow(0 0 0.4cqw rgba(255, 210, 70, 0.8))",
      // Counter = the sheet's NATURAL red/orange (untouched).
      counter: null,
      punish:
        "hue-rotate(272deg) saturate(1.6) brightness(1.1) drop-shadow(0 0 0.45cqw rgba(196, 96, 255, 0.8))",
      // Pale gold + white — sepia keeps the core from going green; low
      // saturate + high brightness = soft champagne gold with white-hot tips
      // (distinct from normal's punchy yellow and counter's natural red).
      armorBreak:
        "sepia(1) hue-rotate(6deg) saturate(1.55) brightness(1.38) drop-shadow(0 0 0.45cqw rgba(255, 242, 200, 0.9))",
    },
  },
};

// Palm thrust is a much bigger hit than a slap. It reuses the SAME slap spark
// art (keeping the full status-color set) but scaled up and held a touch
// longer, so it clearly reads as the heavy burst rather than borrowing the
// charged move's own look.
HIT_FX.slapBurst = {
  ...HIT_FX.slap,
  sizeCqw: 16.5,
  durationMs: 230,
};

// Flap / slide-jump belly-slam — big burst spark (same weight as slapBurst).
// GameFighter anchors Y higher on the victim via FLAP_HIT_EFFECT_Y.
HIT_FX.flap = {
  ...HIT_FX.slapBurst,
  sizeCqw: 17.5,
  durationMs: 240,
  offsetYPct: 1.2,
};

// Low kick / trip — same slap spark art, but GameFighter passes a lower Y
// (LOW_KICK_HIT_EFFECT_Y) so the burst reads at the ankles/shins.
HIT_FX.lowKick = {
  ...HIT_FX.slap,
};

// Map hit status → filter key. Shared across sheets (each sheet supplies its own
// CSS for the key). Power water (isPowered) is intentionally treated as normal.
// Rope-edge is a pressure tell — only wins when no higher-priority status color
// applies. Counter/punish still own the slot when both apply.
const resolveStatusKey = (position) => {
  if (position.isArmorBreak) return "armorBreak";
  if (position.isCounterHit) return "counter";
  if (position.isPunish) return "punish";
  if (position.isRopeEdgeSlap) return "ropeEdge";
  return "normal";
};

// Subtle impact "pop": the spark snaps in slightly oversized then settles. This
// adds continuous motion on top of the discrete sprite frames, so the low frame
// count reads as snappy juice rather than a slideshow. Uses the standalone
// `scale` property so it composes with the container's transform (flip) instead
// of overwriting it.
const popIn = keyframes`
  0%   { scale: 0.62; }
  38%  { scale: 1.14; }
  100% { scale: 1; }
`;

const SpriteContainer = styled.div`
  position: absolute;
  /* Per-move anchor: base + a facing-directed term so each move can sit on its
     own contact seam (slap vs the longer-reaching charged/palm thrust). */
  left: ${(props) =>
    (props.$x / 1280) * 100 + props.$baseX + props.$facing * props.$dirX}%;
  bottom: ${(props) => (props.$y / 720) * 100 + props.$offsetY}%;
  width: ${(props) => props.$size}cqw;
  height: ${(props) => props.$size}cqw;
  /* Flip along the attack direction so the spark's tail points the right way. */
  transform: translate(-50%, 50%)
    scaleX(${(props) => (props.$facing === 1 ? -1 : 1)});
  transform-origin: center;
  scale: 1;
  animation: ${popIn} 110ms cubic-bezier(0.15, 0.9, 0.25, 1) both;
  z-index: 104; /* above strike-extend bodies (100–101) and HitEffect */
  pointer-events: none;
  background-repeat: no-repeat;
  will-change: background-position, filter, scale;
`;

const frameToBackgroundPosition = (frame, grid) => {
  const col = frame % grid;
  const row = Math.floor(frame / grid);
  const x = (col / (grid - 1)) * 100;
  const y = (row / (grid - 1)) * 100;
  return `${x}% ${y}%`;
};

// Build the inline style for the current frame + config + status. Always paints
// the config's sheet; a recolor status layers a CSS filter on top.
const buildFrameStyle = (frame, cfg, statusKey) => {
  const style = {
    backgroundImage: `url(${cfg.src})`,
    backgroundSize: `${cfg.grid * 100}% ${cfg.grid * 100}%`,
    backgroundPosition: frameToBackgroundPosition(frame, cfg.grid),
  };
  const filter = cfg.filters[statusKey];
  if (filter) style.filter = filter;
  return style;
};

// A single burst instance: holds the impact peak through hitstop, then
// dissipates. Same freeze-then-release as the fighters — the spark is the
// contact, not a slideshow that plays through the freeze.
const HITSTOP_BRIDGE_MS = 90;

const HitBurst = ({ effect, onDone }) => {
  const cfg = HIT_FX[effect.attackType];
  const peakFrame = Math.min(
    cfg.peakFrame ?? cfg.startFrame,
    cfg.endFrame
  );
  const [frame, setFrame] = useState(peakFrame);
  const rafRef = useRef(null);
  const spawnRef = useRef(null);
  const dissipateStartRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const dissipateFrames = cfg.endFrame - peakFrame + 1;
    const frameDuration = cfg.durationMs / Math.max(1, dissipateFrames);

    const step = (t) => {
      if (spawnRef.current === null) spawnRef.current = t;
      const hsUntil = getDisplayHitstopUntil();
      const bridging =
        t - spawnRef.current < HITSTOP_BRIDGE_MS && hsUntil <= t;
      const frozen = hsUntil > t || bridging;
      if (frozen) {
        setFrame(peakFrame);
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (dissipateStartRef.current === null) dissipateStartRef.current = t;
      const elapsed = t - dissipateStartRef.current;
      const idx = Math.floor(elapsed / frameDuration);
      if (idx >= dissipateFrames) {
        onDoneRef.current(effect.id);
        return;
      }
      setFrame(peakFrame + idx);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effect.id, cfg, peakFrame]);

  // Absolute contact seams are already tip-accurate — legacy baseX/dirX were
  // calibrated for victim.x+70 and would shove the spark behind the attacker.
  const baseX = effect.seamAnchored ? 0 : cfg.baseXPct;
  const dirX = effect.seamAnchored ? 0 : cfg.dirXPct;

  const size =
    effect.statusKey === "ropeEdge" && cfg.edgeSizeCqw
      ? cfg.edgeSizeCqw
      : cfg.sizeCqw;

  return (
    <SpriteContainer
      $x={effect.x}
      $y={effect.y}
      $facing={effect.facing}
      $size={size}
      $baseX={baseX}
      $dirX={dirX}
      $offsetY={cfg.offsetYPct || 0}
      style={buildFrameStyle(frame, cfg, effect.statusKey)}
    />
  );
};

HitBurst.propTypes = {
  effect: PropTypes.object.isRequired,
  onDone: PropTypes.func.isRequired,
};

const SlapHitSpriteEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);

  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  useEffect(() => {
    if (!position || !hitIdentifier) return;
    const rawType = position.attackType || "slap";
    // Palm thrust uses the bigger slapBurst variant of the slap spark sheet
    // (it's attackType "charged" on the wire, so it must be routed explicitly).
    const attackType = position.isPalmThrust ? "slapBurst" : rawType;
    // Only render for moves that have a configured sheet.
    if (!HIT_FX[attackType]) return;
    if (processedHitsRef.current.has(hitIdentifier)) return;

    processedHitsRef.current.add(hitIdentifier);
    const id = ++effectIdCounter.current;
    const effect = {
      id,
      hitId: hitIdentifier,
      attackType,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      seamAnchored: !!position.seamAnchored,
      statusKey: resolveStatusKey(position),
    };
    setActiveEffects((prev) => [...prev, effect]);
  }, [
    hitIdentifier,
    position?.x,
    position?.y,
    position?.facing,
    position?.seamAnchored,
    position?.attackType,
    position?.isPalmThrust,
    position?.isCounterHit,
    position?.isPunish,
    position?.isArmorBreak,
    position?.isPowered,
    position?.isRopeEdgeSlap,
  ]);

  const handleDone = (effectId) => {
    setActiveEffects((prev) => {
      const finished = prev.find((e) => e.id === effectId);
      if (finished) processedHitsRef.current.delete(finished.hitId);
      return prev.filter((e) => e.id !== effectId);
    });
  };

  return (
    <>
      {activeEffects.map((effect) => (
        <HitBurst key={effect.id} effect={effect} onDone={handleDone} />
      ))}
    </>
  );
};

SlapHitSpriteEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    facing: PropTypes.number,
    seamAnchored: PropTypes.bool,
    attackType: PropTypes.string,
    hitId: PropTypes.string,
    timestamp: PropTypes.number,
    isPalmThrust: PropTypes.bool,
    isCounterHit: PropTypes.bool,
    isPunish: PropTypes.bool,
    isArmorBreak: PropTypes.bool,
    isPowered: PropTypes.bool,
    isRopeEdgeSlap: PropTypes.bool,
  }),
};

export default memo(SlapHitSpriteEffect, (prevProps, nextProps) => {
  if (!prevProps.position && !nextProps.position) return true;
  if (!prevProps.position || !nextProps.position) return false;
  return (
    prevProps.position.hitId === nextProps.position.hitId &&
    prevProps.position.timestamp === nextProps.position.timestamp
  );
});
