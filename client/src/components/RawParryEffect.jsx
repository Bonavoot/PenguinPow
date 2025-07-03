import { useEffect, useState, useRef, useMemo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./RawParryEffect.css";

const RawParryEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + (props.$facing === 1 ? -7: -2)}%`,
    bottom: `${(props.$y / 720) * 100 - 8}%`,
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
  width: 3px;
  height: 3px;
  background: ${props => props.$isPerfect 
    ? 'radial-gradient(circle, #87CEEB, #4169E1)' // Light blue to royal blue for perfect
    : 'radial-gradient(circle, #E6F3FF, #4169E1)'}; // Very light blue to royal blue for regular
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
  const EFFECT_DURATION = 400; // Match normal hit effect duration

  // Memoize the unique identifier to prevent unnecessary re-processing
  const parryIdentifier = useMemo(() => {
    if (!position) return null;
    return position.parryId || position.timestamp;
  }, [position?.parryId, position?.timestamp]);

  // Generate spark particles with realistic physics
  const generateSparks = (effectId, facing, isPerfect) => {
    const sparkCount = 16; // Same as hit effect
    const sparks = [];
    
    for (let i = 0; i < sparkCount; i++) {
      // Create full 360-degree explosion pattern like a firework
      const baseAngle = (i / sparkCount) * 360; // Distribute evenly around circle
      const angleVariation = (Math.random() - 0.5) * 40; // Add some randomness
      const angle = (baseAngle + angleVariation) * (Math.PI / 180);
      
      // Much more varied speeds for dramatic explosion effect
      const minSpeed = 60;
      const maxSpeed = 120;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      
      // More varied sizes for better visual impact
      const size = Math.random() * 6 + 2; // 2-8px range
      const life = 600 + Math.random() * 400; // 600-1000ms lifespan
      
      // Color schemes based on parry type
      const colors = isPerfect 
        ? [
            'linear-gradient(45deg, #4169E1, #FFD700)', // Royal blue to gold
            'linear-gradient(45deg, #87CEEB, #FFD700)', // Sky blue to gold
            'linear-gradient(45deg, #4169E1, #FFA500)', // Royal blue to orange
            'linear-gradient(45deg, #00BFFF, #FFD700)', // Deep sky blue to gold
            'linear-gradient(45deg, #1E90FF, #F0E68C)', // Dodger blue to khaki
            'linear-gradient(45deg, #4682B4, #FFD700)', // Steel blue to gold
          ]
        : [
            'linear-gradient(45deg, #FFFFFF, #4169E1)', // White to royal blue
            'linear-gradient(45deg, #E6F3FF, #1E90FF)', // Very light blue to dodger blue
            'linear-gradient(45deg, #FFFFFF, #87CEEB)', // White to sky blue
            'linear-gradient(45deg, #F0F8FF, #4169E1)', // Alice blue to royal blue
            'linear-gradient(45deg, #FFFFFF, #00BFFF)', // White to deep sky blue
            'linear-gradient(45deg, #E0F6FF, #4682B4)', // Very light blue to steel blue
          ];
      
      const spark = {
        id: `${effectId}-spark-${i}`,
        size,
        angle,
        speed,
        life,
        maxLife: life,
        x: 50, // Start at exact center
        y: 50, // Start at exact center
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15, // More dramatic rotation
        trail: Math.random() > 0.3, // More sparks have trails
        glow: Math.random() > 0.2, // Almost all sparks have glow
        sparkIndex: i, // For CSS targeting
        isPerfect, // Pass perfect status to spark
      };
      
      sparks.push(spark);
    }
    
    return sparks;
  };

  useEffect(() => {
    console.log('RawParryEffect useEffect triggered with position:', position);
    console.log('RawParryEffect parryIdentifier:', parryIdentifier);
    
    if (!position || !parryIdentifier) {
      if (position && !parryIdentifier) {
        console.warn('RawParryEffect: No unique identifier provided for parry', position);
      }
      return;
    }
    
    // Prevent duplicate processing of the same parry
    if (processedParriesRef.current.has(parryIdentifier)) {
      console.log('RawParryEffect: Duplicate parry prevented', parryIdentifier);
      return;
    }
    
    // Mark this parry as processed
    processedParriesRef.current.add(parryIdentifier);
    console.log('RawParryEffect: Creating new effect', parryIdentifier, 'isPerfect:', position.isPerfect);

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
      startTime: currentTime,
      parryId: parryIdentifier,
      sparks: generateSparks(effectId, position.facing || 1, position.isPerfect || false),
    };

    // Add the new effect to active effects
    setActiveEffects(prev => [...prev, newEffect]);

    // Remove this effect after duration and clean up tracking
    setTimeout(() => {
      setActiveEffects(prev => prev.filter(effect => effect.id !== effectId));
      processedParriesRef.current.delete(parryIdentifier);
    }, EFFECT_DURATION);

  }, [parryIdentifier, position?.x, position?.y, position?.facing, position?.isPerfect]); // Depend on stable identifier and position values

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
            className={`spark ${spark.isPerfect ? 'spark-perfect' : 'spark-regular'}`}
            style={{
              top: `${spark.y}%`,
              left: `${spark.x}%`,
              width: `${spark.size}px`,
              height: `${spark.size}px`, // Make it a perfect circle
              background: spark.color,
              borderRadius: '50%', // Perfect circle
              boxShadow: spark.glow ? `0 0 ${spark.size * 2}px ${spark.isPerfect ? '#4169E1' : '#4169E1'}` : 'none',
              filter: spark.glow ? 'brightness(1.2)' : 'none',
              transform: `rotate(${spark.rotation}deg)`,
              animationDelay: `${index * 10}ms`, // Stagger spark animations
            }}
          />
        ));

        return (
          <RawParryEffectContainer 
            key={effect.id}
            $x={effect.x} 
            $y={effect.y} 
            $facing={effect.facing}
          >
            <div className={`raw-parry-ring-wrapper ${effect.isPerfect ? 'perfect' : 'regular'}`}>
              <div 
                className={`raw-parry-ring ${effect.isPerfect ? 'perfect' : 'regular'}`}
                style={{ 
                  transform: effect.facing === 1 ? "scaleX(-1)" : "scaleX(1)" 
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
  }),
};

export default RawParryEffect; 