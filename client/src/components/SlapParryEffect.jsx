import { useEffect, useState, useRef, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import parrySheet from "../assets/grab-break-effect.png";

// TEST: slap parry now reuses the grab-break burst sprite in its WHITE default
// (no green recolor). Same 4x4 / frames 1–15 sheet, played once, but smaller and
// a touch quicker to suit the fast, frequent slap-parry clash. The old CSS
// ring/cross/bloom/core/afterglow layers are disabled.
const GRID = 4;
const START_FRAME = 1; // frame 0 is empty
const END_FRAME = 15;
const DURATION_MS = 280; // 15 frames → ~19ms/frame: snappy for a rapid parry
const SIZE_CQW = 11; // smaller than the grab break's 14 (parry is a lighter beat)
const BASELINE_OFFSET_Y = 4; // matches the previous slap-parry vertical placement

const SpriteContainer = styled.div`
  position: absolute;
  left: ${(props) => (props.$x / 1280) * 100}%;
  bottom: ${(props) => (props.$y / 720) * 100 + BASELINE_OFFSET_Y}%;
  width: ${SIZE_CQW}cqw;
  height: ${SIZE_CQW}cqw;
  transform: translate(-50%, 50%);
  transform-origin: center;
  z-index: 100;
  pointer-events: none;
  /* White default: the sheet is already pure white with its shape in the alpha
     channel, so drawing it directly keeps the bright flash. A soft white glow
     gives it presence against the scene without tinting it. */
  background-image: url(${parrySheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.55));
  will-change: background-position;
`;

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

// Plays the sheet once, then removes itself via onDone.
const ParryBurst = ({ x, y, onDone }) => {
  const [frame, setFrame] = useState(START_FRAME);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const totalFrames = END_FRAME - START_FRAME + 1;
    const frameDuration = DURATION_MS / totalFrames;

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= totalFrames) {
        onDoneRef.current();
        return;
      }
      setFrame(START_FRAME + idx);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pos = frameToBackgroundPosition(frame);
  return (
    <SpriteContainer
      $x={x}
      $y={y}
      style={{ backgroundPosition: pos }}
    />
  );
};

ParryBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  onDone: PropTypes.func.isRequired,
};

const SlapParryEffect = ({ position }) => {
  const [bursts, setBursts] = useState([]);
  const idRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (!position) return;
    // Each parry hands in a fresh position object; ignore identical references
    // so we don't double-spawn on unrelated re-renders.
    if (position === lastPosRef.current) return;
    lastPosRef.current = position;
    const id = ++idRef.current;
    setBursts((prev) => [...prev, { id, x: position.x, y: position.y }]);
  }, [position]);

  const handleDone = (id) =>
    setBursts((prev) => prev.filter((b) => b.id !== id));

  return (
    <>
      {bursts.map((b) => (
        <ParryBurst key={b.id} x={b.x} y={b.y} onDone={() => handleDone(b.id)} />
      ))}
    </>
  );
};

SlapParryEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }),
};

export default memo(SlapParryEffect);
