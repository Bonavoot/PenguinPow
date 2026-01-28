import { useEffect, useState, useRef, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

const HitEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -2 : -4)}%;
  bottom: ${props => (props.$y / 720) * 100 - 5}%;
  transform: translate(-50%, -50%);
  z-index: 100;
  pointer-events: none;
  contain: layout style;
`;

const ParticleContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 8;
`;

const Particle = styled.div`
  position: absolute;
  width: 0.23vw;
  height: 0.23vw;
  background: radial-gradient(circle, #ffff99, #ffd700);
  border-radius: 50%;
  opacity: 0;
`;

// Enhanced spark particles with realistic physics and visuals
const Spark = styled.div`
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transform-origin: center;
  will-change: transform, opacity;
`;

const HitEffect = ({ position }) => {
  // Track multiple active effects with unique IDs
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set()); // Track processed hit IDs to prevent duplicates
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 480; // Slightly longer for better visibility

  // Memoize the unique identifier to prevent unnecessary re-processing
  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  // Generate spark particles - balanced for visuals and performance
  const generateSparks = (effectId) => {
    const sparkCount = 8;
    const sparks = [];
    const baseSize = Math.min(window.innerWidth / 180, 5);

    for (let i = 0; i < sparkCount; i++) {
      sparks.push({
        id: `${effectId}-spark-${i}`,
        size: baseSize + Math.random() * 2,
        sparkIndex: i,
      });
    }

    return sparks;
  };

  useEffect(() => {
    if (!position || !hitIdentifier) {
      if (position && !hitIdentifier) {
        console.warn(
          "HitEffect: No unique identifier provided for hit",
          position
        );
      }
      return;
    }

    // Prevent duplicate processing of the same hit
    if (processedHitsRef.current.has(hitIdentifier)) {
      console.log("HitEffect: Duplicate hit prevented", hitIdentifier);
      return;
    }

    // Mark this hit as processed
    processedHitsRef.current.add(hitIdentifier);
    console.log("HitEffect: Creating new effect", hitIdentifier);

    // Create unique effect ID
    const effectId = ++effectIdCounter.current;
    const currentTime = Date.now();

    // Create new effect with sparks
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      startTime: currentTime,
      hitId: hitIdentifier,
      sparks: generateSparks(effectId),
    };

    // Add the new effect to active effects
    setActiveEffects((prev) => [...prev, newEffect]);

    // Remove this effect after duration and clean up tracking
    setTimeout(() => {
      setActiveEffects((prev) =>
        prev.filter((effect) => effect.id !== effectId)
      );
      processedHitsRef.current.delete(hitIdentifier);
    }, EFFECT_DURATION);
  }, [hitIdentifier, position?.x, position?.y, position?.facing]); // Depend on stable identifier and position values

  // Cleanup effects on unmount
  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  // Render all active effects
  return (
    <>
      {activeEffects.map((effect) => {
        // Generate basic particles - fixed positions for performance
        const particlePositions = [[30, 40], [50, 30], [70, 50], [40, 70]];
        const particles = particlePositions.map(([top, left], i) => (
          <Particle
            key={`${effect.id}-particle-${i}`}
            className="particle"
            style={{ top: `${top}%`, left: `${left}%` }}
          />
        ));

        // Generate spark particles - simplified for performance
        const sparkElements = effect.sparks.map((spark) => (
          <Spark
            key={spark.id}
            className="spark"
            style={{
              top: "50%",
              left: "50%",
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              background: "linear-gradient(45deg, #FFFFFF, #FFD700)",
              borderRadius: "50%",
            }}
          />
        ));

        return (
          <HitEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div className="hit-ring-wrapper">
              <div className="hit-ring" />
              <ParticleContainer className="hit-particles">
                {particles}
              </ParticleContainer>
              <ParticleContainer className="spark-particles">
                {sparkElements}
              </ParticleContainer>
            </div>
          </HitEffectContainer>
        );
      })}
    </>
  );
};

HitEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
  }),
};

export default HitEffect;
