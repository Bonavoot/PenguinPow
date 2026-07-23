import { useEffect, useState, useRef, memo, Fragment } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import grabBreakSheet from "../assets/grab-break-effect.png";
import { PerfectParryExtras } from "./parryVfxShared";

// ATTACK PARRY (AP) burst — grab-break star sheet, recolored per tier.
// Regular = steel cyan. Perfect = hotter electric ice-cyan + impact punch
// layers (flash / banner). Scale punch lives on the VFX wrapper so the camera
// never zooms.
//
// Sheet: 4×4 of 512px frames (pure white + alpha). Frame 0 empty; 1–15 play.
// Recolor via the same mask+fill trick as GrabBreakEffect so hot cores stay
// white while the body/halo picks up the tier color.
const GRID = 4;
const START_FRAME = 1;
const END_FRAME = 15;
const DURATION_MS = 320;
// Perfect sheet linger — spans the hitstop beat + a short post-freeze trail.
const PERFECT_DURATION_MS = 520;
const SIZE_CQW = 8.5;
const PERFECT_SIZE_CQW = 11;
const CHAIN_SIZE_STEP = 0.5;
const CHAIN_SIZE_MAX = 3;

const REGULAR_FILL = "#4ec8ff";
const REGULAR_GLOW = "rgba(120, 195, 255, 0.65)";
const PERFECT_FILL = "#7af0ff";
const PERFECT_GLOW = "rgba(0, 220, 255, 0.9)";

const punchIn = keyframes`
  0%   { transform: translate(-50%, 50%) scale(0.72); }
  18%  { transform: translate(-50%, 50%) scale(1.12); }
  45%  { transform: translate(-50%, 50%) scale(0.98); }
  100% { transform: translate(-50%, 50%) scale(1); }
`;

const Anchor = styled.div`
  position: absolute;
  left: ${(p) => (p.$x / 1280) * 100}%;
  bottom: ${(p) => (p.$y / 720) * 100}%;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  transform: translate(-50%, 50%);
  transform-origin: center;
  z-index: 100;
  pointer-events: none;
  animation: ${(p) => (p.$isPerfect ? punchIn : "none")} 160ms
    cubic-bezier(0.16, 0.9, 0.3, 1) both;
  will-change: ${(p) => (p.$isPerfect ? "transform" : "auto")};
`;

const SpritePlane = styled.div`
  width: 100%;
  height: 100%;
  background-color: ${(p) => (p.$isPerfect ? PERFECT_FILL : REGULAR_FILL)};
  background-image: url(${grabBreakSheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
  -webkit-mask-image: url(${grabBreakSheet});
  mask-image: url(${grabBreakSheet});
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${GRID * 100}% ${GRID * 100}%;
  mask-size: ${GRID * 100}% ${GRID * 100}%;
  filter: ${(p) =>
    p.$isPerfect
      ? `drop-shadow(0 0 3px rgba(220, 250, 255, 1))
         drop-shadow(0 0 10px ${PERFECT_GLOW})
         drop-shadow(0 0 22px rgba(40, 180, 255, 0.55))`
      : `drop-shadow(0 0 4px ${REGULAR_GLOW})
         drop-shadow(0 0 12px ${REGULAR_GLOW})`};
  will-change: background-position, -webkit-mask-position, mask-position;
`;

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const ParryBurst = ({ x, y, variant, size, onDone }) => {
  const elRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const isPerfect = variant === "perfect";

  useEffect(() => {
    const totalFrames = END_FRAME - START_FRAME + 1;
    const duration = isPerfect ? PERFECT_DURATION_MS : DURATION_MS;
    const frameDuration = duration / totalFrames;
    let lastIdx = -1;

    const applyPos = (frame) => {
      const pos = frameToBackgroundPosition(frame);
      if (!elRef.current) return;
      elRef.current.style.backgroundPosition = pos;
      elRef.current.style.webkitMaskPosition = pos;
      elRef.current.style.maskPosition = pos;
    };

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= totalFrames) {
        onDoneRef.current();
        return;
      }
      if (idx !== lastIdx) {
        lastIdx = idx;
        applyPos(START_FRAME + idx);
      }
      rafRef.current = requestAnimationFrame(step);
    };

    applyPos(START_FRAME);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPerfect]);

  return (
    <Anchor $x={x} $y={y} $size={size} $isPerfect={isPerfect}>
      <SpritePlane ref={elRef} $isPerfect={isPerfect} />
    </Anchor>
  );
};

ParryBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  variant: PropTypes.string,
  size: PropTypes.number.isRequired,
  onDone: PropTypes.func.isRequired,
};

const SlapParryEffect = ({ position }) => {
  const [bursts, setBursts] = useState([]);
  const idRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (!position) return;
    if (position === lastPosRef.current) return;
    lastPosRef.current = position;
    const id = ++idRef.current;
    const variant = position.variant || "parry";
    const isPerfect = variant === "perfect" || !!position.isPerfect;
    const chainGrow = Math.min(
      (Math.max(position.chain || 1, 1) - 1) * CHAIN_SIZE_STEP,
      CHAIN_SIZE_MAX
    );
    const size =
      (isPerfect ? PERFECT_SIZE_CQW : SIZE_CQW) + chainGrow;
    setBursts((prev) => [
      ...prev,
      {
        id,
        x: position.x,
        y: position.y,
        variant: isPerfect ? "perfect" : "parry",
        size,
        playerNumber: position.playerNumber || 1,
      },
    ]);
  }, [position]);

  const handleDone = (id) =>
    setBursts((prev) => prev.filter((b) => b.id !== id));

  return (
    <>
      {bursts.map((b) => (
        <Fragment key={b.id}>
          <ParryBurst
            x={b.x}
            y={b.y}
            variant={b.variant}
            size={b.size}
            onDone={() => handleDone(b.id)}
          />
          {b.variant === "perfect" && (
            <PerfectParryExtras
              x={b.x}
              y={b.y}
              playerNumber={b.playerNumber}
              showBanner
            />
          )}
        </Fragment>
      ))}
    </>
  );
};

SlapParryEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    variant: PropTypes.string,
    chain: PropTypes.number,
    isPerfect: PropTypes.bool,
    playerNumber: PropTypes.number,
  }),
};

export default memo(SlapParryEffect);
