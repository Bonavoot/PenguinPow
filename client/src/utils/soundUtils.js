import buttonHoverSound from "../sounds/button-hover-sound.mp3";
import buttonPressSound from "../sounds/button-press-sound.mp3";
import buttonPressSound2 from "../sounds/button-press-sound-2.mp3";
import menuMusic from "../sounds/menu-music.mp3";
import powerUpSelectionHoverSound from "../sounds/power-up-selection-button-hover.mp3";
import powerUpSelectionPressSound from "../sounds/power-up-selection-button-press.mp3";
import bellSound from "../sounds/bell-sound.mp3";
import clapSound from "../sounds/clap2-sound.mp3";
import roundVictorySound from "../sounds/round-victory-sound.mp3";
import roundDefeatSound from "../sounds/round-defeat-sound.mp3";
import winnerSound from "../sounds/winner-sound1.mp3";
import { getGlobalVolume } from "../components/Settings";
import { preloadSounds, playBuffer } from "./audioEngine";

let backgroundMusic = null;

preloadSounds([
  buttonHoverSound,
  buttonPressSound,
  buttonPressSound2,
  powerUpSelectionHoverSound,
  powerUpSelectionPressSound,
  bellSound,
  clapSound,
  roundVictorySound,
  roundDefeatSound,
  winnerSound,
]);

const updateBackgroundMusicVolume = () => {
  if (backgroundMusic) {
    backgroundMusic.volume = 0.009 * getGlobalVolume();
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
  playBuffer(buttonHoverSound, 0.06 * getGlobalVolume());
};

const playButtonPressSound = () => {
  playBuffer(buttonPressSound, 0.06 * getGlobalVolume());
};

const playButtonPressSound2 = () => {
  playBuffer(buttonPressSound2, 0.12 * getGlobalVolume());
};

const playPowerUpSelectionHoverSound = () => {
  playBuffer(powerUpSelectionHoverSound, 0.06 * getGlobalVolume());
};

const playPowerUpSelectionPressSound = () => {
  playBuffer(powerUpSelectionPressSound, 0.09 * getGlobalVolume());
};

// ── BASHO results-screen ceremony stingers (spec §5.8 / Phase 9) ──
// Reused combat/menu cues, dialed to tasteful menu volumes. BASHO-only:
// nothing here is wired into PvP / VS CPU flows.
const playBashoGong = () => {
  playBuffer(bellSound, 0.32 * getGlobalVolume());
};

const playBashoPurseTick = () => {
  playBuffer(powerUpSelectionPressSound, 0.05 * getGlobalVolume());
};

const playBashoFanfare = () => {
  playBuffer(roundVictorySound, 0.22 * getGlobalVolume());
};

const playBashoSomber = () => {
  playBuffer(roundDefeatSound, 0.2 * getGlobalVolume());
};

const playBashoApplause = () => {
  playBuffer(clapSound, 0.3 * getGlobalVolume());
};

const playBashoYusho = () => {
  playBuffer(winnerSound, 0.3 * getGlobalVolume());
};

export {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
  playBashoGong,
  playBashoPurseTick,
  playBashoFanfare,
  playBashoSomber,
  playBashoApplause,
  playBashoYusho,
};
