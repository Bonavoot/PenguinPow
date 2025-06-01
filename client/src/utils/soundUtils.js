import buttonHoverSound from "../sounds/button-hover-sound.mp3";
import buttonPressSound from "../sounds/button-press-sound.mp3";
import buttonPressSound2 from "../sounds/button-press-sound-2.mp3";
import menuMusic from "../sounds/menu-music.mp3";
import { getGlobalVolume } from "../components/Settings";

let backgroundMusic = null;

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
  } catch (error) {
    console.error("Error creating background music:", error);
  }
};

const stopBackgroundMusic = () => {
  if (backgroundMusic) {
    backgroundMusic.pause();
    // Don't reset currentTime, just pause
  }
};

// Set up an interval to check volume changes
setInterval(updateBackgroundMusicVolume, 100);

const playButtonHoverSound = () => {
  try {
    const sound = new Audio(buttonHoverSound);
    sound.volume = 0.1 * getGlobalVolume();
    sound.play().catch((error) => {
      // Ignore AbortError as it's expected when sounds overlap
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error creating audio:", error);
  }
};

const playButtonPressSound = () => {
  try {
    const sound = new Audio(buttonPressSound);
    sound.volume = 0.1 * getGlobalVolume();
    sound.play().catch((error) => {
      // Ignore AbortError as it's expected when sounds overlap
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error creating audio:", error);
  }
};

const playButtonPressSound2 = () => {
  try {
    const sound = new Audio(buttonPressSound2);
    sound.volume = 0.2 * getGlobalVolume();
    sound.play().catch((error) => {
      // Ignore AbortError as it's expected when sounds overlap
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
  } catch (error) {
    console.error("Error creating audio:", error);
  }
};

export { playButtonHoverSound, playButtonPressSound, playButtonPressSound2, playBackgroundMusic, stopBackgroundMusic }; 