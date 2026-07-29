import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { drawBalanceGauge } from "./balanceGaugeDraw";
import { C, FONT_DISPLAY, FONT_KANJI } from "./menuTheme";

/* Compact secondary meter — stamina stays the hero. */
const GAUGE_HEIGHT = "clamp(14px, 1.9cqh, 18px)";

/* MASTERY Phase 5 (5.2): broken-posture HUD pulse. */
const posturePulse = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 2px rgba(226, 74, 42, 0.55));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 6px rgba(255, 96, 64, 0.9));
    transform: scale(1.03);
  }
`;

/* Tip-slap posture bite — overlay remounts per drainKey so rapid tips replay. */
const tipDrainFlinch = keyframes`
  0%   { opacity: 0; box-shadow: 0 0 0 0 rgba(255, 120, 80, 0); transform: scale(1); }
  18%  { opacity: 1; box-shadow: 0 0 10px 1px rgba(255, 120, 80, 0.85); transform: scale(1.07); }
  100% { opacity: 0; box-shadow: 0 0 0 0 rgba(255, 120, 80, 0); transform: scale(1); }
`;

const GaugeShell = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: ${GAUGE_HEIGHT};
  position: relative;
  transform-origin: ${(p) => (p.$isRight ? "right center" : "left center")};
  ${(p) =>
    p.$broken
      ? css`
          animation: ${posturePulse} 0.6s ease-in-out infinite;
        `
      : ""}
`;

const TipDrainFlash = styled.div`
  position: absolute;
  inset: -1px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 3;
  animation: ${tipDrainFlinch} 0.42s cubic-bezier(0.2, 0.85, 0.25, 1) both;
  background: linear-gradient(
    90deg,
    rgba(255, 140, 90, 0) 0%,
    rgba(255, 150, 100, 0.22) 50%,
    rgba(255, 140, 90, 0) 100%
  );
`;

const GaugeCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const BalLabel = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: ${GAUGE_HEIGHT};
  font-family: ${FONT_DISPLAY};
  font-size: clamp(7px, 0.78cqw, 9.5px);
  color: rgba(245, 236, 217, 0.72);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-inline-end: -0.1em;
  line-height: 1;
  transform: translateY(0.5px);
  text-shadow:
    0 0 8px rgba(0, 0, 0, 0.75),
    1px 1px 2px rgba(0, 0, 0, 1);
  user-select: none;
  pointer-events: none;
`;

const Strip = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: clamp(4px, 0.5cqw, 7px);
  flex-direction: ${(p) => (p.$isRight ? "row-reverse" : "row")};
`;

const gripStamp = keyframes`
  0%   { opacity: 0; transform: translateY(-2px) scale(0.7); }
  60%  { opacity: 1; transform: translateY(0)    scale(1.08); }
  100% { opacity: 1; transform: translateY(0)    scale(1); }
`;

const gripBreath = keyframes`
  0%, 100% { filter: brightness(1);    }
  50%      { filter: brightness(1.16); }
`;

/* Below the gauge, toward center — outer half is reserved for BASHO boons. */
const DeepGripChip = styled.div`
  position: absolute;
  top: calc(100% + clamp(2px, 0.3cqh, 4px));
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  display: inline-flex;
  align-items: center;
  gap: clamp(2px, 0.3cqw, 4px);
  padding: clamp(1px, 0.2cqh, 3px) clamp(4px, 0.6cqw, 8px);
  border-radius: 2px;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(6.5px, 0.78cqw, 9.5px);
  letter-spacing: 0.12em;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  z-index: 4;
  transform-origin: ${(p) => (p.$isRight ? "left top" : "right top")};
  animation: ${gripStamp} 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
    ${gripBreath} 1.9s ease-in-out infinite;

  ${(p) =>
    p.$mode === "hold"
      ? css`
          color: #2a1f04;
          background: linear-gradient(180deg, #f3dd7a 0%, ${C.gold} 55%, #b98f13 100%);
          border: 1px solid #7a5c0c;
          box-shadow:
            0 1px 4px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 250, 220, 0.55);
          text-shadow: 0 1px 0 rgba(255, 246, 200, 0.5);
        `
      : css`
          color: ${C.cream};
          background: linear-gradient(180deg, #d98a2a 0%, #b4611a 55%, #7e3d12 100%);
          border: 1px solid #5c2c0d;
          box-shadow:
            0 1px 4px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 220, 170, 0.35);
          text-shadow: 0 1px 1px rgba(50, 20, 6, 0.7);
        `}
`;

const GripKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: 1.25em;
  line-height: 1;
`;

function getCanvasDpr() {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.min(Math.max(dpr, 1), 2);
}

/**
 * @param {object} props
 * @param {number} [props.balance]
 * @param {boolean} [props.isRight]
 * @param {boolean} [props.danger]
 * @param {number} [props.gainKey]
 * @param {number} [props.drainKey]
 * @param {boolean} [props.deepGripThreat]
 * @param {boolean} [props.deepGripHold]
 */
const BalanceGauge = ({
  balance = 100,
  isRight = false,
  danger = false,
  broken = false,
  gainKey = 0,
  drainKey = 0,
  deepGripThreat = false,
  deepGripHold = false,
}) => {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    displayBalance: balance,
    targetBalance: balance,
    gainStart: null,
    lastGainKey: 0,
    drainStart: null,
    lastDrainKey: 0,
    deepGripT: deepGripThreat ? 1 : 0,
    targetDeepGrip: deepGripThreat ? 1 : 0,
  });

  useEffect(() => {
    const st = stateRef.current;
    st.targetBalance = balance;
    if (gainKey > 0 && gainKey !== st.lastGainKey) {
      st.lastGainKey = gainKey;
      st.gainStart = performance.now();
    }
    if (drainKey > 0 && drainKey !== st.lastDrainKey) {
      st.lastDrainKey = drainKey;
      st.drainStart = performance.now();
      // Tip drain snaps the fill down faster so the bite reads immediately.
      st.displayBalance = balance + (st.displayBalance - balance) * 0.25;
    }
  }, [balance, gainKey, drainKey]);

  useEffect(() => {
    stateRef.current.targetDeepGrip = deepGripThreat ? 1 : 0;
  }, [deepGripThreat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const dpr = getCanvasDpr();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    ro?.observe(shell);
    resize();

    const tick = (now) => {
      resize();
      const st = stateRef.current;
      const dt = 0.18;
      st.displayBalance += (st.targetBalance - st.displayBalance) * dt;

      const dgDt = 0.22;
      st.deepGripT += (st.targetDeepGrip - st.deepGripT) * dgDt;
      if (Math.abs(st.targetDeepGrip - st.deepGripT) < 0.004) {
        st.deepGripT = st.targetDeepGrip;
      }

      let gainT = null;
      if (st.gainStart != null) {
        gainT = (now - st.gainStart) / 700;
        if (gainT >= 1) {
          st.gainStart = null;
          gainT = null;
        }
      }

      let drainT = null;
      if (st.drainStart != null) {
        drainT = (now - st.drainStart) / 420;
        if (drainT >= 1) {
          st.drainStart = null;
          drainT = null;
        }
      }

      drawBalanceGauge(ctx, {
        width: canvas.width,
        height: canvas.height,
        balance: st.displayBalance,
        isRight,
        danger,
        gainT,
        drainT,
        time: now / 1000,
        deepGripT: st.deepGripT,
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro?.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRight, danger]);

  const gripMode = deepGripHold ? "hold" : deepGripThreat ? "threat" : null;

  return (
    <Strip $isRight={isRight}>
      <BalLabel>POSTURE</BalLabel>
      <GaugeShell ref={shellRef} $broken={broken} $isRight={isRight}>
        <GaugeCanvas ref={canvasRef} aria-hidden="true" />
        {drainKey > 0 && <TipDrainFlash key={`tip-drain-${drainKey}`} />}
        {gripMode && (
          <DeepGripChip $mode={gripMode} $isRight={isRight}>
            <GripKanji>握</GripKanji>
            {gripMode === "hold" ? "DEEP GRIP" : "EXPOSED"}
          </DeepGripChip>
        )}
      </GaugeShell>
    </Strip>
  );
};

BalanceGauge.propTypes = {
  balance: PropTypes.number,
  isRight: PropTypes.bool,
  danger: PropTypes.bool,
  broken: PropTypes.bool,
  gainKey: PropTypes.number,
  drainKey: PropTypes.number,
  deepGripThreat: PropTypes.bool,
  deepGripHold: PropTypes.bool,
};

export default BalanceGauge;
