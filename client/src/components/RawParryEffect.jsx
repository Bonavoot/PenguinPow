import { useEffect, useState, useRef, useMemo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";

// Animation for text appearing on the side of the screen (fighting game style)
const textSlideIn = keyframes`
  0% {
    transform: translateX(var(--slide-dir)) scale(0.5);
    opacity: 0;
  }
  10% {
    transform: translateX(0) scale(1.2);
    opacity: 1;
  }
  18% {
    transform: translateX(0) scale(0.95);
    opacity: 1;
  }
  25% {
    transform: translateX(0) scale(1.05);
    opacity: 1;
  }
  32% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  65% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 0;
  }
`;

// Animation for centered text - matches GrabBreakEffect textPop
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

// Text positioned on player's side of the screen (like combo counter)
const ParryTextSide = styled.div`
  position: fixed;
  /* Position near vertical center of screen */
  top: clamp(180px, 45%, 320px);
  ${props => props.$isLeftSide ? 'left: 3%;' : 'right: 3%;'}
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.6rem, 1.5vw, 1.2rem);
  line-height: 1.1;
  color: ${props => props.$isPerfect ? '#FFD700' : '#00BFFF'};
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px ${props => props.$isPerfect ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 191, 255, 0.9)'};
  letter-spacing: 0.1em;
  white-space: pre-line;
  --slide-dir: ${props => props.$isLeftSide ? '-50px' : '50px'};
  animation: ${textSlideIn} 1.5s ease-out forwards;
  z-index: 200;
  pointer-events: none;
  text-align: center;
`;

// Centered text that appears at the parry location - matches GrabBreakEffect positioning and animation
const ParryTextCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.7rem, 1.6vw, 1.4rem);
  color: ${props => props.$isPerfect ? '#FFD700' : '#00BFFF'};
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px ${props => props.$isPerfect ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 191, 255, 0.9)'};
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${textPop} 0.6s ease-out forwards;
  animation-delay: 0.05s;
  pointer-events: none;
`;

const RawParryEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    // Position in front of the parrying player (same as hit effect positioning)
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? -2 : -4)}%`,
    bottom: `${(props.$y / 720) * 100 + 5}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

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

// Centered text that appears at the parry location
const CenteredParryText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.8rem, 2vw, 1.6rem);
  font-weight: 400;
  color: ${props => props.$isPerfect ? '#FFD700' : '#00BFFF'};
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px ${props => props.$isPerfect ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 191, 255, 0.9)'};
  letter-spacing: 0.1em;
  white-space: nowrap;
  z-index: 101;
  pointer-events: none;
  animation: parryTextPop 1.5s ease-out forwards;
  
  @keyframes parryTextPop {
    0% {
      transform: translate(-50%, -50%) scale(0.3);
      opacity: 0;
    }
    10% {
      transform: translate(-50%, -50%) scale(1.3);
      opacity: 1;
    }
    18% {
      transform: translate(-50%, -50%) scale(0.95);
      opacity: 1;
    }
    25% {
      transform: translate(-50%, -50%) scale(1.05);
      opacity: 1;
    }
    32% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    65% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
`;

