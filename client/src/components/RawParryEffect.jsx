import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";
import grabBreakSheet from "../assets/grab-break-effect.png";
import { PerfectParryExtras } from "./parryVfxShared";

// ── Raw / snowball parry burst ──────────────────────────────────────────────
// Same grab-break star sheet as AP. Regular = steel cyan. Perfect = electric
// ice-cyan + impact flash / banner. Scale punch is on the VFX, not the camera.
const PP_GRID = 4;
const PP_START_FRAME = 1;
const PP_END_FRAME = 15;
const PP_DURATION_MS = 360;
const PP_PERFECT_DURATION_MS = 520;
const PP_SIZE_CQW_PERFECT = 11;
const PP_SIZE_CQW_REGULAR = 8.5;
const PP_BASELINE_OFFSET_Y = 0;
const PP_FRONT_OFFSET_PCT = -4;

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
  left: ${(p) =>
    (p.$x / 1280) * 100 +
    PP_FRONT_OFFSET_PCT * (p.$facing === 1 ? 1 : 0.6)}%;
  bottom: ${(p) => (p.$y / 720) * 100 + PP_BASELINE_OFFSET_Y}%;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  transform: translate(-50%, 50%);
  transform-origin: center;
  z-index: 168;
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
  background-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  -webkit-mask-image: url(${grabBreakSheet});
  mask-image: url(${grabBreakSheet});
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  mask-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  filter: ${(p) =>
    p.$isPerfect
      ? `drop-shadow(0 0 3px rgba(220, 250, 255, 1))
         drop-shadow(0 0 10px ${PERFECT_GLOW})
         drop-shadow(0 0 22px rgba(40, 180, 255, 0.55))`
      : `drop-shadow(0 0 4px ${REGULAR_GLOW})
         drop-shadow(0 0 12px ${REGULAR_GLOW})`};
  will-change: background-position, -webkit-mask-position, mask-position;
`;

const ppFrameToBackgroundPosition = (frame) => {
  const col = frame % PP_GRID;
  const row = Math.floor(frame / PP_GRID);
  const x = (col / (PP_GRID - 1)) * 100;
  const y = (row / (PP_GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const ParrySpriteBurst = ({ x, y, facing, isPerfect }) => {
  const [done, setDone] = useState(false);
  const elRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const total = PP_END_FRAME - PP_START_FRAME + 1;
    const duration = isPerfect ? PP_PERFECT_DURATION_MS : PP_DURATION_MS;
    const frameDuration = duration / total;
    let lastIdx = -1;

    const applyPos = (frame) => {
      const pos = ppFrameToBackgroundPosition(frame);
      if (!elRef.current) return;
      elRef.current.style.backgroundPosition = pos;
      elRef.current.style.webkitMaskPosition = pos;
      elRef.current.style.maskPosition = pos;
    };

    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= total) {
        setDone(true);
        return;
      }
      if (idx !== lastIdx) {
        lastIdx = idx;
        applyPos(PP_START_FRAME + idx);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    applyPos(PP_START_FRAME);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPerfect]);

  if (done) return null;
  return (
    <Anchor
      $x={x}
      $y={y}
      $facing={facing}
      $isPerfect={isPerfect}
      $size={isPerfect ? PP_SIZE_CQW_PERFECT : PP_SIZE_CQW_REGULAR}
    >
      <SpritePlane ref={elRef} $isPerfect={isPerfect} />
    </Anchor>
  );
};

ParrySpriteBurst.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number,
  isPerfect: PropTypes.bool,
};

const RawParryEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedParriesRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const EFFECT_DURATION = 920;

  const parryIdentifier = useMemo(() => {
    if (!position) return null;
    return position.parryId || position.timestamp;
  }, [position?.parryId, position?.timestamp]);

  useEffect(() => {
    if (!position || !parryIdentifier) return;
    if (processedParriesRef.current.has(parryIdentifier)) return;

    processedParriesRef.current.add(parryIdentifier);

    const effectId = ++effectIdCounter.current;
    const currentTime = Date.now();

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
  ]);

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
        // Front-offset for extras must match the sprite anchor so flash/lines
        // sit on the same clash point as the burst.
        const frontPct =
          PP_FRONT_OFFSET_PCT * (effect.facing === 1 ? 1 : 0.6);
        const worldX = effect.x + (frontPct / 100) * 1280;

        return (
          <Fragment key={effect.id}>
            <ParrySpriteBurst
              x={effect.x}
              y={effect.y}
              facing={effect.facing}
              isPerfect={effect.isPerfect}
            />
            {effect.isPerfect && (
              <PerfectParryExtras
                x={worldX}
                y={effect.y}
                playerNumber={effect.playerNumber}
                showBanner
              />
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
