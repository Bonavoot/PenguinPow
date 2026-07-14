import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { drawBalanceGauge } from "./balanceGaugeDraw";
import { C } from "./menuTheme";

const GAUGE_HEIGHT = "clamp(16px, 2.2cqh, 22px)";

/* MASTERY Phase 5 (5.2): broken-posture HUD pulse — a vermillion glow that
 * breathes while posture is broken, so the "openable" tell reads on the bar as
 * well as on the fighter. Only applied when the `broken` prop is set (which the
 * HUD gates behind the phase flag), so with the flag off the bar is unchanged. */
const posturePulse = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 2px rgba(226, 74, 42, 0.55));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 7px rgba(255, 96, 64, 0.95));
    transform: scale(1.045);
  }
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

const GaugeCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const BalLabel = styled.div`
  flex-shrink: 0;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.82cqw, 10px);
  color: rgba(245, 236, 217, 0.72);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 1),
    0 0 4px rgba(0, 0, 0, 0.85),
    0 0 2px rgba(0, 0, 0, 1);
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

/* Deep Grip chip lands with a small stamp settle so the state change reads
 * as an EARNED event, then sits still (labeled permanently) while active. */
const gripStamp = keyframes`
  0%   { opacity: 0; transform: translateY(-2px) scale(0.7); }
  60%  { opacity: 1; transform: translateY(0)    scale(1.08); }
  100% { opacity: 1; transform: translateY(0)    scale(1); }
`;

/* Slow breath so the chip stays alive without strobing. */
const gripBreath = keyframes`
  0%, 100% { filter: brightness(1);    }
  50%      { filter: brightness(1.16); }
`;

/* Floating state chip pinned just BELOW the gauge (out of the stamina
 * bar's way), hugging the center-screen edge (there's open space there;
 * the outer edge holds BASHO boons). Two variants:
 *   hold   → gold "DEEP GRIP": you earned it, your throws land at 60.
 *   threat → amber "EXPOSED": opponent holds it, you're throwable at 60. */
const DeepGripChip = styled.div`
  position: absolute;
  top: calc(100% + clamp(2px, 0.3cqh, 4px));
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  display: inline-flex;
  align-items: center;
  gap: clamp(2px, 0.3cqw, 4px);
  padding: clamp(1px, 0.2cqh, 3px) clamp(4px, 0.6cqw, 8px);
  border-radius: 2px;
  font-family: "Bungee", cursive;
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
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
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
 * @param {boolean} [props.deepGripThreat] — true when the OPPONENT holds
 *   Deep Grip (this player's throw land line rises to 60, gauge shows the
 *   grip gate + "EXPOSED" chip). Hidden otherwise.
 * @param {boolean} [props.deepGripHold] — true when THIS player holds Deep
 *   Grip (shows the offensive "DEEP GRIP" chip). Doesn't change this
 *   player's own throw threshold — it's their advantage over the opponent.
 */
const BalanceGauge = ({
  balance = 100,
  isRight = false,
  danger = false,
  broken = false,
  gainKey = 0,
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
  }, [balance, gainKey]);

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

      // Deep Grip install eases a bit snappier than balance so the gate
      // slide feels earned when the grip lands, not sluggish.
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

      drawBalanceGauge(ctx, {
        width: canvas.width,
        height: canvas.height,
        balance: st.displayBalance,
        isRight,
        danger,
        gainT,
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

  // Hold wins if (somehow) both are set — you're the one with the advantage.
  const gripMode = deepGripHold ? "hold" : deepGripThreat ? "threat" : null;

  return (
    <Strip $isRight={isRight}>
      <BalLabel>POSTURE</BalLabel>
      <GaugeShell ref={shellRef} $broken={broken} $isRight={isRight}>
        <GaugeCanvas ref={canvasRef} aria-hidden="true" />
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
  deepGripThreat: PropTypes.bool,
  deepGripHold: PropTypes.bool,
};

export default BalanceGauge;
