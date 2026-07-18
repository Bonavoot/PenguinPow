import { useEffect, useState, useRef, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import parrySheet from "../assets/raw-parry-effect.png";

// ATTACK PARRY (AP) burst — same expanding-ring sheet as snowball/raw parry
// (raw-parry-effect.png), with the classic perfect = hot electric blue /
// regular = lighter steel-blue recolor. 8x4 padded columns; short duration
// auto-skips dupes. Frame steps write background-position on a DOM ref.
const GRID = 8;
const START_FRAME = 8; // 0–7 ~empty
const END_FRAME = 63;
const DURATION_MS = 360;
const PERFECT_DURATION_MS = 420;
// Perfect = former regular size; regular steps down so the hierarchy still reads.
const SIZE_CQW = 13.5;
const PERFECT_SIZE_CQW = 19;
const CHAIN_SIZE_STEP = 0.5;
const CHAIN_SIZE_MAX = 3;
const PERSPECTIVE = "400px";
const TILT_DEG = 62;

// Perfect = warm gold (matches the perfect-parry rim). Regular = soft steel-cyan.
const AP_BLUE_FILTER = `grayscale(1) sepia(1) hue-rotate(185deg) saturate(2.8) brightness(1.24) drop-shadow(0 0 4px rgba(120, 195, 255, 0.6))`;
const AP_PERFECT_FILTER = `grayscale(1) sepia(1) hue-rotate(8deg) saturate(4.2) brightness(1.35) drop-shadow(0 0 4px rgba(255, 230, 140, 1)) drop-shadow(0 0 12px rgba(255, 190, 60, 0.9))`;

const filterFor = (variant) =>
  variant === "perfect" ? AP_PERFECT_FILTER : AP_BLUE_FILTER;

const baseSizeFor = (variant) =>
  variant === "perfect" ? PERFECT_SIZE_CQW : SIZE_CQW;

const SpriteContainer = styled.div`
  position: absolute;
  left: ${(props) => (props.$x / 1280) * 100}%;
  bottom: ${(props) => (props.$y / 720) * 100}%;
  width: ${(props) => props.$size}cqw;
  height: ${(props) => props.$size}cqw;
  transform: translate(-50%, 50%) perspective(${PERSPECTIVE})
    rotateY(${(props) => (props.$facing === -1 ? TILT_DEG : -TILT_DEG)}deg);
  transform-origin: center;
  z-index: 100;
  pointer-events: none;
  background-image: url(${parrySheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
  filter: ${(props) => props.$filter};
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

  useEffect(() => {
    const totalFrames = END_FRAME - START_FRAME + 1;
    const duration = variant === "perfect" ? PERFECT_DURATION_MS : DURATION_MS;
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
  }, [variant]);

  return (
    <SpriteContainer
      ref={elRef}
      $x={x}
      $y={y}
      $facing={facing}
      $size={size}
      $filter={filterFor(variant)}
    />
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
    const chainGrow = Math.min(
      (Math.max(position.chain || 1, 1) - 1) * CHAIN_SIZE_STEP,
      CHAIN_SIZE_MAX
    );
    const size = baseSizeFor(variant) + chainGrow;
    setBursts((prev) => [
      ...prev,
      {
        id,
        x: position.x,
        y: position.y,
        facing: position.facing || 1,
        variant,
        size,
      },
    ]);
  }, [position]);

  const handleDone = (id) =>
    setBursts((prev) => prev.filter((b) => b.id !== id));

  return (
    <>
      {bursts.map((b) => (
        <ParryBurst
          key={b.id}
          x={b.x}
          y={b.y}
          facing={b.facing}
          variant={b.variant}
          size={b.size}
          onDone={() => handleDone(b.id)}
        />
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
  }),
};

export default memo(SlapParryEffect);
