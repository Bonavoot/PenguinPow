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

  const lastTechTime = useRef(0);
  const wasTeching = useRef(false);

  useEffect(() => {
    const handleFighterAction = (data) => {
      const isTeching =
        data.player1.isThrowTeching || data.player2.isThrowTeching;
      const currentTime = Date.now();

      if (
        isTeching &&
        !wasTeching.current &&
        currentTime - lastTechTime.current > 500
      ) {
        const centerX = (data.player1.x + data.player2.x) / 2 + 150;
        const centerY = (data.player1.y + data.player2.y) / 2 + 120;

        setEffectState({
          isVisible: true,
          x: centerX,
          y: centerY,
        });

        lastTechTime.current = currentTime;

        setTimeout(() => {
          setEffectState((prev) => ({ ...prev, isVisible: false }));
        }, 100);
      }

      wasTeching.current = isTeching;
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
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{ background: "none" }}
      >
        <defs>
          <path
            id="star-path"
            d="M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z"
          />
        </defs>
        <use href="#star-path" className="tech-star" />
      </svg>
    </div>
  );
};

export default ThrowTechEffect;
