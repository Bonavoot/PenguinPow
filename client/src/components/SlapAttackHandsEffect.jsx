import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import penguinHand from "../assets/penguin-hand.png";

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

// Container anchored to player position
const HandsContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === -1 ? 17 : -8)}%`,
    bottom: `${(props.$y / 720) * 100 + 22}%`,
    pointerEvents: "none",
    zIndex: 150, // Above the player
  },
}))``;

const Hand = styled.img`
  position: absolute;
  width: clamp(70px, 7vw, 100px); // BIGGER
  height: auto;
  opacity: 0;
  --offset-y: ${(props) => props.$offsetY}vh;
  --start-x: ${(props) => props.$startX}vw;
  animation: ${(props) => (props.$facing === -1 ? shootOutLeft : shootOutRight)} 
    180ms ease-out forwards;
  transform-origin: center;
  will-change: transform, opacity;
  filter: brightness(0) invert(1) 
    drop-shadow(1px 0 0 black) 
    drop-shadow(-1px 0 0 black) 
    drop-shadow(0 1px 0 black) 
    drop-shadow(0 -1px 0 black)
    drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 15px rgba(255, 255, 255, 0.5)); // White with black outline and glow
`;

const SlapAttackHandsEffect = ({ x, y, facing, isActive, slapAnimation }) => {
  const [hand, setHand] = useState(null);
  const lastSlapRef = useRef(null);
  const handIdCounter = useRef(0);

  useEffect(() => {
    // Trigger ONE hand when slap animation changes (new slap attack)
    if (isActive && slapAnimation !== null && slapAnimation !== lastSlapRef.current) {
      lastSlapRef.current = slapAnimation;

      const id = ++handIdCounter.current;
      
      // ONE hand at a random position
      const newHand = {
        id,
        offsetY: (Math.random() - 0.5) * 10, // Random Y: -5 to +5
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
