import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import styled from "styled-components";
import { drawBalanceGauge } from "./balanceGaugeDraw";

const GAUGE_HEIGHT = "clamp(16px, 2.2cqh, 22px)";

const GaugeShell = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: ${GAUGE_HEIGHT};
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
  letter-spacing: 0.2em;
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

function getCanvasDpr() {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.min(Math.max(dpr, 1), 2);
}

const BalanceGauge = ({
  balance = 100,
  isRight = false,
  danger = false,
  gainKey = 0,
}) => {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    displayBalance: balance,
    targetBalance: balance,
    gainStart: null,
    lastGainKey: 0,
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
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro?.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRight, danger]);

  return (
    <Strip $isRight={isRight}>
      <BalLabel>BAL</BalLabel>
      <GaugeShell ref={shellRef}>
        <GaugeCanvas ref={canvasRef} aria-hidden="true" />
      </GaugeShell>
    </Strip>
  );
};

BalanceGauge.propTypes = {
  balance: PropTypes.number,
  isRight: PropTypes.bool,
  danger: PropTypes.bool,
  gainKey: PropTypes.number,
};

export default BalanceGauge;
