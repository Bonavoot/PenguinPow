/**
 * SmartSprite - Automatically handles both static images and animated spritesheets
 * 
 * This component detects if the provided src is a spritesheet and renders
 * the appropriate animation, or falls back to a static image.
 */

import React, { useMemo } from 'react';
import styled, { css, keyframes } from 'styled-components';

/**
 * Spritesheet configuration data
 * Maps image URLs (or identifiers) to their animation properties
 */
const SPRITESHEET_CONFIGS = new Map();

/**
 * Register a spritesheet configuration
 * Call this when importing spritesheets to register their animation data
 */
export function registerSpritesheet(src, config) {
  SPRITESHEET_CONFIGS.set(src, config);
}

/**
 * Check if a source is a registered spritesheet
 */
export function isSpritesheetSrc(src) {
  return SPRITESHEET_CONFIGS.has(src);
}

/**
 * Get spritesheet config for a source
 */
export function getSpritesheetConfig(src) {
  return SPRITESHEET_CONFIGS.get(src);
}

/**
 * Styled component for animated spritesheets
 */
const AnimatedSpriteDiv = styled.div.withConfig({
  shouldForwardProp: (prop) => ![
    '$src',
    '$frameCount',
    '$fps',
    '$x',
    '$y',
    '$facing',
    '$isLocalPlayer',
    '$zIndex',
    '$width',
  ].includes(prop),
}).attrs((props) => {
  const {
    $src,
    $frameCount = 1,
    $fps = 12,
    $x = 0,
    $y = 0,
    $facing = 1,
    $isLocalPlayer = false,
    $zIndex = 101,
    $width = 'min(16.609%, 511px)',
  } = props;
  
  const duration = $frameCount / $fps;
  
  return {
    style: {
      position: 'absolute',
      left: `${($x / 1280) * 100}%`,
      bottom: `${($y / 720) * 100}%`,
      width: $width,
      height: 'auto',
      aspectRatio: '1 / 1',
      backgroundImage: `url(${$src})`,
      backgroundSize: `${$frameCount * 100}% 100%`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0% 0',
      transform: $facing === 1 ? 'scaleX(1)' : 'scaleX(-1)',
      zIndex: $zIndex,
      pointerEvents: 'none',
      imageRendering: 'auto',
      filter: $isLocalPlayer
        ? 'drop-shadow(clamp(1px, 0.08cqw, 2.5px) 0 0 #000) drop-shadow(clamp(-2.5px, -0.08cqw, -1px) 0 0 #000) drop-shadow(0 clamp(1px, 0.08cqw, 2.5px) 0 #000) drop-shadow(0 clamp(-2.5px, -0.08cqw, -1px) 0 #000)'
        : 'drop-shadow(clamp(1px, 0.08cqw, 2.5px) 0 0 #000) drop-shadow(clamp(-2.5px, -0.08cqw, -1px) 0 0 #000) drop-shadow(0 clamp(1px, 0.08cqw, 2.5px) 0 #000) drop-shadow(0 clamp(-2.5px, -0.08cqw, -1px) 0 #000)',
      animationName: `spriteAnim_${$frameCount}`,
      animationDuration: `${duration}s`,
      animationTimingFunction: `steps(${$frameCount - 1})`,
      animationIterationCount: 'infinite',
      animationFillMode: 'forwards',
    },
  };
})`
  @keyframes spriteAnim_3 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_6 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_8 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_9 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_10 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_14 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_20 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_21 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_24 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_28 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_38 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
  @keyframes spriteAnim_39 { from { background-position: 0% 0; } to { background-position: 100% 0; } }
`;

/**
 * Styled component for static images (unchanged from original)
 */
const StaticImage = styled.img.withConfig({
  shouldForwardProp: (prop) => ![
    '$x',
    '$y',
    '$facing',
    '$isLocalPlayer',
    '$zIndex',
    '$width',
  ].includes(prop),
}).attrs((props) => {
  const {
    $x = 0,
    $y = 0,
    $facing = 1,
    $isLocalPlayer = false,
    $zIndex = 101,
    $width = 'min(16.609%, 511px)',
  } = props;
  
  return {
    style: {
      position: 'absolute',
      left: `${($x / 1280) * 100}%`,
      bottom: `${($y / 720) * 100}%`,
      width: $width,
      height: 'auto',
      transform: $facing === 1 ? 'scaleX(1)' : 'scaleX(-1)',
      zIndex: $zIndex,
      pointerEvents: 'none',
      filter: $isLocalPlayer
        ? 'drop-shadow(clamp(1px, 0.08cqw, 2.5px) 0 0 #000) drop-shadow(clamp(-2.5px, -0.08cqw, -1px) 0 0 #000) drop-shadow(0 clamp(1px, 0.08cqw, 2.5px) 0 #000) drop-shadow(0 clamp(-2.5px, -0.08cqw, -1px) 0 #000)'
        : 'drop-shadow(clamp(1px, 0.08cqw, 2.5px) 0 0 #000) drop-shadow(clamp(-2.5px, -0.08cqw, -1px) 0 0 #000) drop-shadow(0 clamp(1px, 0.08cqw, 2.5px) 0 #000) drop-shadow(0 clamp(-2.5px, -0.08cqw, -1px) 0 #000)',
    },
  };
})``;

/**
 * SmartSprite Component
 * 
 * Automatically renders either an animated spritesheet or static image
 * based on the src provided.
 */
const SmartSprite = ({
  src,
  x = 0,
  y = 0,
  facing = 1,
  isLocalPlayer = false,
  zIndex = 101,
  width = 'min(16.609%, 511px)',
  alt = '',
  ...rest
}) => {
  const config = SPRITESHEET_CONFIGS.get(src);
  
  if (config) {
    // Render as animated spritesheet
    return (
      <AnimatedSpriteDiv
        $src={src}
        $frameCount={config.frameCount}
        $fps={config.fps}
        $x={x}
        $y={y}
        $facing={facing}
        $isLocalPlayer={isLocalPlayer}
        $zIndex={zIndex}
        $width={width}
        {...rest}
      />
    );
  }
  
  // Render as static image
  return (
    <StaticImage
      src={src}
      alt={alt}
      $x={x}
      $y={y}
      $facing={facing}
      $isLocalPlayer={isLocalPlayer}
      $zIndex={zIndex}
      $width={width}
      {...rest}
    />
  );
};

export default SmartSprite;
