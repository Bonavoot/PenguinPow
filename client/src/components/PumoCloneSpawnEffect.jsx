import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Simple spawn ring animation
// const spawnRing = keyframes`
//   0% {
//     transform: translate(-50%, -50%) scale(0.3);
//     opacity: 1;
//   }
//   100% {
//     transform: translate(-50%, -50%) scale(1.8);
//     opacity: 0;
//   }
// `;

const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 + 5}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 96,
    pointerEvents: "none",
  },
}))``;

// const SpawnRing = styled.div.attrs((props) => ({
//   style: {
//     borderColor: props.$color ? `${props.$color}cc` : "rgba(255, 140, 0, 0.8)",
//     boxShadow: props.$color ? `0 0 10px ${props.$color}80` : "0 0 10px rgba(255, 140, 0, 0.5)",
//   },
// }))`
//   position: absolute;
//   top: 50%;
//   left: 50%;
//   width: clamp(35px, 4vw, 50px);
//   height: clamp(35px, 4vw, 50px);
//   border: 3px solid;
//   border-radius: 50%;
//   transform: translate(-50%, -50%) scale(0.3);
//   animation: ${spawnRing} 0.35s ease-out forwards;
// `;

const PumoCloneSpawnEffect = ({ clones, lastCloneCount, player1Color, player2Color }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedClonesRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const EFFECT_DURATION = 450;

  useEffect(() => {
    if (!clones || clones.length === 0) {
      processedClonesRef.current.clear();
      return;
    }

    clones.forEach((clone) => {
      if (!processedClonesRef.current.has(clone.id)) {
        processedClonesRef.current.add(clone.id);
        const effectId = ++effectIdCounter.current;

        const newEffect = {
          id: effectId,
          x: clone.x,
          y: clone.y,
          ownerPlayerNumber: clone.ownerPlayerNumber,
        };

        setActiveEffects((prev) => [...prev, newEffect]);

        const tid = setTimeout(() => {
          setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
        }, EFFECT_DURATION);
        pendingTimeouts.current.push(tid);
      }
    });
  }, [clones]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const color = effect.ownerPlayerNumber === 1 ? player1Color : player2Color;
        return (
          <EffectContainer key={effect.id} $x={effect.x} $y={effect.y}>
            {/* <SpawnRing $color={color} /> */}
          </EffectContainer>
        );
      })}
    </>
  );
};

PumoCloneSpawnEffect.propTypes = {
  clones: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
      ownerPlayerNumber: PropTypes.number,
    })
  ),
  lastCloneCount: PropTypes.number,
  player1Color: PropTypes.string,
  player2Color: PropTypes.string,
};

export default PumoCloneSpawnEffect;
