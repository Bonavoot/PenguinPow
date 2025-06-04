/**
 * SpriteSheet Manager for PenguinPow Game
 * Handles all animated spritesheets with performance optimization
 * Built for Steam deployment with precise timing and memory efficiency
 */

import pumoWaddle2Spritesheet from "../assets/pumo-waddle2-spritesheet-21frames.png";
import pumoWaddleSpritesheet from "../assets/pumo-waddle-spritesheet-21frames.png";
import dodgingSpritesheet from "../assets/dodging-spritesheet.png";
import chargedAttackSmokeSpritesheet from "../assets/charged-attack-smoke-spritesheet.png";
import testSpritesheet from "../assets/test-spritesheet.png";

// Spritesheet configurations
export const SPRITESHEET_CONFIG = {
  test: {
    src: testSpritesheet,
    frameWidth: 1024,
    frameHeight: 1024,
    totalFrames: 3,
    frameRate: 2, // Very slow for easy observation
    loop: true,
    totalWidth: 3072, // 3 * 1024
  },
  pumoWaddle2: {
    src: pumoWaddle2Spritesheet,
    frameWidth: 1024,
    frameHeight: 1024,
    totalFrames: 21,
    frameRate: 40, // Increased for faster, more responsive animation
    loop: true,
    totalWidth: 21504, // 21 * 1024
  },
  pumoWaddle: {
    src: pumoWaddleSpritesheet,
    frameWidth: 1024,
    frameHeight: 1024,
    totalFrames: 21,
    frameRate: 40, // Same as pumoWaddle2 for consistency
    loop: true,
    totalWidth: 21504, // 21 * 1024
  },
  dodging: {
    src: dodgingSpritesheet,
    frameWidth: 1024,
    frameHeight: 1024,
    totalFrames: 4,
    frameRate: 8, // Faster for dodge effect
    loop: false,
    totalWidth: 4096, // 4 * 1024
  },
  chargedAttackSmoke: {
    src: chargedAttackSmokeSpritesheet,
    frameWidth: 800,
    frameHeight: 450,
    totalFrames: 12,
    frameRate: 14, // Fast smoke animation
    loop: false,
    totalWidth: 9600, // 12 * 800
  },
};

/**
 * SpriteSheet Animation Manager Class
 * Handles individual sprite animation instances with precise timing
 */
export class SpriteSheetAnimation {
  constructor(config, onComplete = null) {
    this.config = config;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.onComplete = onComplete;
    this.hasCompleted = false;

    // Calculate frame duration in milliseconds
    this.frameDuration = 1000 / config.frameRate;
  }

  start() {
    this.isPlaying = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.currentFrame = 0;
    this.hasCompleted = false;
  }

  stop() {
    this.isPlaying = false;
    this.currentFrame = 0;
    this.hasCompleted = false;
  }

  reset() {
    this.currentFrame = 0;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.hasCompleted = false;
  }

  update(currentTime = performance.now()) {
    if (!this.isPlaying || this.hasCompleted) return;

    const elapsed = currentTime - this.lastFrameTime;

    if (elapsed >= this.frameDuration) {
      this.currentFrame++;
      this.lastFrameTime = currentTime;

      // Handle animation completion
      if (this.currentFrame >= this.config.totalFrames) {
        if (this.config.loop) {
          this.currentFrame = 0; // Loop back to start
        } else {
          this.currentFrame = this.config.totalFrames - 1; // Stay on last frame
          this.isPlaying = false;
          this.hasCompleted = true;

          if (this.onComplete) {
            this.onComplete();
          }
        }
      }
    }
  }

  getCurrentFrameOffset() {
    return -(this.currentFrame * this.config.frameWidth);
  }

  getBackgroundPosition() {
    return `${this.getCurrentFrameOffset()}px 0px`;
  }

  isAnimationComplete() {
    return this.hasCompleted;
  }
}

/**
 * Global Spritesheet Manager
 * Manages all active animations and provides optimized updates
 */
class SpritesheetManager {
  constructor() {
    this.activeAnimations = new Map();
    this.animationFrame = null;
    this.lastUpdateTime = 0;
    this.isRunning = false;
  }

  // Create a new animation instance
  createAnimation(spritesheetKey, onComplete = null) {
    const config = SPRITESHEET_CONFIG[spritesheetKey];
    if (!config) {
      console.error(`Spritesheet config not found: ${spritesheetKey}`);
      return null;
    }

    return new SpriteSheetAnimation(config, onComplete);
  }

  // Register an animation for automatic updates
  registerAnimation(id, animation) {
    this.activeAnimations.set(id, animation);
    if (!this.isRunning) {
      this.startUpdateLoop();
    }
  }

  // Unregister an animation
  unregisterAnimation(id) {
    this.activeAnimations.delete(id);
    if (this.activeAnimations.size === 0) {
      this.stopUpdateLoop();
    }
  }

  // Start the global update loop
  startUpdateLoop() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastUpdateTime = performance.now();

    const updateLoop = (currentTime) => {
      if (!this.isRunning) return;

      // Update all active animations
      this.activeAnimations.forEach((animation, id) => {
        animation.update(currentTime);

        // Auto-cleanup completed non-looping animations
        if (animation.isAnimationComplete() && !animation.config.loop) {
          setTimeout(() => {
            this.unregisterAnimation(id);
          }, 100); // Small delay to allow final render
        }
      });

      this.lastUpdateTime = currentTime;
      this.animationFrame = requestAnimationFrame(updateLoop);
    };

    this.animationFrame = requestAnimationFrame(updateLoop);
  }

  // Stop the global update loop
  stopUpdateLoop() {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Get animation by ID
  getAnimation(id) {
    return this.activeAnimations.get(id);
  }

  // Cleanup all animations
  cleanup() {
    this.activeAnimations.clear();
    this.stopUpdateLoop();
  }
}

// Create global instance
export const spritesheetManager = new SpritesheetManager();

/**
 * Utility function to preload spritesheet images
 * Returns a Promise that resolves when all spritesheets are loaded
 */
export const preloadSpritesheets = () => {
  const loadPromises = Object.values(SPRITESHEET_CONFIG).map((config) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log(`Preloaded spritesheet: ${config.src}`);
        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to preload spritesheet: ${config.src}`);
        reject(new Error(`Failed to load ${config.src}`));
      };
      img.src = config.src;
    });
  });

  return Promise.all(loadPromises);
};
