import buttonHoverSound from "../sounds/button-hover-sound.mp3";
import buttonPressSound from "../sounds/button-press-sound.mp3";
import buttonPressSound2 from "../sounds/button-press-sound-2.mp3";
import menuMusic from "../sounds/menu-music.mp3";
import powerUpSelectionHoverSound from "../sounds/power-up-selection-button-hover.mp3";
import powerUpSelectionPressSound from "../sounds/power-up-selection-button-press.mp3";
import { getGlobalVolume } from "../components/Settings";
import { preloadSounds, playBuffer } from "./audioEngine";

let backgroundMusic = null;

preloadSounds([
  buttonHoverSound,
  buttonPressSound,
  buttonPressSound2,
  powerUpSelectionHoverSound,
  powerUpSelectionPressSound,
]);

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
  playBuffer(buttonHoverSound, 0.1 * getGlobalVolume());
};

const playButtonPressSound = () => {
  playBuffer(buttonPressSound, 0.1 * getGlobalVolume());
};

const playButtonPressSound2 = () => {
  playBuffer(buttonPressSound2, 0.2 * getGlobalVolume());
};

const playPowerUpSelectionHoverSound = () => {
  playBuffer(powerUpSelectionHoverSound, 0.1 * getGlobalVolume());
};

const playPowerUpSelectionPressSound = () => {
  playBuffer(powerUpSelectionPressSound, 0.15 * getGlobalVolume());
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
