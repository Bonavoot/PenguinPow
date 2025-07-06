import { useEffect, useState, useRef, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";
import hitEffectImage from "../assets/hit-effect.png";

const HitEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? -2: -7)}%`,
    bottom: `${(props.$y / 720) * 100 - 5}%`,
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
  background: radial-gradient(circle, #FFFF99, #FFD700);
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
  const EFFECT_DURATION = 400; // Match normal hit effect duration

  // Memoize the unique identifier to prevent unnecessary re-processing
  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  // Generate spark particles with realistic physics
  const generateSparks = (effectId, facing) => {
    const sparkCount = 16; // Increase count for better firework effect
    const sparks = [];
    
    // Get viewport dimensions to calculate responsive speeds (further reduced scale)
    const viewportWidth = window.innerWidth;
    const baseSpeedMultiplier = (viewportWidth / 1280) * 0.6; // Further reduced from 0.8 to 0.6
    
    for (let i = 0; i < sparkCount; i++) {
      // Create full 360-degree explosion pattern like a firework
      const baseAngle = (i / sparkCount) * 360; // Distribute evenly around circle
      const angleVariation = (Math.random() - 0.5) * 15; // Reduced randomness from 40 to 15 degrees
      const angle = (baseAngle + angleVariation) * (Math.PI / 180);
      
      // Use more consistent speeds for even circle pattern
      const baseSpeed = 6.5 * baseSpeedMultiplier; // ~85px at 1280px width
      const speedVariation = baseSpeed * 0.2; // Only 20% speed variation
      const speed = baseSpeed + (Math.random() - 0.5) * speedVariation;
      
      // More varied sizes for better visual impact - scale with viewport
      const baseSize = 2 * baseSpeedMultiplier; // Scale particle size with viewport
      const size = Math.random() * (6 * baseSpeedMultiplier) + baseSize; // 2-8px range scaled
      const life = 600 + Math.random() * 400; // 600-1000ms lifespan
      
      // Mixed white and yellow spark colors to match hit effect
      const colors = [
        'linear-gradient(45deg, #FFFFFF, #FFD700)', // White to gold
        'linear-gradient(45deg, #FFFFFF, #FFFF99)', // White to light yellow
        'linear-gradient(45deg, #FFFFFF, #F0F0F0)', // Pure white
        'linear-gradient(45deg, #FFFF99, #FFD700)', // Light yellow to gold
        'linear-gradient(45deg, #FFFFFF, #E0E0E0)', // White to light gray
        'linear-gradient(45deg, #FFD700, #CC9900)', // Gold to darker gold
      ];
      
      const spark = {
        id: `${effectId}-spark-${i}`,
        size,
        angle,
        speed,
        life,
        maxLife: life,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15, // More dramatic rotation
        trail: Math.random() > 0.3, // More sparks have trails
        glow: Math.random() > 0.2, // Almost all sparks have glow
        sparkIndex: i, // For CSS targeting
      };
      
      sparks.push(spark);
    }
    
    return sparks;
  };

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

    // Create new effect with sparks
    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      startTime: currentTime,
      hitId: hitIdentifier,
      sparks: generateSparks(effectId, position.facing || 1),
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
        // Generate basic particles for this effect (existing system)
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

        // Generate spark particles
        const sparkElements = effect.sparks.map((spark, index) => (
          <Spark
            key={spark.id}
            className="spark"
            style={{
              top: '50%',
              left: '50%',
              width: `${spark.size}px`,
              height: `${spark.size}px`, // Make it a perfect circle
              background: spark.color,
              borderRadius: '50%', // Perfect circle
              boxShadow: spark.glow ? `0 0 ${spark.size * 2}px ${spark.color.includes('FFD700') ? '#FFD700' : '#FFFFFF'}` : 'none',
              filter: spark.glow ? 'brightness(1.2)' : 'none',
              transform: `translate(-50%, -50%) rotate(${spark.rotation}deg)`,
              animationDelay: `${index * 10}ms`, // Stagger spark animations
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
              />
              <ParticleContainer className="hit-particles">
                {particles}
              </ParticleContainer>
              {/* Spark container */}
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
