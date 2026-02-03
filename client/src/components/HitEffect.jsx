import { useEffect, useState, useRef, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

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

    // Create local effect
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      attackType: attackType,
      sparks: generateSparks(effectId),
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    const duration = attackType === 'charged' ? EFFECT_DURATION_CHARGED : EFFECT_DURATION_SLAP;
    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(hitIdentifier);
    }, duration);
  }, [hitIdentifier, position?.x, position?.y, position?.facing, position?.attackType]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  return (
    <>
      {/* Local impact effects */}
      {activeEffects.map((effect) => {
        const hitTypeClass = effect.attackType === 'charged' ? 'charged-hit' : 'slap-hit';
        
        // Spark color - white, clean and minimal
        const sparkColor = 'radial-gradient(circle, #fff 50%, #fff 100%)';

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
            <div className={`hit-ring-wrapper ${hitTypeClass}`}>
              <div className="hit-ring" />
              <div className="spark-particles">
                {sparkElements}
              </div>
              <div className="hit-particles">
                {particles}
              </div>
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
  }),
};

export default HitEffect;
