import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import grabBreakSheet from "../assets/grab-break-effect.png";

// ── Sprite sheet layout (grab break burst) ───────────────────────────────────
// 2048x2048 image, a 4x4 grid of 512x512 frames, read left→right, top→bottom.
// Content lives in frames 1–15 (big green star peaks at 1–2, long sparkle tail);
// frame 0 is empty.
const GRID = 4;
const START_FRAME = 1;
const END_FRAME = 15;
const DURATION_MS = 300; // 15 frames → ~20ms/frame (~50fps): snappy, display-synced
const SIZE_CQW = 14; // grab break is a notable event — a bit larger than a hit

// Keep the whole effect (mainly the banner) alive this long; the sprite plays
// once inside this window then disappears.
const EFFECT_DURATION = 1600;

const EFFECT_CENTER_OFFSET_X = 0;
const EFFECT_BASELINE_OFFSET_Y = -3; // nudge the burst down a touch toward the players

// The source sheet is pure white with all shape/intensity in its alpha channel.
// To recolor it green WHILE keeping the original bright-white flash cores, we
// layer the white sheet (background-image) on top of a neon-green fill and clip
// both with the SAME sheet as an alpha mask:
//   • high-alpha pixels (cores/spikes) stay white → the hot flash is preserved
//   • softer pixels fall off to neon green → the body/halo reads green
// A layered green drop-shadow adds the "neon" glow.
const NEON_GREEN = "#3bff5a";
const NEON_GREEN_GLOW = "rgba(75, 255, 110, 0.65)";

const SpriteContainer = styled.div`
  position: absolute;
  left: ${(props) => (props.$x / 1280) * 100 + EFFECT_CENTER_OFFSET_X}%;
  bottom: ${(props) => (props.$y / 720) * 100 + EFFECT_BASELINE_OFFSET_Y}%;
  width: ${SIZE_CQW}cqw;
  height: ${SIZE_CQW}cqw;
  transform: translate(-50%, 50%);
  transform-origin: center;
  z-index: 170;
  pointer-events: none;
  background-color: ${NEON_GREEN};
  background-image: url(${grabBreakSheet});
  background-repeat: no-repeat;
  background-size: ${GRID * 100}% ${GRID * 100}%;
  -webkit-mask-image: url(${grabBreakSheet});
  mask-image: url(${grabBreakSheet});
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${GRID * 100}% ${GRID * 100}%;
  mask-size: ${GRID * 100}% ${GRID * 100}%;
  filter: drop-shadow(0 0 6px ${NEON_GREEN_GLOW})
    drop-shadow(0 0 14px ${NEON_GREEN_GLOW});
  will-change: background-position, -webkit-mask-position, mask-position;
`;

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

// Plays the sheet once, then renders nothing (parent keeps the banner alive).
const GrabBreakBurst = ({ x, y }) => {
  const [frame, setFrame] = useState(START_FRAME);
  const [done, setDone] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const totalFrames = END_FRAME - START_FRAME + 1;
    const frameDuration = DURATION_MS / totalFrames;

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= totalFrames) {
        setDone(true);
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

  if (done) return null;

  const pos = frameToBackgroundPosition(frame);

  return (
    <SpriteContainer
      $x={x}
      $y={y}
      style={{
        backgroundPosition: pos,
        WebkitMaskPosition: pos,
        maskPosition: pos,
      }}
    />
  );
};

GrabBreakBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
};

const GrabBreakEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedBreaksRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);

  useEffect(() => {
    if (!position || !position.breakId) return;
    if (processedBreaksRef.current.has(position.breakId)) return;

    processedBreaksRef.current.add(position.breakId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      breakerPlayerNumber: position.breakerPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedBreaksRef.current.delete(position.breakId);
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [position?.breakId, position?.x, position?.y, position?.breakerPlayerNumber]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.breakerPlayerNumber === 1;

        return (
          <div key={effect.id}>
            <GrabBreakBurst x={effect.x} y={effect.y} />
            {document.getElementById("game-hud-callouts") &&
              createPortal(
                <SumoAnnouncementBanner
                  text={"GRAB\nBREAK"}
                  type="break"
                  isLeftSide={isLeftSide}
                />,
                document.getElementById("game-hud-callouts")
              )}
          </div>
        );
      })}
    </>
  );
};

GrabBreakEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    breakId: PropTypes.string,
    breakerPlayerNumber: PropTypes.number,
  }),
};

export default memo(GrabBreakEffect);
