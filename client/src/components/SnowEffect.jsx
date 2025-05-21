import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";

const GROUND_LEVEL = 650; // Main ground level constant
const DEPTH_LEVELS = [
  { level: GROUND_LEVEL - 300, probability: 0.2 }, // Far background snow
  { level: GROUND_LEVEL - 150, probability: 0.3 }, // Mid background snow
  { level: GROUND_LEVEL, probability: 0.5 }, // Foreground snow
];

// Performance settings
const MAX_SNOWFLAKES = 50; // Reduced from 100
const UPDATE_INTERVAL = 32; // Update every 32ms instead of 16ms
const USE_BLUR = false; // Disable blur effect for better performance

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
`;

const Snowflake = styled.div.attrs((props) => ({
  style: {
    transform: `translate(${props.$x}px, ${props.$y}px) scale(${props.$scale})`,
    opacity: props.$opacity,
    ...(USE_BLUR && { filter: `blur(${props.$blur}px)` }),
  },
}))`
  position: absolute;
  width: 6px;
  height: 6px;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0) 70%
  );
  border-radius: 50%;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
`;

const SnowEffect = () => {
  const [snowflakes, setSnowflakes] = useState([]);
  const lastUpdateTime = useRef(0);
  const animationFrameRef = useRef(null);
  const isLowPerformance = useRef(false);

  // Check for low performance
  useEffect(() => {
    const checkPerformance = () => {
      const fps = 1000 / (performance.now() - lastUpdateTime.current);
      isLowPerformance.current = fps < 30;
    };

    const performanceCheckInterval = setInterval(checkPerformance, 1000);
    return () => clearInterval(performanceCheckInterval);
  }, []);

  const getRandomDepthLevel = useCallback(() => {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const { level, probability } of DEPTH_LEVELS) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        return level;
      }
    }
    return GROUND_LEVEL;
  }, []);

  const createSnowflake = useCallback(
    (initialY = -10) => {
      const depthLevel = getRandomDepthLevel();
      return {
        id: Math.random(),
        x: Math.random() * window.innerWidth,
        y: initialY,
        velocityX: (Math.random() - 0.5) * 0.5,
        velocityY: 1 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.5,
        scale: 0.5 + Math.random() * 1,
        blur: Math.random() * 0.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2,
        depthLevel,
      };
    },
    [getRandomDepthLevel]
  );

  const updateSnowflake = useCallback(
    (snowflake, deltaTime) => {
      const newY = snowflake.y + snowflake.velocityY * (deltaTime / 16);
      const newX = snowflake.x + snowflake.velocityX * (deltaTime / 16);

      if (newY >= snowflake.depthLevel) {
        return createSnowflake();
      }

      let finalX = newX;
      if (newX < -10) finalX = window.innerWidth + 10;
      if (newX > window.innerWidth + 10) finalX = -10;

      return {
        ...snowflake,
        x: finalX,
        y: newY,
        rotation: snowflake.rotation + snowflake.rotationSpeed,
      };
    },
    [createSnowflake]
  );

  useEffect(() => {
    // Create initial snowflakes with distributed y-positions
    const initialSnowflakes = Array.from(
      { length: MAX_SNOWFLAKES },
      (_, index) => {
        // Distribute snowflakes across the top portion of the screen
        const initialY = -10 - index * (window.innerHeight / MAX_SNOWFLAKES);
        return createSnowflake(initialY);
      }
    );
    setSnowflakes(initialSnowflakes);

    const animate = (timestamp) => {
      if (!lastUpdateTime.current) {
        lastUpdateTime.current = timestamp;
      }

      const deltaTime = timestamp - lastUpdateTime.current;

      if (deltaTime >= UPDATE_INTERVAL) {
        setSnowflakes((prevSnowflakes) => {
          const updatedSnowflakes = prevSnowflakes
            .map((snowflake) => updateSnowflake(snowflake, deltaTime))
            .filter((snowflake) => snowflake.y < snowflake.depthLevel);

          // Add new snowflakes if needed, but respect performance mode
          const targetCount = isLowPerformance.current
            ? MAX_SNOWFLAKES / 2
            : MAX_SNOWFLAKES;
          while (updatedSnowflakes.length < targetCount) {
            updatedSnowflakes.push(createSnowflake());
          }

          return updatedSnowflakes;
        });

        lastUpdateTime.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [createSnowflake, updateSnowflake]);

  return (
    <SnowContainer>
      {snowflakes.map((snowflake) => (
        <Snowflake
          key={snowflake.id}
          $x={snowflake.x}
          $y={snowflake.y}
          $opacity={snowflake.opacity}
          $scale={snowflake.scale}
          $blur={snowflake.blur}
        />
      ))}
    </SnowContainer>
  );
};

export default SnowEffect;
