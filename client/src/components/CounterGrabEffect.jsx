import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import clampedSheet from "../assets/clamped-effect.png";

// ── Counter-grab "LOCKED / CLAMPED" burst (sprite sheet) ─────────────────────
// Replaces the old CSS cage/ring/bars/flash/sparks + "LOCKED!" text with a hand-
// drawn 4x4 / 16-frame magenta electric burst (frame 0 empty; content 1–15). The
// art's native pink/purple already matches the counter-grab theme, so no recolor
// is needed. Played once, fast, for the same snappy read as the other sprite FX.
// The "COUNTER GRAB" side banner is kept (it's the shared announcement system).
const CL_GRID = 4;
const CL_START_FRAME = 1;
const CL_END_FRAME = 15;
const CL_DURATION_MS = 340; // 15 frames → ~23ms/frame: snappy, display-synced
const CL_SIZE_CQW = 20;
const CL_BASELINE_OFFSET_Y = 0;
const CL_CENTER_OFFSET_X = 0;

const ClampSprite = styled.div`
  position: absolute;
  left: ${(props) => (props.$x / 1280) * 100 + CL_CENTER_OFFSET_X}%;
  bottom: ${(props) => (props.$y / 720) * 100 + CL_BASELINE_OFFSET_Y}%;
  width: ${CL_SIZE_CQW}cqw;
  height: ${CL_SIZE_CQW}cqw;
  transform: translate(-50%, 50%);
  transform-origin: center;
  z-index: 170;
  pointer-events: none;
  background-image: url(${clampedSheet});
  background-repeat: no-repeat;
  background-size: ${CL_GRID * 100}% ${CL_GRID * 100}%;
  /* Keep the native magenta; a faint pink bloom sells the electric snap. */
  filter: saturate(1.15) brightness(1.1) drop-shadow(0 0 5px rgba(255, 50, 120, 0.35));
  will-change: background-position;
`;

const clFrameToBackgroundPosition = (frame) => {
  const col = frame % CL_GRID;
  const row = Math.floor(frame / CL_GRID);
  const x = (col / (CL_GRID - 1)) * 100;
  const y = (row / (CL_GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

// Plays the sheet once, then renders nothing.
const ClampSpriteBurst = ({ x, y }) => {
  const [frame, setFrame] = useState(CL_START_FRAME);
  const [done, setDone] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const total = CL_END_FRAME - CL_START_FRAME + 1;
    const frameDuration = CL_DURATION_MS / total;
    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= total) {
        setDone(true);
        return;
      }
      setFrame(CL_START_FRAME + idx);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (done) return null;
  return (
    <ClampSprite
      $x={x}
      $y={y}
      style={{ backgroundPosition: clFrameToBackgroundPosition(frame) }}
    />
  );
};

ClampSpriteBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
};

const CounterGrabEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedCountersRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  // Kept longer than the sprite so the COUNTER GRAB banner (portal) can play out
  // its own animation; the sprite unmounts itself after its short burst.
  const EFFECT_DURATION = 1600;

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedCountersRef.current.has(position.counterId)) {
      setActiveEffects((prev) =>
        prev.map((effect) =>
          effect.counterId === position.counterId
            ? {
                ...effect,
                x: position.x,
                y: position.y,
                grabberPlayerNumber:
                  position.grabberPlayerNumber || effect.grabberPlayerNumber,
              }
            : effect
        )
      );
      return;
    }

    processedCountersRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      counterId: position.counterId,
      x: position.x,
      y: position.y,
      grabberPlayerNumber: position.grabberPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [position?.counterId, position?.x, position?.y, position?.grabberPlayerNumber]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      processedCountersRef.current.clear();
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.grabberPlayerNumber === 1;
        const hudEl = document.getElementById("game-hud-callouts");

        return (
          <div key={effect.id}>
            <ClampSpriteBurst x={effect.x} y={effect.y} />
            {hudEl &&
              createPortal(
                <SumoAnnouncementBanner
                  text={"COUNTER\nGRAB"}
                  type="countergrab"
                  isLeftSide={isLeftSide}
                />,
                hudEl
              )}
          </div>
        );
      })}
    </>
  );
};

CounterGrabEffect.propTypes = {
  position: PropTypes.shape({
    type: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    counterId: PropTypes.string,
    grabberPlayerNumber: PropTypes.number,
  }),
};

export default memo(CounterGrabEffect);
