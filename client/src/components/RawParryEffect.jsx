import { useEffect, useState, useRef, useMemo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";
import { HIT_EFFECT_TEXT_DURATION, HIT_EFFECT_TEXT_DELAY } from "../config/hitEffectText";

// Pre-create indices for perfect parry speed lines
const PERFECT_LINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

// Text pop: centered in the ring for both regular and perfect
const textPop = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  20% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 1;
  }
  40% {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 1;
  }
  60% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 1;
  }
  80% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
`;

// Text centered in the ring (same for regular and perfect)
const ParryTextCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.6vw, 1.4rem);
  color: ${props => props.$isPerfect ? '#FFD700' : '#00BFFF'};
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 ${props => props.$isPerfect ? '20px' : '15px'} ${props => props.$isPerfect ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 191, 255, 0.9)'}${props => props.$isPerfect ? ', 0 0 35px rgba(255, 215, 0, 0.4)' : ''};
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${textPop} ${HIT_EFFECT_TEXT_DURATION}s ease-out forwards;
  animation-delay: ${HIT_EFFECT_TEXT_DELAY}s;
  pointer-events: none;
  z-index: 20;
`;

/* Container: fixed size (perfect parry size) so both effects share the same center point */
const RawParryEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -6 : -1)}%;
  bottom: ${props => (props.$y / 720) * 100 - 2}%;
  width: clamp(4.2rem, 10.5vw, 8.4rem);
  height: clamp(3.9rem, 9.8vw, 7.8rem);
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: ${(props) =>
    props.$isPerfect
      ? "radial-gradient(circle, #00FFFF, #00BFFF)" // Bright cyan for perfect
      : "radial-gradient(circle, #E0FFFF, #00CED1)"}; // Light cyan to dark cyan for regular
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

const RawParryEffect = ({ position }) => {
  // Track multiple active effects with unique IDs
  const [activeEffects, setActiveEffects] = useState([]);
  const processedParriesRef = useRef(new Set()); // Track processed parry IDs to prevent duplicates
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 800; // Slightly longer than the longest animation (~650ms)

  // Memoize the unique identifier to prevent unnecessary re-processing
  const parryIdentifier = useMemo(() => {
    if (!position) return null;
    return position.parryId || position.timestamp;
  }, [position?.parryId, position?.timestamp]);

  // Generate spark particles - balanced for visuals and performance
  const generateSparks = (effectId, isPerfect) => {
    const sparkCount = 8;
    const sparks = [];
    const baseSize = Math.min(window.innerWidth / 180, 5);

    for (let i = 0; i < sparkCount; i++) {
      sparks.push({
        id: `${effectId}-spark-${i}`,
        size: isPerfect ? baseSize + Math.random() * 3 : baseSize + Math.random() * 2,
        sparkIndex: i,
        isPerfect,
      });
    }

    return sparks;
  };

  useEffect(() => {
    if (!position || !parryIdentifier) return;

    // Prevent duplicate processing of the same parry
    if (processedParriesRef.current.has(parryIdentifier)) return;

    // Mark this parry as processed
    processedParriesRef.current.add(parryIdentifier);

    // Create unique effect ID
    const effectId = ++effectIdCounter.current;
    const currentTime = Date.now();

    // Create new effect with sparks
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      isPerfect: position.isPerfect || false,
      playerNumber: position.playerNumber || 1,
      startTime: currentTime,
      parryId: parryIdentifier,
      sparks: generateSparks(effectId, position.isPerfect || false),
    };

    // Add the new effect to active effects
    setActiveEffects((prev) => [...prev, newEffect]);

    // Remove this effect after duration and clean up tracking
    setTimeout(() => {
      setActiveEffects((prev) =>
        prev.filter((effect) => effect.id !== effectId)
      );
      processedParriesRef.current.delete(parryIdentifier);
    }, EFFECT_DURATION);
  }, [
    parryIdentifier,
    position?.x,
    position?.y,
    position?.facing,
    position?.isPerfect,
    position?.playerNumber,
  ]); // Depend on stable identifier and position values

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
        const parryTiltSigned = effect.facing === -1 ? "55deg" : "-55deg";
        // Generate basic particles - fixed positions for performance
        const particlePositions = [[30, 40], [50, 30], [70, 50], [40, 70]];
        const particles = particlePositions.map(([top, left], i) => (
          <Particle
            key={`${effect.id}-particle-${i}`}
            className="particle"
            $isPerfect={effect.isPerfect}
            style={{ top: `${top}%`, left: `${left}%` }}
          />
        ));

        // Generate spark particles - simplified for performance
        const sparkElements = effect.sparks.map((spark) => (
          <Spark
            key={spark.id}
            className={`spark ${spark.isPerfect ? "spark-perfect" : "spark-regular"}`}
            style={{
              top: "50%",
              left: "50%",
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              background: spark.isPerfect 
                ? "linear-gradient(45deg, #00FFFF, #FFFFFF)" 
                : "linear-gradient(45deg, #FFFFFF, #00BFFF)",
              borderRadius: "50%",
            }}
          />
        ));

        return (
          <RawParryEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
            $isPerfect={effect.isPerfect}
          >
            <div
              className={`raw-parry-ring-wrapper ${
                effect.isPerfect ? "perfect" : "regular"
              }`}
              style={{ "--parry-ring-tilt-signed": parryTiltSigned }}
            >
              <div
                className={`raw-parry-ring ${
                  effect.isPerfect ? "perfect" : "regular"
                }`}
                style={{
                  transform: effect.facing === 1 ? "scaleX(-1)" : "scaleX(1)",
                }}
              />
              {/* Perfect parry speed lines - manga-style radial streaks */}
              {effect.isPerfect && (
                <div className="perfect-speed-lines">
                  {PERFECT_LINE_INDICES.map((i) => (
                    <div key={i} className="perfect-speed-line" />
                  ))}
                </div>
              )}
              <ParticleContainer className="raw-parry-particles">
                {particles}
              </ParticleContainer>
              {/* Spark container */}
              <ParticleContainer className="spark-particles">
                {sparkElements}
              </ParticleContainer>
            </div>
            {/* Centered text at the parry location */}
            <ParryTextCenter $isPerfect={effect.isPerfect}>
              {effect.isPerfect ? "PERFECT" : "PARRY"}
            </ParryTextCenter>
          </RawParryEffectContainer>
        );
      })}
    </>
  );
};

RawParryEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    isPerfect: PropTypes.bool,
    parryId: PropTypes.string,
    timestamp: PropTypes.number,
    playerNumber: PropTypes.number,
  }),
};

export default RawParryEffect;
