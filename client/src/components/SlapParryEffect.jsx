import { useEffect, useState, useRef, memo, Fragment } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import parrySheet from "../assets/raw-parry-effect.png";
import {
  parryFilterFor,
  PerfectParryExtras,
} from "./parryVfxShared";

// ATTACK PARRY (AP) burst — same expanding-ring sheet as snowball/raw parry.
// Regular = steel cyan. Perfect = hotter electric ice-cyan + impact punch
// layers (flash / banner). Scale punch lives on the VFX wrapper so the camera
// never zooms.
const GRID = 8;
const START_FRAME = 8;
const END_FRAME = 63;
const DURATION_MS = 360;
// Perfect sheet linger — spans the ~280ms hitstop + a short post-freeze trail.
const PERFECT_DURATION_MS = 580;
const SIZE_CQW = 13.5;
const PERFECT_SIZE_CQW = 19.5;
const CHAIN_SIZE_STEP = 0.5;
const CHAIN_SIZE_MAX = 3;
const PERSPECTIVE = "400px";
const TILT_DEG = 62;

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
  transform: perspective(${PERSPECTIVE})
    rotateY(${(p) => (p.$facing === -1 ? TILT_DEG : -TILT_DEG)}deg);
  transform-origin: center;
  background-image: url(${parrySheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
  filter: ${(p) => p.$filter};
`;

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const ParryBurst = ({ x, y, facing, variant, size, onDone }) => {
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

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= totalFrames) {
        onDoneRef.current();
        return;
      }
      if (idx !== lastIdx && elRef.current) {
        lastIdx = idx;
        elRef.current.style.backgroundPosition = frameToBackgroundPosition(
          START_FRAME + idx
        );
      }
      rafRef.current = requestAnimationFrame(step);
    };

    if (elRef.current) {
      elRef.current.style.backgroundPosition =
        frameToBackgroundPosition(START_FRAME);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPerfect]);

  return (
    <Anchor $x={x} $y={y} $size={size} $isPerfect={isPerfect}>
      <SpritePlane
        ref={elRef}
        $facing={facing}
        $filter={parryFilterFor(isPerfect)}
      />
    </Anchor>
  );
};

ParryBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number,
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
        facing: position.facing || 1,
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
            facing={b.facing}
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
