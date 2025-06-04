import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import { SPRITESHEET_CONFIG } from "../utils/spritesheetManager";

/**
 * SpriteSheet Component for PenguinPow Game
 * Handles animated spritesheets with optimized performance
 * Seamlessly integrates with existing styled-components system
 */

const SpritesheetContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    zIndex: props.$zIndex || 99,
    filter:
      props.$filter ||
      "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
    animation: props.$animation || "none",
    width: "18.4%",
    aspectRatio: "1 / 1",
    pointerEvents: "none",
    willChange: "transform, bottom, left, filter, opacity",
    overflow: "hidden",
  },
}))`
  overflow: hidden;
`;

const SpritesheetImage = styled.div.attrs((props) => ({
  style: {
    width: "100%",
    height: "100%",
    transform: `scaleX(${props.$facing})`,
    backgroundImage: `url(${props.$backgroundImage})`,
    backgroundSize: `${props.$totalFrames * 100}% 100%`,
    backgroundPosition: props.$backgroundPosition,
    backgroundRepeat: "no-repeat",
    display: "block",
    opacity: props.$isVisible ? 1 : 0,
  },
}))`
  transition: none;
`;

const SpriteSheet = ({
  spritesheetKey,
  isPlaying = false,
  x = 0,
  y = 0,
  facing = 1,
  zIndex = 99,
  filter,
  animation,
  onAnimationComplete,
  className,
  style,
  ...otherProps
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const animationRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);

  // Get spritesheet config
  const config = SPRITESHEET_CONFIG[spritesheetKey];

  // Check if component is visible (not display: none)
  const isVisible = !style?.display || style.display !== "none";

  useEffect(() => {
    if (!config) {
      console.error(`SpriteSheet config not found: ${spritesheetKey}`);
      return;
    }

    isPlayingRef.current = isPlaying && isVisible;

    if (isPlaying && isVisible) {
      // Immediately set frame 0 to prevent empty frames
      setCurrentFrame(0);
      lastUpdateTimeRef.current = performance.now();

      // Calculate frame duration in milliseconds
      const frameDuration = 1000 / config.frameRate;

      const animate = (currentTime) => {
        if (!isPlayingRef.current) return;

        if (currentTime - lastUpdateTimeRef.current >= frameDuration) {
          setCurrentFrame((prevFrame) => {
            const nextFrame = prevFrame + 1;

            if (nextFrame >= config.totalFrames) {
              if (config.loop) {
                return 0; // Loop back to start
              } else {
                // Animation completed
                if (onAnimationComplete) {
                  onAnimationComplete();
                }
                return config.totalFrames - 1; // Stay on last frame
              }
            }

            return nextFrame;
          });

          lastUpdateTimeRef.current = currentTime;
        }

        if (isPlayingRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Stop animation when not playing or not visible
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (!isVisible) {
        setCurrentFrame(0); // Reset to frame 0 when hidden
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, isVisible, spritesheetKey, config, onAnimationComplete]);

  if (!config) {
    // Fallback: render nothing if config is missing
    return null;
  }

  // Get current position using percentage positioning that aligns with scaled background
  let finalBackgroundPosition = "0% 0%";
  if (currentFrame >= 0 && currentFrame < config.totalFrames) {
    // With background-size at totalFrames * 100%, we need to position in increments
    // that correspond to frame boundaries. Each frame boundary is at currentFrame/(totalFrames-1) * 100%
    const positionPercent = (currentFrame / (config.totalFrames - 1)) * 100;
    finalBackgroundPosition = `${positionPercent}% 0%`;
  }

  return (
    <SpritesheetContainer
      className={className}
      $x={x}
      $y={y}
      $facing={facing}
      $zIndex={zIndex}
      $filter={filter}
      $animation={animation}
      {...otherProps}
    >
      <SpritesheetImage
        $backgroundImage={config.src}
        $backgroundPosition={finalBackgroundPosition}
        $totalFrames={config.totalFrames}
        $facing={facing}
        $isVisible={isVisible}
      />
    </SpritesheetContainer>
  );
};

SpriteSheet.propTypes = {
  spritesheetKey: PropTypes.string.isRequired,
  isPlaying: PropTypes.bool,
  x: PropTypes.number,
  y: PropTypes.number,
  facing: PropTypes.number,
  zIndex: PropTypes.number,
  filter: PropTypes.string,
  animation: PropTypes.string,
  onAnimationComplete: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default SpriteSheet;
