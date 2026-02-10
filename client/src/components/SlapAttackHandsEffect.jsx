import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import penguinHand from "../assets/slap-attack-hand.png";

// Animation for hand shooting out - facing RIGHT
const shootOutRight = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scale(0.7);
  }
  40% {
    opacity: 1;
    transform: translate(calc(var(--start-x) + 3vw), var(--offset-y)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) + 5vw), var(--offset-y)) scale(0.8);
  }
`;

// Animation for hand shooting out - facing LEFT
const shootOutLeft = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scaleX(-1) scale(0.7);
  }
  40% {
    opacity: 1;
    transform: translate(calc(var(--start-x) - 3vw), var(--offset-y)) scaleX(-1) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) - 5vw), var(--offset-y)) scaleX(-1) scale(0.8);
  }
`;

// Streak animation for RIGHT facing
const streakRight = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scaleX(1.5) scaleY(0.6);
  }
  40% {
    opacity: 0.95;
    transform: translate(calc(var(--start-x) + 2vw), var(--offset-y)) scaleX(2.5) scaleY(0.7);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) + 4vw), var(--offset-y)) scaleX(3) scaleY(0.5);
  }
`;

// Streak animation for LEFT facing
const streakLeft = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scaleX(1.5) scaleY(0.6);
  }
  40% {
    opacity: 0.95;
    transform: translate(calc(var(--start-x) - 2vw), var(--offset-y)) scaleX(2.5) scaleY(0.7);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) - 4vw), var(--offset-y)) scaleX(3) scaleY(0.5);
  }
`;

// Container anchored to player position
const HandsContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === -1 ? 16 : -7)}%`,
    bottom: `${(props.$y / 720) * 100 + 22}%`,
    pointerEvents: "none",
    zIndex: 150, // Above the player
  },
}))``;

const Hand = styled.img`
  position: absolute;
  /* Smaller minimum for small screens, larger maximum for big screens */
  width: clamp(40px, 6vw, 90px);
  height: auto;
  opacity: 0;
  --offset-y: ${(props) => props.$offsetY}vh;
  --start-x: ${(props) => props.$startX}vw;
  animation: ${(props) => (props.$facing === -1 ? shootOutLeft : shootOutRight)} 
    180ms ease-out forwards;
  transform-origin: center;
  will-change: transform, opacity;
  filter: grayscale(100%) brightness(200%)
    drop-shadow(1px 0 0 black) 
    drop-shadow(-1px 0 0 black) 
    drop-shadow(0 1px 0 black) 
    drop-shadow(0 -1px 0 black)
    drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 15px rgba(255, 255, 255, 0.5)); // White with black outline and glow - reliable across all monitors
`;

const Streak = styled.div`
  position: absolute;
  /* Smaller minimum for small screens, larger maximum for big screens */
  width: clamp(40px, 6vw, 90px);
  height: clamp(22px, 3vw, 48px);
  opacity: 0;
  --offset-y: ${(props) => props.$offsetY}vh;
  --start-x: ${(props) => props.$startX}vw;
  background: linear-gradient(
    ${(props) => (props.$facing === -1 ? '90deg' : '-90deg')},
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  border-radius: 50%;
  animation: ${(props) => (props.$facing === -1 ? streakLeft : streakRight)} 
    180ms ease-out forwards;
  transform-origin: ${(props) => (props.$facing === -1 ? 'right' : 'left')} center;
  will-change: transform, opacity;
  filter: blur(3px) drop-shadow(0 0 10px rgba(255, 255, 255, 0.8));
  z-index: -1; // Behind the hand
`;

const SlapAttackHandsEffect = ({ x, y, facing, isActive, slapAnimation }) => {
  const [hand, setHand] = useState(null);
  const lastSlapRef = useRef(null);
  const handIdCounter = useRef(0);
  const positionCycleRef = useRef(0);

  useEffect(() => {
    // Trigger ONE hand when slap animation changes (new slap attack)
    if (isActive && slapAnimation !== null && slapAnimation !== lastSlapRef.current) {
      lastSlapRef.current = slapAnimation;

      const id = ++handIdCounter.current;
      
      // Cycle through Y positions: high, middle, low, middle-high, middle-low
      const yPositions = [-8, 0, 8, -4, 4];
      const offsetY = yPositions[positionCycleRef.current % yPositions.length];
      positionCycleRef.current++;
      
      // ONE hand at a cycled position
      const newHand = {
        id,
        offsetY,
        startX: Math.random() * 1.5, // Random starting X
      };

      setHand(newHand);

      // Clean up after animation completes
      setTimeout(() => {
        setHand((current) => (current?.id === id ? null : current));
      }, 200);
    }

    // Reset tracking when slap attack ends
    if (!isActive) {
      lastSlapRef.current = null;
    }
  }, [isActive, slapAnimation]);

  // Don't render if no hand or invalid position
  if (!hand || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <HandsContainer $x={x} $y={y} $facing={facing}>
      <Streak
        key={`streak-${hand.id}`}
        $facing={facing}
        $offsetY={hand.offsetY}
        $startX={hand.startX}
      />
      <Hand
        key={hand.id}
        src={penguinHand}
        $facing={facing}
        $offsetY={hand.offsetY}
        $startX={hand.startX}
        alt=""
      />
    </HandsContainer>
  );
};

SlapAttackHandsEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  slapAnimation: PropTypes.number,
};

export default SlapAttackHandsEffect;
