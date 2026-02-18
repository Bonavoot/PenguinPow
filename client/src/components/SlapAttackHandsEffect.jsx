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
    transform: translate(calc(var(--start-x) + 2vw), var(--offset-y)) scale(0.95);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) + 3.35vw), var(--offset-y)) scale(0.8);
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
    transform: translate(calc(var(--start-x) - 2vw), var(--offset-y)) scaleX(-1) scale(0.95);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) - 3.35vw), var(--offset-y)) scaleX(-1) scale(0.8);
  }
`;

// Streak animation for RIGHT facing
const streakRight = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scaleX(1.35) scaleY(0.55);
  }
  40% {
    opacity: 0.95;
    transform: translate(calc(var(--start-x) + 1.35vw), var(--offset-y)) scaleX(2.25) scaleY(0.65);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) + 2.7vw), var(--offset-y)) scaleX(2.7) scaleY(0.5);
  }
`;

// Streak animation for LEFT facing
const streakLeft = keyframes`
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--offset-y)) scaleX(1.35) scaleY(0.55);
  }
  40% {
    opacity: 0.95;
    transform: translate(calc(var(--start-x) - 1.35vw), var(--offset-y)) scaleX(2.25) scaleY(0.65);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--start-x) - 2.7vw), var(--offset-y)) scaleX(2.7) scaleY(0.5);
  }
`;

// Container anchored to player position
const HandsContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === -1 ? 13 : -5.5)}%`,
    bottom: `${(props.$y / 720) * 100 + 16}%`,
    pointerEvents: "none",
    zIndex: 150, // Above the player
  },
}))``;

const Hand = styled.img`
  position: absolute;
  /* Smaller minimum for small screens, larger maximum for big screens */
  width: clamp(27px, 4vw, 60px);
  height: auto;
  opacity: 0;
  --offset-y: ${(props) => props.$offsetY}vh;
  --start-x: ${(props) => props.$startX}vw;
  animation: ${(props) => (props.$facing === -1 ? shootOutLeft : shootOutRight)} 
    180ms ease-out forwards;
  transform-origin: center;
  will-change: transform, opacity;
  filter: grayscale(100%) brightness(200%)
    drop-shadow(clamp(1px, 0.08vw, 2.5px) 0 0 black) 
    drop-shadow(clamp(-2.5px, -0.08vw, -1px) 0 0 black) 
    drop-shadow(0 clamp(1px, 0.08vw, 2.5px) 0 black) 
    drop-shadow(0 clamp(-2.5px, -0.08vw, -1px) 0 black)
    drop-shadow(0 0 clamp(6px, 0.6vw, 12px) rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 clamp(12px, 1.2vw, 24px) rgba(255, 255, 255, 0.5)); // White with black outline and glow - scales with screen
`;

const Streak = styled.div`
  position: absolute;
  /* Smaller minimum for small screens, larger maximum for big screens */
  width: clamp(27px, 4vw, 60px);
  height: clamp(14px, 2vw, 32px);
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
      
      // Cycle through Y positions: tighter spread (less gap between hands)
      const yPositions = [-4, 0, 4, -2, 2];
      const offsetY = yPositions[positionCycleRef.current % yPositions.length];
      positionCycleRef.current++;
      
      // ONE hand at a cycled position (smaller startX = less horizontal gap)
      const newHand = {
        id,
        offsetY,
        startX: Math.random() * 0.7, // Tighter: less spread from center
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
