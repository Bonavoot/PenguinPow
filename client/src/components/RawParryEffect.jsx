import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import parrySheet from "../assets/raw-parry-effect.png";

// ── Raw parry burst (sprite sheet) — shared by BOTH tiers ────────────────────
// A hand-drawn 8x8 / 64-frame expanding ring (raw-parry-effect.png). The art is
// DEFAULT GREEN, so each tier recolors it via CSS filter (perfect → gold, regular
// → steel-white). Being a single sprite plane it takes a CSS perspective tilt
// cleanly (no multi-layer double-image), so it reads 3D like the old tilted ring.
// NOTE: the sheet's columns are exact duplicate pairs (col0==col1, …), i.e. it's
// really ~32 unique steps padded to 64. Reading row-major with the short duration
// below auto-skips the dupes, so it plays snappy instead of slow-mo. Coverage
// ramps in ~frame 8 → peak ~24 → dissipates to 63.
const PP_GRID = 8;
const PP_START_FRAME = 8; // first frame with a visible ring (0–7 are ~empty)
const PP_END_FRAME = 63;
const PP_DURATION_MS = 460; // snappy total across the 56 frames (dupes skipped by timing)
// Perfect parry is the "special" tier, so it's BIGGER. The regular parry reuses
// the exact same sprite + tilt at a smaller size and a neutral color, so the
// hierarchy (special vs. routine) reads instantly.
const PP_SIZE_CQW_PERFECT = 23;
const PP_SIZE_CQW_REGULAR = 16;
const PP_BASELINE_OFFSET_Y = 0;
// Horizontal nudge toward the front of the parrying player (% of 1280), signed
// by facing — mirrors the offset the old CSS ring used so the burst lands at the
// same spot (just in front of / almost inside the player).
const PP_FRONT_OFFSET_PCT = -15;
// Perspective tilt. IMPORTANT: perspective() only accepts an absolute length —
// px, NOT cqw (a cqw here makes the whole transform invalid and it gets dropped,
// which breaks BOTH the centering and the tilt). Smaller px = stronger 3D.
const PP_PERSPECTIVE = "600px";
const PP_TILT = "48deg"; // rotateY tilts left/right like the old ring; swap to rotateX to lay it back

// Both tiers recolor the GREEN art → BLUE. hue-rotate on colored art can't hit
// an exact hue, so use the tint recipe: grayscale strips the green, sepia re-tones
// to a uniform warm base, a big hue-rotate swings it around to a cool electric
// blue, and saturate/brightness set the intensity.
//   • Perfect = richer, more saturated electric blue + a two-stop blue bloom.
//   • Regular = lighter, brighter "bluish-white" (less saturation, more brightness)
//     so it still reads as the routine tier while sharing the blue color language.
const PERFECT_PARRY_FILTER = `grayscale(1) sepia(1) hue-rotate(178deg) saturate(3.2) brightness(1.18) drop-shadow(0 0 5px rgba(95, 190, 255, 0.9)) drop-shadow(0 0 13px rgba(70, 165, 255, 0.5))`;
// Regular: clearly BLUE (blue = block/parry language), just a touch lighter than
// perfect — slightly less saturation + a hair more brightness — so the perfect
// tier still reads as the richer, more intense blue.
const REGULAR_PARRY_FILTER = `grayscale(1) sepia(1) hue-rotate(185deg) saturate(2.8) brightness(1.24) drop-shadow(0 0 4px rgba(120, 195, 255, 0.6))`;

const ParrySprite = styled.div`
  position: absolute;
  left: ${(props) =>
    (props.$x / 1280) * 100 + PP_FRONT_OFFSET_PCT * (props.$facing === 1 ? 1 : 0.6)}%;
  bottom: ${(props) => (props.$y / 720) * 100 + PP_BASELINE_OFFSET_Y}%;
  width: ${(props) => props.$size}cqw;
  height: ${(props) => props.$size}cqw;
  /* translate centers on the anchor, then perspective()+rotateY tilts the single
     sprite plane left/right for a clean 3D read (matches the old ring's axis). */
  transform: translate(-50%, 50%) perspective(${PP_PERSPECTIVE}) rotateY(${PP_TILT});
  transform-origin: center;
  z-index: 168;
  pointer-events: none;
  background-image: url(${parrySheet});
  background-repeat: no-repeat;
  background-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  filter: ${(props) => (props.$isPerfect ? PERFECT_PARRY_FILTER : REGULAR_PARRY_FILTER)};
  will-change: background-position;
`;