const RawParryEffect = ({ position }) => {
  // Track multiple active effects with unique IDs
  const [activeEffects, setActiveEffects] = useState([]);
  const processedParriesRef = useRef(new Set()); // Track processed parry IDs to prevent duplicates
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1600; // Must be longer than the text animation (1.5s)

  // Memoize the unique identifier to prevent unnecessary re-processing
  const parryIdentifier = useMemo(() => {
    if (!position) return null;
    return position.parryId || position.timestamp;
  }, [position?.parryId, position?.timestamp]);

  // Generate spark particles - optimized for performance
  const generateSparks = (effectId, facing, isPerfect) => {
    const sparkCount = 8; // Reduced from 16 for better performance
    const sparks = [];

    // Get viewport dimensions to calculate responsive speeds
    const viewportWidth = window.innerWidth;
    const baseSpeedMultiplier = (viewportWidth / 1280) * 0.6;

    for (let i = 0; i < sparkCount; i++) {
      // Create full 360-degree explosion pattern
      const baseAngle = (i / sparkCount) * 360;
      const angle = baseAngle * (Math.PI / 180);

      const baseSpeed = 6.5 * baseSpeedMultiplier;
      const speed = baseSpeed + (Math.random() - 0.5) * baseSpeed * 0.2;

      const baseSize = 2 * baseSpeedMultiplier;
      const size = Math.random() * (6 * baseSpeedMultiplier) + baseSize;

      // Blue/cyan color schemes - distinct from hit effect gold
      const colors = isPerfect
        ? [
            "linear-gradient(45deg, #00FFFF, #FFFFFF)",
            "linear-gradient(45deg, #00BFFF, #00FFFF)",
          ]
        : [
            "linear-gradient(45deg, #FFFFFF, #00BFFF)",
            "linear-gradient(45deg, #87CEEB, #00CED1)",
          ];

      const spark = {
        id: `${effectId}-spark-${i}`,
        size,
        angle,
        speed,
        color: colors[i % colors.length],
        sparkIndex: i,
        isPerfect,
      };

      sparks.push(spark);
    }

    return sparks;
  };

  useEffect(() => {
    console.log("RawParryEffect useEffect triggered with position:", position);
    console.log("RawParryEffect parryIdentifier:", parryIdentifier);

    if (!position || !parryIdentifier) {
      if (position && !parryIdentifier) {
        console.warn(
          "RawParryEffect: No unique identifier provided for parry",
          position
        );
      }
      return;
    }

    // Prevent duplicate processing of the same parry
    if (processedParriesRef.current.has(parryIdentifier)) {
      console.log("RawParryEffect: Duplicate parry prevented", parryIdentifier);
      return;
    }

    // Mark this parry as processed
    processedParriesRef.current.add(parryIdentifier);
    console.log(
      "RawParryEffect: Creating new effect",
      parryIdentifier,
      "isPerfect:",
      position.isPerfect
    );

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
      sparks: generateSparks(
        effectId,
        position.facing || 1,
        position.isPerfect || false
      ),
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
        // Generate basic particles for this effect (existing system)
        const particles = Array.from({ length: 4 }, (_, i) => (
          <Particle
            key={`${effect.id}-particle-${i}`}
            className="particle"
            $isPerfect={effect.isPerfect}
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${20 + Math.random() * 60}%`,
            }}
          />
        ));

        // Generate spark particles
        const sparkElements = effect.sparks.map((spark, index) => (
          <Spark
            key={spark.id}
            className={`spark ${
              spark.isPerfect ? "spark-perfect" : "spark-regular"
            }`}
            style={{
              top: "50%",
              left: "50%",
              width: `${spark.size}px`,
              height: `${spark.size}px`, // Make it a perfect circle
              background: spark.color,
              borderRadius: "50%", // Perfect circle
              boxShadow: spark.glow
                ? `0 0 ${spark.size * 2}px ${
                    spark.isPerfect ? "#00FFFF" : "#00BFFF"
                  }`
                : "none",
              filter: spark.glow ? "brightness(1.2)" : "none",
              transform: `translate(-50%, -50%) rotate(${spark.rotation}deg)`,
              animationDelay: `${index * 10}ms`, // Stagger spark animations
            }}
          />
        ));

        // Player 1's text appears on the LEFT, Player 2's text appears on the RIGHT
        const isLeftSide = effect.playerNumber === 1;

        return (
          <div key={effect.id}>
            <RawParryEffectContainer
              $x={effect.x}
              $y={effect.y}
              $facing={effect.facing}
            >
              <div
                className={`raw-parry-ring-wrapper ${
                  effect.isPerfect ? "perfect" : "regular"
                }`}
              >
                <div
                  className={`raw-parry-ring ${
                    effect.isPerfect ? "perfect" : "regular"
                  }`}
                  style={{
                    transform: effect.facing === 1 ? "scaleX(-1)" : "scaleX(1)",
                  }}
                />
                <ParticleContainer className="raw-parry-particles">
                  {particles}
                </ParticleContainer>
                {/* Spark container */}
                <ParticleContainer className="spark-particles">
                  {sparkElements}
                </ParticleContainer>
              </div>
              {/* Centered text at the parry location - positioned like GrabBreakEffect */}
              <ParryTextCenter $isPerfect={effect.isPerfect}>
                {effect.isPerfect ? "PERFECT" : "PARRY"}
              </ParryTextCenter>
            </RawParryEffectContainer>
            {/* Parry text on player's side of screen */}
            <ParryTextSide $isPerfect={effect.isPerfect} $isLeftSide={isLeftSide}>
              {effect.isPerfect ? "PERFECT\nPARRY" : "PARRY"}
            </ParryTextSide>
          </div>
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
