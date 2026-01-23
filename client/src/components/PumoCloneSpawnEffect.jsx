import { useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Simple spawn ring animation
const spawnRing = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.8);
    opacity: 0;
  }
`;

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

const SpawnRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(35px, 4vw, 50px);
  height: clamp(35px, 4vw, 50px);
  border: 3px solid rgba(255, 140, 0, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.3);
  animation: ${spawnRing} 0.35s ease-out forwards;
  box-shadow: 0 0 10px rgba(255, 140, 0, 0.5);
`;

const PumoCloneSpawnEffect = ({ clones, lastCloneCount }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedClonesRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 450;

  useEffect(() => {
    if (!clones || clones.length === 0) {
      processedClonesRef.current.clear();
      return;
    }

    // Find new clones that haven't been processed yet
    clones.forEach((clone) => {
      if (!processedClonesRef.current.has(clone.id)) {
        processedClonesRef.current.add(clone.id);
        const effectId = ++effectIdCounter.current;

        const newEffect = {
          id: effectId,
          x: clone.x,
          y: clone.y,
        };

        setActiveEffects((prev) => [...prev, newEffect]);

        setTimeout(() => {
          setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
        }, EFFECT_DURATION);
      }
    });
  }, [clones]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => (
        <EffectContainer key={effect.id} $x={effect.x} $y={effect.y}>
          <SpawnRing />
        </EffectContainer>
      ))}
    </>
  );
};

PumoCloneSpawnEffect.propTypes = {
  clones: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
    })
  ),
  lastCloneCount: PropTypes.number,
};

export default PumoCloneSpawnEffect;