const ppFrameToBackgroundPosition = (frame) => {
  const col = frame % PP_GRID;
  const row = Math.floor(frame / PP_GRID);
  const x = (col / (PP_GRID - 1)) * 100;
  const y = (row / (PP_GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

// Plays the sheet once, then renders nothing. Shared by BOTH parry tiers — the
// tier only changes size + recolor (via $isPerfect).
const ParrySpriteBurst = ({ x, y, facing, isPerfect }) => {
  const [frame, setFrame] = useState(PP_START_FRAME);
  const [done, setDone] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const total = PP_END_FRAME - PP_START_FRAME + 1;
    const frameDuration = PP_DURATION_MS / total;
    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= total) {
        setDone(true);
        return;
      }
      setFrame(PP_START_FRAME + idx);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (done) return null;
  const pos = ppFrameToBackgroundPosition(frame);
  return (
    <ParrySprite
      $x={x}
      $y={y}
      $facing={facing}
      $isPerfect={isPerfect}
      $size={isPerfect ? PP_SIZE_CQW_PERFECT : PP_SIZE_CQW_REGULAR}
      style={{ backgroundPosition: pos }}
    />
  );
};

ParrySpriteBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number,
  isPerfect: PropTypes.bool,
};

// ── Perfect-parry radial impact lines ────────────────────────────────────────
// Quick anime-style streaks fanning out from the parry point — extra "pop"
// reserved for the perfect tier. Each streak shoots outward from center then
// fades; plays once and unmounts with the parent effect.
const LINE_COUNT = 12;
const lineBurst = keyframes`
  0% { opacity: 0; transform: translateX(0) scaleX(0.2); }
  22% { opacity: 1; }
  100% { opacity: 0; transform: translateX(3cqw) scaleX(1); }
`;
const LinesWrap = styled.div`
  position: absolute;
  left: ${(props) =>
    (props.$x / 1280) * 100 + PP_FRONT_OFFSET_PCT * (props.$facing === 1 ? 1 : 0.6)}%;
  bottom: ${(props) => (props.$y / 720) * 100 + PP_BASELINE_OFFSET_Y}%;
  width: 0;
  height: 0;
  z-index: 167; /* behind the sprite (168) so the burst reads on top */
  pointer-events: none;
`;
const LineRotor = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
`;
const LineStreak = styled.div`
  position: absolute;
  left: 2cqw; /* small gap from the exact center */
  top: -0.16cqw;
  width: 4cqw;
  height: 0.32cqw;
  border-radius: 0.32cqw;
  background: linear-gradient(90deg, rgba(200, 235, 255, 0.95), rgba(90, 190, 255, 0));
  transform-origin: left center;
  animation: ${lineBurst} 300ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
`;
const PerfectParryLines = ({ x, y, facing }) => {
  const angles = Array.from({ length: LINE_COUNT }, (_, i) => (360 / LINE_COUNT) * i);
  return (
    <LinesWrap $x={x} $y={y} $facing={facing}>
      {angles.map((a, i) => (
        <LineRotor key={i} style={{ transform: `rotate(${a}deg)` }}>
          <LineStreak />
        </LineRotor>
      ))}
    </LinesWrap>
  );
};
PerfectParryLines.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number,
};

const RawParryEffect = ({ position }) => {
  // Track multiple active effects with unique IDs
  const [activeEffects, setActiveEffects] = useState([]);
  const processedParriesRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const EFFECT_DURATION = 800;

  // Memoize the unique identifier to prevent unnecessary re-processing
  const parryIdentifier = useMemo(() => {
    if (!position) return null;
    return position.parryId || position.timestamp;
  }, [position?.parryId, position?.timestamp]);

  useEffect(() => {
    if (!position || !parryIdentifier) return;

    // Prevent duplicate processing of the same parry
    if (processedParriesRef.current.has(parryIdentifier)) return;

    // Mark this parry as processed
    processedParriesRef.current.add(parryIdentifier);

    // Create unique effect ID
    const effectId = ++effectIdCounter.current;
    const currentTime = Date.now();

    // Create new effect with sparks
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      isPerfect: position.isPerfect || false,
      playerNumber: position.playerNumber || 1,
      startTime: currentTime,
      parryId: parryIdentifier,
    };

    // Add the new effect to active effects
    setActiveEffects((prev) => [...prev, newEffect]);

    const tid = setTimeout(() => {
      setActiveEffects((prev) =>
        prev.filter((effect) => effect.id !== effectId)
      );
      processedParriesRef.current.delete(parryIdentifier);
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [
    parryIdentifier,
    position?.x,
    position?.y,
    position?.facing,
    position?.isPerfect,
    position?.playerNumber,
  ]); // Depend on stable identifier and position values

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      setActiveEffects([]);
    };
  }, []);

  // Render all active effects
  return (
    <>
      {activeEffects.map((effect) => {
        // Perfect parry: gets a side announcement banner so the "you read
        // your opponent" callout matches the noticeability of counter
        // hit / punish / counter grab. Regular parry stays silent — the
        // burst alone is enough signal, and the absence of a banner is
        // what makes the perfect tier feel like an upgrade.
        const isLeftSide = (effect.playerNumber || 1) === 1;
        const hudEl =
          typeof document !== "undefined"
            ? document.getElementById("game-hud")
            : null;

        return (
          <Fragment key={effect.id}>
            {/* Both tiers now use the same sprite burst + tilt; the perfect tier
                is bigger, electric-blue, and gets radial impact lines, while the
                regular tier is smaller and a lighter bluish-white. */}
            <ParrySpriteBurst
              x={effect.x}
              y={effect.y}
              facing={effect.facing}
              isPerfect={effect.isPerfect}
            />
            {effect.isPerfect && (
              <PerfectParryLines
                x={effect.x}
                y={effect.y}
                facing={effect.facing}
              />
            )}
            {effect.isPerfect && hudEl && createPortal(
              <SumoAnnouncementBanner
                text="PERFECT"
                type="perfectparry"
                isLeftSide={isLeftSide}
              />,
              hudEl
            )}
          </Fragment>
        );
      })}
    </>
  );
};

RawParryEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    isPerfect: PropTypes.bool,
    parryId: PropTypes.string,
    timestamp: PropTypes.number,
    playerNumber: PropTypes.number,
  }),
};

export default RawParryEffect;
