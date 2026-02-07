import buttonHoverSound from "../sounds/button-hover-sound.mp3";
import buttonPressSound from "../sounds/button-press-sound.mp3";
import buttonPressSound2 from "../sounds/button-press-sound-2.mp3";
import menuMusic from "../sounds/menu-music.mp3";
import powerUpSelectionHoverSound from "../sounds/power-up-selection-button-hover.mp3";
import powerUpSelectionPressSound from "../sounds/power-up-selection-button-press.mp3";
import { getGlobalVolume } from "../components/Settings";

let backgroundMusic = null;

// MEMORY FIX: Audio pool for UI sounds - prevents creating new Audio() on every click
// which was causing memory accumulation during long sessions (best-of-100, etc.)
const uiAudioPool = new Map();

const getOrCreatePooledAudio = (src, poolSize = 2) => {
  if (!uiAudioPool.has(src)) {
    const pool = [];
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio(src);
      audio.preload = "auto";
      pool.push(audio);
    }
    uiAudioPool.set(src, { pool, currentIndex: 0 });
  }
  const { pool, currentIndex } = uiAudioPool.get(src);
  const audio = pool[currentIndex];
  uiAudioPool.set(src, { pool, currentIndex: (currentIndex + 1) % pool.length });
  return audio;
};

const updateBackgroundMusicVolume = () => {
  if (backgroundMusic) {
    backgroundMusic.volume = 0.01 * getGlobalVolume(); // Reduced to 1% of global volume
  }
};

const playBackgroundMusic = () => {
  try {
    if (!backgroundMusic) {
      backgroundMusic = new Audio(menuMusic);
      backgroundMusic.loop = true;
    }
    updateBackgroundMusicVolume();
    // Only play if it's not already playing
    if (backgroundMusic.paused) {
      backgroundMusic.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error playing background music:", error);
        }
      });
    }
    // Start volume sync interval while music is playing
    startVolumeSyncInterval();
  } catch (error) {
    console.error("Error creating background music:", error);
  }
};

const stopBackgroundMusic = () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    // Don't reset currentTime, just pause
  }
  // Stop the volume sync interval when music is paused
  stopVolumeSyncInterval();
};

// PERFORMANCE: Only run volume sync interval while music is actually playing.
// Previously this ran forever (10 calls/sec), even when no music was playing.
let volumeSyncInterval = null;

function startVolumeSyncInterval() {
  if (!volumeSyncInterval) {
    volumeSyncInterval = setInterval(updateBackgroundMusicVolume, 100);
  }
}

function stopVolumeSyncInterval() {
  if (volumeSyncInterval) {
    clearInterval(volumeSyncInterval);
    volumeSyncInterval = null;
  }
}

const playButtonHoverSound = () => {
  try {
    const sound = getOrCreatePooledAudio(buttonHoverSound);
    sound.volume = 0.1 * getGlobalVolume();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

const playButtonPressSound = () => {
  try {
    const sound = getOrCreatePooledAudio(buttonPressSound);
    sound.volume = 0.1 * getGlobalVolume();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

const playButtonPressSound2 = () => {
  try {
    const sound = getOrCreatePooledAudio(buttonPressSound2);
    sound.volume = 0.2 * getGlobalVolume();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

const playPowerUpSelectionHoverSound = () => {
  try {
    const sound = getOrCreatePooledAudio(powerUpSelectionHoverSound);
    sound.volume = 0.1 * getGlobalVolume();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

const playPowerUpSelectionPressSound = () => {
  try {
    const sound = getOrCreatePooledAudio(powerUpSelectionPressSound);
    sound.volume = 0.15 * getGlobalVolume();
    sound.currentTime = 0;
    sound.play().catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

export {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
};
