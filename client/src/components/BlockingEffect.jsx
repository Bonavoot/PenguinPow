import { useEffect, useState, useRef, useMemo, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import blockingSheet from "../assets/blocking-effect.png";

// Guard-block absorb burst — 8x8 sheet, frames 4→63, facing-signed 2.5D tilt.
// Frame stepping writes background-position on a DOM ref (no per-frame
// React setState) — the old setState-every-rAF path on a 2048² + perspective
// layer was thrashing the GPU compositor.
const GRID = 8;
const START_FRAME = 4;
const END_FRAME = 63;
/** VFX hold when a guard absorbs a hit. */
export const BLOCK_EFFECT_DURATION_MS = 420;
/** SUCCESS pose hold (cosmetic only — does not touch hitstop / guard timing).
 *  Kept under slap cadence (~230ms) so a flurry still returns to attempting
 *  and can re-fire block-parry.png between chips. */
export const BLOCK_SUCCESS_POSE_MS = 180;
const DURATION_MS = BLOCK_EFFECT_DURATION_MS;
const SIZE_CQW = 16;
const PERSPECTIVE = "400px";
const TILT_DEG = 62;

const SpriteContainer = styled.div`
  position: absolute;
  left: ${(props) => (props.$x / 1280) * 100}%;
  bottom: ${(props) => (props.$y / 720) * 100}%;
  width: ${SIZE_CQW}cqw;
  height: ${SIZE_CQW}cqw;
  transform: translate(-50%, 50%) perspective(${PERSPECTIVE})
    rotateY(${(props) => (props.$facing === -1 ? TILT_DEG : -TILT_DEG)}deg);
  transform-origin: center;
  z-index: 100;
  pointer-events: none;
  background-image: url(${blockingSheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
`;

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const BlockBurst = ({ x, y, facing, onDone }) => {
  const elRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const totalFrames = END_FRAME - START_FRAME + 1;
    const frameDuration = DURATION_MS / totalFrames;
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
  }, []);

  return <SpriteContainer ref={elRef} $x={x} $y={y} $facing={facing} />;
};

BlockBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number,
  onDone: PropTypes.func.isRequired,
};

const BlockingEffect = ({ position }) => {
  const [bursts, setBursts] = useState([]);
  const idRef = useRef(0);
  const processedRef = useRef(new Set());

  const blockIdentifier = useMemo(() => {
    if (!position) return null;
    return position.blockId || position.timestamp;
  }, [position?.blockId, position?.timestamp]);

  useEffect(() => {
    if (!position || !blockIdentifier) return;
    if (processedRef.current.has(blockIdentifier)) return;
    processedRef.current.add(blockIdentifier);
    const id = ++idRef.current;
    setBursts((prev) => [
      ...prev,
      {
        id,
        blockId: blockIdentifier,
        x: position.x,
        y: position.y,
        facing: position.facing || 1,
      },
    ]);
  }, [blockIdentifier, position?.x, position?.y, position?.facing]);

  const handleDone = (id) =>
    setBursts((prev) => {
      const finished = prev.find((b) => b.id === id);
      if (finished) processedRef.current.delete(finished.blockId);
      return prev.filter((b) => b.id !== id);
    });

  return (
    <>
      {bursts.map((b) => (
        <BlockBurst
          key={b.id}
          x={b.x}
          y={b.y}
          facing={b.facing}
          onDone={() => handleDone(b.id)}
        />
      ))}
    </>
  );
};

BlockingEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    blockId: PropTypes.string,
    timestamp: PropTypes.number,
  }),
};

export default memo(BlockingEffect, (prevProps, nextProps) => {
  if (!prevProps.position && !nextProps.position) return true;
  if (!prevProps.position || !nextProps.position) return false;
  return (
    prevProps.position.blockId === nextProps.position.blockId &&
    prevProps.position.timestamp === nextProps.position.timestamp
  );
});
