import { useEffect, useState, useRef, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";
import hitEffectImage from "../assets/hit-effect.png";

const HitEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? 0 : -5)}%`,
    bottom: `${(props.$y / 720) * 100 - 2}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

// const HitImage = styled.img`
//   position: absolute;
//   top: 50%;
//   left: 50%;
//   transform: translate(-50%, -50%) rotate(25deg);
//   width: 120%;
//   height: 120%;
//   object-fit: contain;
//   opacity: 0;
//   z-index: 10;
//   filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8));
//   animation: imageFlash 0.4s ease-out forwards;

//   @keyframes imageFlash {
//     0% {
//       opacity: 0;
//       transform: translate(-50%, -50%) rotate(20deg) scale(0.7);
//       filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) brightness(1.4);
//     }
//     20% {
//       opacity: 1;
//       transform: translate(-50%, -50%) rotate(25deg) scale(1.0);
//       filter: drop-shadow(0 0 10px rgba(255, 215, 0, 1)) brightness(1.6);
//     }
//     50% {
//       opacity: 0.8;
//       transform: translate(-50%, -50%) rotate(30deg) scale(1.1);
//       filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6)) brightness(1.2);
//     }
//     100% {
//       opacity: 0;
//       transform: translate(-50%, -50%) rotate(35deg) scale(1.2);
//       filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.3)) brightness(1);
//     }
//   }
// `;

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
  width: 3px;
  height: 3px;
  background: radial-gradient(circle, #FFFF99, #FFD700);
  border-radius: 50%;
  opacity: 0;
`;

const HitEffect = ({ position }) => {
  // Track multiple active effects with unique IDs
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set()); // Track processed hit IDs to prevent duplicates
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 400; // Longer duration to ensure visibility

  // Memoize the unique identifier to prevent unnecessary re-processing
  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  useEffect(() => {
    if (!position || !hitIdentifier) {
      if (position && !hitIdentifier) {
        console.warn('HitEffect: No unique identifier provided for hit', position);
      }
      return;
    }
    
    // Prevent duplicate processing of the same hit
    if (processedHitsRef.current.has(hitIdentifier)) {
      console.log('HitEffect: Duplicate hit prevented', hitIdentifier);
      return;
    }
    
    // Mark this hit as processed
    processedHitsRef.current.add(hitIdentifier);
    console.log('HitEffect: Creating new effect', hitIdentifier);

    // Create unique effect ID
    const effectId = ++effectIdCounter.current;
    const currentTime = Date.now();

    // Create new effect
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      startTime: currentTime,
      hitId: hitIdentifier,
    };

    // Add the new effect to active effects
    setActiveEffects(prev => [...prev, newEffect]);

    // Remove this effect after duration and clean up tracking
    setTimeout(() => {
      setActiveEffects(prev => prev.filter(effect => effect.id !== effectId));
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
        // Generate particles for this effect
        const particles = Array.from({ length: 4 }, (_, i) => (
          <Particle 
            key={`${effect.id}-particle-${i}`}
            className="particle"
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${20 + Math.random() * 60}%`,
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
              <div 
                className="hit-ring" 
                style={{ 
                  transform: effect.facing === 1 ? "scaleX(-1)" : "scaleX(1)" 
                }}
              >
                {/* <HitImage 
                  src={hitEffectImage} 
                  alt="Hit effect" 
                  style={{ 
                    transform: effect.facing === 1 
                      ? "translate(-50%, -50%) rotate(25deg) scaleX(-1)" 
                      : "translate(-50%, -50%) rotate(25deg) scaleX(1)" 
                  }}
                /> */}
              </div>
              <ParticleContainer className="hit-particles">
                {particles}
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
