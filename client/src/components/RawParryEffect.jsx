import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";
import grabBreakSheet from "../assets/grab-break-effect.png";
import {
  PerfectParryExtras,
  RegularParryContactFlash,
} from "./parryVfxShared";
import SumoHypeStamp, { HYPE_DURATION_MS } from "./SumoHypeStamp";

// ── Raw / snowball parry burst ──────────────────────────────────────────────
// Same grab-break star sheet as AP. Regular = steel cyan + contact pin + soft
// underplate. Perfect = electric ice-cyan + impact flash / banner. Scale punch
// is on the VFX, not the camera.
const PP_GRID = 4;
const PP_START_FRAME = 1;
const PP_END_FRAME = 15;
const PP_DURATION_MS = 360;
const PP_PERFECT_DURATION_MS = 520;
const PP_SIZE_CQW_PERFECT = 11;
const PP_SIZE_CQW_REGULAR = 8.5;
const PP_BASELINE_OFFSET_Y = 0;
const PP_FRONT_OFFSET_PCT = -4;

const PERSPECTIVE = "420px";
const TILT_Y_DEG = 22;
const TILT_X_DEG = 10;
const STRETCH_X = 1.12;

const REGULAR_FILL = "#5ad0ff";
const REGULAR_GLOW = "rgba(140, 210, 255, 0.75)";
const PERFECT_FILL = "#7af0ff";
const PERFECT_GLOW = "rgba(0, 220, 255, 0.9)";

const perfectPunchIn = keyframes`
  0%   { scale: 0.72; }
  18%  { scale: 1.12; }
  45%  { scale: 0.98; }
  100% { scale: 1; }
`;

const regularContactPop = keyframes`
  0%   { scale: 0.86; }
  40%  { scale: 1.05; }
  100% { scale: 1; }
`;

const Anchor = styled.div`
  position: absolute;
  left: ${(p) =>
    (p.$x / 1280) * 100 +
    PP_FRONT_OFFSET_PCT * (p.$facing === 1 ? 1 : 0.6)}%;
  bottom: ${(p) => (p.$y / 720) * 100 + PP_BASELINE_OFFSET_Y}%;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  z-index: 170;
  pointer-events: none;
  transform: translate(-50%, 50%) perspective(${PERSPECTIVE})
    rotateY(
      ${(p) => (p.$facing === -1 ? TILT_Y_DEG : -TILT_Y_DEG)}deg
    )
    rotateX(${TILT_X_DEG}deg) scaleX(${STRETCH_X});
  transform-origin: center;
`;

const PopWrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  scale: 1;
  animation: ${(p) => (p.$isPerfect ? perfectPunchIn : regularContactPop)}
    ${(p) => (p.$isPerfect ? "160ms" : "130ms")}
    cubic-bezier(0.16, 0.9, 0.3, 1) both;
  will-change: scale;
`;

const sheetMask = `
  background-image: url(${grabBreakSheet});
  background-repeat: no-repeat;
  background-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  -webkit-mask-image: url(${grabBreakSheet});
  mask-image: url(${grabBreakSheet});
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
  mask-size: ${PP_GRID * 100}% ${PP_GRID * 100}%;
`;

const ThickPlate = styled.div`
  position: absolute;
  inset: -6%;
  ${sheetMask}
  background-color: ${(p) => (p.$isPerfect ? PERFECT_FILL : REGULAR_FILL)};
  opacity: ${(p) => (p.$isPerfect ? 0.5 : 0.62)};
  filter: blur(1.6px)
    drop-shadow(
      0 0 6px
        ${(p) => (p.$isPerfect ? PERFECT_GLOW : "rgba(120, 200, 255, 0.55)")}
    );
  transform: scale(1.06);
  pointer-events: none;
`;

const SpritePlane = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  ${sheetMask}
  background-color: ${(p) => (p.$isPerfect ? PERFECT_FILL : REGULAR_FILL)};
  filter: ${(p) =>
    p.$isPerfect
      ? `drop-shadow(0 0 3px rgba(220, 250, 255, 1))
         drop-shadow(0 0 10px ${PERFECT_GLOW})
         drop-shadow(0 0 22px rgba(40, 180, 255, 0.55))`
      : `drop-shadow(0 0 2px rgba(255, 255, 255, 0.85))
         drop-shadow(0 0 5px ${REGULAR_GLOW})
         drop-shadow(0 0 14px ${REGULAR_GLOW})`};
  will-change: background-position, -webkit-mask-position, mask-position;
`;

const ppFrameToBackgroundPosition = (frame) => {
  const col = frame % PP_GRID;
  const row = Math.floor(frame / PP_GRID);
  const x = (col / (PP_GRID - 1)) * 100;
  const y = (row / (PP_GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const applySheetPos = (el, pos) => {
  if (!el) return;
  el.style.backgroundPosition = pos;
  el.style.webkitMaskPosition = pos;
  el.style.maskPosition = pos;
};

const ParrySpriteBurst = ({ x, y, facing, isPerfect }) => {
  const [done, setDone] = useState(false);
  const sharpRef = useRef(null);
  const plateRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const total = PP_END_FRAME - PP_START_FRAME + 1;
    const duration = isPerfect ? PP_PERFECT_DURATION_MS : PP_DURATION_MS;
    const frameDuration = duration / total;
    let lastIdx = -1;

    const applyPos = (frame) => {
      const pos = ppFrameToBackgroundPosition(frame);
      applySheetPos(sharpRef.current, pos);
      applySheetPos(plateRef.current, pos);
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
      $size={isPerfect ? PP_SIZE_CQW_PERFECT : PP_SIZE_CQW_REGULAR}
    >
      <PopWrap $isPerfect={isPerfect}>
        <ThickPlate ref={plateRef} $isPerfect={isPerfect} />
        <SpritePlane ref={sharpRef} $isPerfect={isPerfect} />
      </PopWrap>
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
  const [banners, setBanners] = useState([]);
  const processedParriesRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  // Sprite burst lifetime — shorter than the PERFECT side banner.
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
    const isPerfect = position.isPerfect || false;
    const playerNumber = position.playerNumber || 1;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      isPerfect,
      playerNumber,
      startTime: currentTime,
      parryId: parryIdentifier,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    // Hype stamp outlives the short sprite burst so it can finish its exit.
    if (isPerfect) {
      setBanners((prev) => [...prev, { id: effectId, playerNumber }]);
      const bannerTid = setTimeout(() => {
        setBanners((prev) => prev.filter((b) => b.id !== effectId));
      }, HYPE_DURATION_MS);
      pendingTimeouts.current.push(bannerTid);
    }

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
      setBanners([]);
    };
  }, []);

  const hudEl =
    typeof document !== "undefined"
      ? document.getElementById("game-hud-callouts")
      : null;

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
            {effect.isPerfect ? (
              <PerfectParryExtras x={worldX} y={effect.y} />
            ) : (
              <RegularParryContactFlash x={worldX} y={effect.y} />
            )}
          </Fragment>
        );
      })}
      {banners.map((banner) =>
        hudEl ? (
          <Fragment key={banner.id}>
            {createPortal(
              <SumoHypeStamp
                type="perfect"
                isLeftSide={banner.playerNumber === 1}
              />,
              hudEl
            )}
          </Fragment>
        ) : null
      )}
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
