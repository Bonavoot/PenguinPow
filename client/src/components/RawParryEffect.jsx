import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";
import parrySheet from "../assets/raw-parry-effect.png";
import {
  parryFilterFor,
  PerfectParryExtras,
} from "./parryVfxShared";

// ── Raw / snowball parry burst ──────────────────────────────────────────────
// Same sheet as AP. Regular = steel cyan. Perfect = electric ice-cyan +
// impact flash / banner. Scale punch is on the VFX, not the camera.
const PP_GRID = 8;
const PP_START_FRAME = 8;
const PP_END_FRAME = 63;
const PP_DURATION_MS = 460;
// Perfect sheet linger — spans the hitstop beat + a short post-freeze trail.
const PP_PERFECT_DURATION_MS = 640;
const PP_SIZE_CQW_PERFECT = 20.5;
const PP_SIZE_CQW_REGULAR = 13.5;
const PP_BASELINE_OFFSET_Y = 0;
const PP_FRONT_OFFSET_PCT = -4;
const PP_PERSPECTIVE = "400px";
const PP_TILT_DEG = 62;

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
  transform: perspective(${PP_PERSPECTIVE})
    rotateY(${(p) => (p.$facing === -1 ? PP_TILT_DEG : -PP_TILT_DEG)}deg);
  transform-origin: center;
  background-image: url(${parrySheet});
  background-repeat: no-repeat;
  background-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  filter: ${(p) => p.$filter};
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
    const step = (t) => {
      if (startRef.current === null) startRef.current = t;
      const idx = Math.floor((t - startRef.current) / frameDuration);
      if (idx >= total) {
        setDone(true);
        return;
      }
      if (idx !== lastIdx && elRef.current) {
        lastIdx = idx;
        elRef.current.style.backgroundPosition = ppFrameToBackgroundPosition(
          PP_START_FRAME + idx
        );
      }
      rafRef.current = requestAnimationFrame(step);
    };
    if (elRef.current) {
      elRef.current.style.backgroundPosition = ppFrameToBackgroundPosition(
        PP_START_FRAME
      );
    }
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
      <SpritePlane
        ref={elRef}
        $facing={facing}
        $filter={parryFilterFor(isPerfect)}
      />
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
