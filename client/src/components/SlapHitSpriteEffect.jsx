import React, { useEffect, useState, useRef, useMemo, memo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import slapHitSheet from "../assets/slapattack-hit-effect.png";
import chargedHitSheet from "../assets/charged-attack-hit-effect.png";

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
    durationMs: 300, // 14 frames → ~21ms/frame (~47fps): snappy but readable
    sizeCqw: 12,
    // Horizontal anchor (% of 1280): base + facing*dir. These reproduce the
    // slap's known-good spot exactly (old code: facing===1 ? -8 : -3).
    baseXPct: -5.5,
    dirXPct: -2.5,
    offsetYPct: 0, // vertical nudge (% of 720)
    filters: {
      normal: null, // untouched yellow art
      counter:
        "hue-rotate(-52deg) saturate(2) brightness(1.15) drop-shadow(0 0 0.4cqw rgba(255, 70, 55, 0.8))",
      punish:
        "hue-rotate(232deg) saturate(1.7) brightness(1.12) drop-shadow(0 0 0.4cqw rgba(196, 96, 255, 0.8))",
      armorBreak:
        "hue-rotate(-25deg) saturate(1.45) brightness(1.06) drop-shadow(0 0 0.35cqw rgba(255, 155, 45, 0.75))",
      perfectEnder:
        "hue-rotate(135deg) saturate(1.7) brightness(1.15) drop-shadow(0 0 0.45cqw rgba(90, 220, 255, 0.85))",
    },
  },
  charged: {
    src: chargedHitSheet,
    grid: 4,
    startFrame: 1, // frame 0 empty; content 1–15 (peaks early, long fading tail)
    endFrame: 15,
    durationMs: 380, // 15 frames → ~25ms/frame (~40fps): the charged sheet's long tail reads better a touch slower
    sizeCqw: 12, // a touch bigger feel than slap, but not huge
    // The palm thrust / charged reaches further than a slap (bigger hitbox), so
    // the contact seam sits deeper toward the attacker than the slap's. Same base
    // as slap, but a stronger facing-directed term pushes it onto that seam.
    // Tune dirXPct (more negative = further toward attacker) and offsetYPct.
    baseXPct: -5.5,
    dirXPct: -4.5,
    offsetYPct: 0,
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
      // Amber via sepia (not hue-rotate) so the yellow core doesn't turn green.
      armorBreak:
        "sepia(1) hue-rotate(-8deg) saturate(3.6) brightness(1.05) drop-shadow(0 0 0.4cqw rgba(255, 155, 45, 0.75))",
      perfectEnder:
        "hue-rotate(178deg) saturate(1.6) brightness(1.15) drop-shadow(0 0 0.5cqw rgba(90, 220, 255, 0.85))",
    },
  },
};

// The slap-string finisher (slap3) is a much bigger hit than slap1/2. It reuses
// the SAME slap spark art (so the whole string stays visually cohesive and keeps
// the full status-color set) but scaled up and held a touch longer, so it clearly
// reads as the heavy ender rather than borrowing the charged move's own look.
HIT_FX.slapBurst = {
  ...HIT_FX.slap,
  sizeCqw: 16.5,
  durationMs: 330,
};

// Map hit status → filter key. Shared across sheets (each sheet supplies its own
// CSS for the key). Power water (isPowered) is intentionally treated as normal.
const resolveStatusKey = (position) => {
  // Perfect ender wins: it's the rare, skill-timed slap3 finisher, so its unique
  // color should always show — even when the hit is also a counter/punish/armor
  // break (otherwise those would override the blue and hide the achievement).
  if (position.isPerfectEnder) return "perfectEnder";
  if (position.isArmorBreak) return "armorBreak";
  if (position.isCounterHit) return "counter";
  if (position.isPunish) return "punish";
  return "normal";
};

// Subtle impact "pop": the spark snaps in slightly oversized then settles. This
// adds continuous motion on top of the discrete sprite frames, so the low frame
// count reads as snappy juice rather than a slideshow. Uses the standalone
// `scale` property so it composes with the container's transform (flip) instead
// of overwriting it.
const popIn = keyframes`
  0%   { scale: 0.78; }
  45%  { scale: 1.06; }
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
  animation: ${popIn} 170ms cubic-bezier(0.2, 0.85, 0.25, 1) both;
  z-index: 101; /* just above the existing HitEffect ring */
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

// A single burst instance: steps through its sheet's frames then removes itself.
const HitBurst = ({ effect, onDone }) => {
  const cfg = HIT_FX[effect.attackType];
  const [frame, setFrame] = useState(cfg.startFrame);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const totalFrames = cfg.endFrame - cfg.startFrame + 1;
    const frameDuration = cfg.durationMs / totalFrames;

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const idx = Math.floor(elapsed / frameDuration);
      if (idx >= totalFrames) {
        onDoneRef.current(effect.id);
        return;
      }
      setFrame(cfg.startFrame + idx);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effect.id, cfg]);

  return (
    <SpriteContainer
      $x={effect.x}
      $y={effect.y}
      $facing={effect.facing}
      $size={cfg.sizeCqw}
      $baseX={cfg.baseXPct}
      $dirX={cfg.dirXPct}
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
    // The slap-string ender (slap3) flags isBurstHit — route it to the bigger
    // slapBurst variant of the same spark.
    const attackType =
      rawType === "slap" && position.isBurstHit ? "slapBurst" : rawType;
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
      statusKey: resolveStatusKey(position),
    };
    setActiveEffects((prev) => [...prev, effect]);
  }, [
    hitIdentifier,
    position?.x,
    position?.y,
    position?.facing,
    position?.attackType,
    position?.isBurstHit,
    position?.isCounterHit,
    position?.isPunish,
    position?.isArmorBreak,
    position?.isPowered,
    position?.isPerfectEnder,
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
    attackType: PropTypes.string,
    hitId: PropTypes.string,
    timestamp: PropTypes.number,
    isBurstHit: PropTypes.bool,
    isCounterHit: PropTypes.bool,
    isPunish: PropTypes.bool,
    isArmorBreak: PropTypes.bool,
    isPowered: PropTypes.bool,
    isPerfectEnder: PropTypes.bool,
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
