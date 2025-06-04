# 🎮 PenguinPow Spritesheet System

## Overview

This is a high-performance spritesheet animation system built specifically for PenguinPow's Steam release. It replaces memory-intensive GIFs and APNGs with optimized spritesheets that provide:

- **44% smaller file sizes** (e.g., pumoWaddle2: 1.8MB → 1.0MB)
- **Significantly reduced memory usage**
- **Precise frame timing control**
- **Smooth 60fps animations**
- **No dependency on external libraries**

## System Architecture

### Core Components

1. **`spritesheetManager.js`** - Core animation engine with performance optimization
2. **`SpriteSheet.jsx`** - React component for rendering animated spritesheets
3. **Game Integration** - Seamless integration with existing styled-components system

### Performance Features

- **Global Animation Manager**: Single `requestAnimationFrame` loop for all animations
- **Automatic Cleanup**: Non-looping animations self-destruct after completion
- **Memory Efficient**: Only loads visible frames, automatic garbage collection
- **Frame-Perfect Timing**: Uses `performance.now()` for precise timing

## Currently Implemented

✅ **pumoWaddle2** - Player 1 strafing animation (21 frames, 12 FPS)  
✅ **dodging** - Dodge effect animation (4 frames, 8 FPS)  
✅ **chargedAttackSmoke** - Charged attack smoke effect (12 frames, 14 FPS)

## How to Add New Spritesheets

### 1. Convert Asset to Spritesheet

Use the conversion commands we set up:

```bash
# For GIFs
magick input.gif -coalesce +append output-spritesheet.png

# For APNGs (requires apngasm)
mkdir temp_frames
apngasm -o temp_frames -D input.png
magick temp_frames/*.png +append output-spritesheet.png
rm -rf temp_frames
```

### 2. Add to Configuration

Edit `client/src/utils/spritesheetManager.js`:

```javascript
export const SPRITESHEET_CONFIG = {
  // ... existing configs ...
  newAnimation: {
    src: newAnimationSpritesheet,
    frameWidth: 1024, // Width of each frame
    frameHeight: 1024, // Height of each frame
    totalFrames: 8, // Total number of frames
    frameRate: 10, // Animation speed (FPS)
    loop: true, // Whether to loop
    totalWidth: 8192, // Total spritesheet width
  },
};
```

### 3. Import the Spritesheet File

```javascript
import newAnimationSpritesheet from "../assets/new-animation-spritesheet.png";
```

### 4. Integrate in Components

For game fighters, modify the conditional logic in `GameFighter.jsx`:

```javascript
// In getImageSrc function
if (someCondition) return "SPRITESHEET_newAnimation";

// In shouldUseSpritesheet function
const shouldUseSpritesheet = (fighter, state1, state2) => {
  return state1 && state2; // Your conditions
};

// In render section
{shouldUseSpritesheet(...) ? (
  <SpriteSheet
    spritesheetKey="newAnimation"
    isPlaying={someCondition}
    x={x} y={y} facing={facing}
    // ... other props
  />
) : (
  // Regular StyledImage
)}
```

## Performance Guidelines

### Optimal Frame Rates by Animation Type

- **Character Movement**: 8-12 FPS (waddle, walk)
- **Combat Actions**: 12-16 FPS (attacks, dodges)
- **Effects**: 14-18 FPS (smoke, particles)
- **UI Animations**: 6-10 FPS (menus, transitions)

### Memory Optimization

- **Frame Size**: Keep individual frames ≤ 1024x1024px when possible
- **Frame Count**: Aim for ≤ 24 frames per animation
- **Compression**: Use PNG with optimization
- **Cleanup**: Non-looping animations auto-cleanup after completion

## Conversion Results

| Asset                | Original   | Spritesheet | Savings | Status      |
| -------------------- | ---------- | ----------- | ------- | ----------- |
| pumoWaddle2          | 1.8MB APNG | 1.0MB PNG   | 44%     | ✅ Complete |
| dodging              | 151KB GIF  | ~87KB PNG   | 42%     | ✅ Complete |
| charged-attack-smoke | 175KB GIF  | ~145KB PNG  | 17%     | ✅ Complete |

## Next Priority Assets to Convert

1. **beingGrabbed.gif** / **beingGrabbed2.gif** - High impact (used frequently)
2. **All remaining GIFs** in assets folder
3. **Animated PNGs** (snowball-throw2, etc.)

## Usage Examples

### Basic Animation

```jsx
<SpriteSheet
  spritesheetKey="pumoWaddle2"
  isPlaying={isWalking}
  x={playerX}
  y={playerY}
  facing={playerFacing}
/>
```

### Effect Animation with Callback

```jsx
<SpriteSheet
  spritesheetKey="chargedAttackSmoke"
  isPlaying={showEffect}
  x={effectX}
  y={effectY}
  onAnimationComplete={() => setShowEffect(false)}
/>
```

## Steam Performance Impact

This system provides significant benefits for Steam deployment:

- **Faster Loading**: Smaller file sizes mean faster download/install
- **Lower Memory Usage**: Critical for players with limited RAM
- **Smoother Gameplay**: Consistent frame timing eliminates animation stutters
- **Better Compatibility**: No reliance on browser GIF/APNG support variations

## Technical Notes

- Uses CSS `background-position` for frame switching (GPU accelerated)
- Single global `requestAnimationFrame` loop for all animations
- Automatic preloading of spritesheet images at app startup
- Full backwards compatibility with existing asset system
