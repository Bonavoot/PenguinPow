import { useEffect, useState, useRef, useMemo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

// Text pop animation for counter hit text
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

const HitEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -4 : -4)}%;
  bottom: ${props => (props.$y / 720) * 100 - 5}%;
  transform: translate(-50%, -50%);
  z-index: 100;
  pointer-events: none;
`;

// Spark element
const Spark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
  border-radius: 50%;
`;

// Particle element
const Particle = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
`;

// Counter hit centered text
const CounterText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.6vw, 1.4rem);
  color: #FF2222;
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 15px rgba(255, 34, 34, 0.9),
    0 0 30px rgba(255, 0, 0, 0.7);
  letter-spacing: 0.15em;
  white-space: nowrap;
  transform: translate(-50%, -50%) scale(0);
  animation: ${textPop} 0.6s ease-out forwards;
  animation-delay: 0.05s;
  pointer-events: none;
  z-index: 101;
`;

const HitEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  
  const EFFECT_DURATION_SLAP = 350;
  const EFFECT_DURATION_CHARGED = 550;

  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  // Counter hit color - red (classic fighting game counter hit color)
  const COUNTER_HIT_COLOR = '#FF2222';

  // Generate sparks
  const generateSparks = (effectId) => {
    const sparkCount = 6;
    const sparks = [];
    const baseSize = 10;

    for (let i = 0; i < sparkCount; i++) {
      sparks.push({
        id: `${effectId}-spark-${i}`,
        size: baseSize + Math.random() * 5,
      });
    }
    return sparks;
  };

  useEffect(() => {
    if (!position || !hitIdentifier) return;
    if (processedHitsRef.current.has(hitIdentifier)) return;

    processedHitsRef.current.add(hitIdentifier);

    const effectId = ++effectIdCounter.current;
    const attackType = position.attackType || 'slap';
    const isCounterHit = position.isCounterHit || false;

    // Create local effect
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      attackType: attackType,
      isCounterHit: isCounterHit,
      sparks: generateSparks(effectId),
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    const duration = attackType === 'charged' ? EFFECT_DURATION_CHARGED : EFFECT_DURATION_SLAP;
    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(hitIdentifier);
    }, duration);
  }, [hitIdentifier, position?.x, position?.y, position?.facing, position?.attackType, position?.isCounterHit]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  return (
    <>
      {/* Local impact effects */}
      {activeEffects.map((effect) => {
        const hitTypeClass = effect.attackType === 'charged' ? 'charged-hit' : 'slap-hit';
        const counterHitClass = effect.isCounterHit ? 'counter-hit' : '';
        
        // Spark color - white normally, orange for counter hits
        const sparkColor = effect.isCounterHit 
          ? `radial-gradient(circle, ${COUNTER_HIT_COLOR} 50%, ${COUNTER_HIT_COLOR} 100%)`
          : 'radial-gradient(circle, #fff 50%, #fff 100%)';

        const sparkElements = effect.sparks.map((spark) => (
          <Spark
            key={spark.id}
            className="spark"
            style={{
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              background: sparkColor,
            }}
          />
        ));

        const particles = [0, 1, 2, 3].map((i) => (
          <Particle key={`${effect.id}-p-${i}`} className="particle" />
        ));

        return (
          <HitEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div className={`hit-ring-wrapper ${hitTypeClass} ${counterHitClass}`}>
              <div className="hit-ring" />
              <div className="spark-particles">
                {sparkElements}
              </div>
              <div className="hit-particles">
                {particles}
              </div>
              {/* Counter hit centered text */}
              {effect.isCounterHit && <CounterText>COUNTER</CounterText>}
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
    attackType: PropTypes.string,
    hitId: PropTypes.string,
    timestamp: PropTypes.number,
    isCounterHit: PropTypes.bool,
  }),
};

export default HitEffect;
