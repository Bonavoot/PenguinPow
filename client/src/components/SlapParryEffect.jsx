import { useEffect, useState, useRef, memo, Fragment } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import grabBreakSheet from "../assets/grab-break-effect.png";
import {
  PerfectParryExtras,
  RegularParryContactFlash,
} from "./parryVfxShared";

// ATTACK PARRY (AP) burst — grab-break star sheet, recolored per tier.
// Regular = steel cyan + contact pin + soft underplate (line weight). Perfect =
// hotter electric ice-cyan + impact punch layers (flash / banner). Scale punch
// lives on the VFX wrapper so the camera never zooms.
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

// Mild 2.5D seat in the dohyo plane — enough to stop reading as a flat sticker,
// not the heavy tilt BlockingEffect uses for its ring disc.
const PERSPECTIVE = "420px";
const TILT_Y_DEG = 22;
const TILT_X_DEG = 10;
// Horizontal stretch matches the sheet's slap-axis bias.
const STRETCH_X = 1.12;

const REGULAR_FILL = "#5ad0ff";
const REGULAR_GLOW = "rgba(140, 210, 255, 0.75)";
const PERFECT_FILL = "#7af0ff";
const PERFECT_GLOW = "rgba(0, 220, 255, 0.9)";

// Perfect keeps the stronger punch; regular gets a lighter contact pop via
// the CSS `scale` property so it composes with the Anchor's perspective.
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
  left: ${(p) => (p.$x / 1280) * 100}%;
  bottom: ${(p) => (p.$y / 720) * 100}%;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  /* Above both fighters (~99) so the clash never hides under an attacking arm. */
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
  background-size: ${GRID * 100}% ${GRID * 100}%;
  -webkit-mask-image: url(${grabBreakSheet});
  mask-image: url(${grabBreakSheet});
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${GRID * 100}% ${GRID * 100}%;
  mask-size: ${GRID * 100}% ${GRID * 100}%;
`;

// Soft underplate — slight blur + scale fattens the sheet's needle lines so
// they read at play-size without redrawing the art or bloating the burst.
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

const frameToBackgroundPosition = (frame) => {
  const col = frame % GRID;
  const row = Math.floor(frame / GRID);
  const x = (col / (GRID - 1)) * 100;
  const y = (row / (GRID - 1)) * 100;
  return `${x}% ${y}%`;
};

const applySheetPos = (el, pos) => {
  if (!el) return;
  el.style.backgroundPosition = pos;
  el.style.webkitMaskPosition = pos;
  el.style.maskPosition = pos;
};

const ParryBurst = ({ x, y, facing, variant, size, onDone }) => {
  const sharpRef = useRef(null);
  const plateRef = useRef(null);
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
      applySheetPos(sharpRef.current, pos);
      applySheetPos(plateRef.current, pos);
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
    <Anchor $x={x} $y={y} $size={size} $facing={facing}>
      <PopWrap $isPerfect={isPerfect}>
        <ThickPlate ref={plateRef} $isPerfect={isPerfect} />
        <SpritePlane ref={sharpRef} $isPerfect={isPerfect} />
      </PopWrap>
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
    const size = (isPerfect ? PERFECT_SIZE_CQW : SIZE_CQW) + chainGrow;
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
          {b.variant === "perfect" ? (
            <PerfectParryExtras
              x={b.x}
              y={b.y}
              playerNumber={b.playerNumber}
              showBanner
            />
          ) : (
            <RegularParryContactFlash x={b.x} y={b.y} />
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
