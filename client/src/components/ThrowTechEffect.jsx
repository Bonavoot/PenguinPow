import { useState, useEffect, useContext, useRef } from "react";
import { SocketContext } from "../SocketContext";
import "./ThrowTechEffect.css";

const ThrowTechEffect = () => {
  const { socket } = useContext(SocketContext);
  const [effectState, setEffectState] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  });
  const hasSetPosition = useRef(false);

  useEffect(() => {
    const handleFighterAction = (data) => {
      if (
        (data.player1.isThrowTeching || data.player2.isThrowTeching) &&
        !hasSetPosition.current
      ) {
        // Only set the position once when the tech starts
        hasSetPosition.current = true;

        // Calculate the initial collision point
        const centerX = (data.player1.x + data.player2.x) / 2;
        const centerY = (data.player1.y + data.player2.y) / 2;

        setEffectState({
          isVisible: true,
          x: centerX,
          y: centerY,
        });

        // Reset after animation
        setTimeout(() => {
          setEffectState((prev) => ({ ...prev, isVisible: false }));
          hasSetPosition.current = false;
        }, 300);
      }
    };

    socket.on("fighter_action", handleFighterAction);

    return () => {
      socket.off("fighter_action", handleFighterAction);
    };
  }, [socket]);

  if (!effectState.isVisible) return null;

  return (
    <div
      className="throw-tech-effect"
      style={{
        left: `${(effectState.x / 1280) * 100}%`,
        bottom: `${(effectState.y / 720) * 100}%`,
      }}
    >
      <svg width="200" height="200" viewBox="0 0 100 100">
        <path
          d="M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z"
          className="tech-star"
        />
      </svg>
    </div>
  );
};

export default ThrowTechEffect;
