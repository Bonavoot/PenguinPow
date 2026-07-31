import { useState, useEffect, useContext, useRef, memo } from "react";
import styled from "styled-components";
import { SocketContext } from "../SocketContext";
import {
  getSharedFighterState,
  subscribeFighterSnapshot,
} from "../net/fighterSnapshotBus";
import "./ThrowTechEffect.css";

const TechEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 150,
    pointerEvents: "none",
  },
}))``;

const EffectWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const ThrowTechEffect = () => {
  const { socket } = useContext(SocketContext);
  const [effectState, setEffectState] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  });

  const lastTechTime = useRef(0);
  const wasTeching = useRef(false);
  const hideTimeout = useRef(null);

  useEffect(() => {
    const handleFighterAction = () => {
      const { player1, player2 } = getSharedFighterState();
      if (!player1 || !player2) return;
      const isTeching =
        player1.isThrowTeching || player2.isThrowTeching;
      const currentTime = Date.now();

      if (
        isTeching &&
        !wasTeching.current &&
        currentTime - lastTechTime.current > 500
      ) {
        const centerX = (player1.x + player2.x) / 2 + 150;
        const centerY = (player1.y + player2.y) / 2 + 120;

        setEffectState({
          isVisible: true,
          x: centerX,
          y: centerY,
        });

        lastTechTime.current = currentTime;

        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => {
          setEffectState((prev) => ({ ...prev, isVisible: false }));
        }, 400);
      }

      wasTeching.current = isTeching;
    };

    const unsub = subscribeFighterSnapshot(handleFighterAction);

    return () => {
      unsub();
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [socket]);

  if (!effectState.isVisible) return null;

  return (
    <TechEffectContainer $x={effectState.x} $y={effectState.y} className="throw-tech-effect">
      <EffectWrapper>
        <div className="throw-tech-ring" />
        <div className="tech-text">TECH!</div>
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{ background: "none", position: "relative", zIndex: 2 }}
        >
          <defs>
            <path
              id="star-path"
              d="M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z"
            />
          </defs>
          <use href="#star-path" className="tech-star" />
        </svg>
      </EffectWrapper>
    </TechEffectContainer>
  );
};

export default memo(ThrowTechEffect);
