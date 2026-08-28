import buttonHoverSound from "../sounds/button-hover-sound.mp3";
import buttonPressSound from "../sounds/button-press-sound.mp3";
import buttonPressSound2 from "../sounds/button-press-sound-2.mp3";
import powerUpSelectionHoverSound from "../sounds/power-up-selection-button-hover.mp3";
import powerUpSelectionPressSound from "../sounds/power-up-selection-button-press.mp3";
import bellSound from "../sounds/bell-sound.mp3";
import clapSound from "../sounds/clap2-sound.mp3";
import roundVictorySound from "../sounds/round-victory-sound.mp3";
import roundDefeatSound from "../sounds/round-defeat-sound.mp3";
import winnerSound from "../sounds/winner-sound.ogg";
import { preloadSounds, playBuffer, stopPlayingSrcs } from "./audioEngine";
import { setMusic, stopScreenMusic, cueForPage, unlockScreenMusic, resultsCue, warmCues } from "./musicDirector";

preloadSounds([
  buttonHoverSound,
  buttonPressSound,
  buttonPressSound2,
  powerUpSelectionHoverSound,
  powerUpSelectionPressSound,
  bellSound,
  clapSound,
]);

const playBackgroundMusic = () => {
  setMusic("menu");
};

const stopBackgroundMusic = () => {
  stopScreenMusic();
};

const playButtonHoverSound = () => {
  playBuffer(buttonHoverSound, 0.06);
};

const playButtonPressSound = () => {
  playBuffer(buttonPressSound, 0.06);
};

const playButtonPressSound2 = () => {
  playBuffer(buttonPressSound2, 0.12);
};

const playPowerUpSelectionHoverSound = () => {
  playBuffer(powerUpSelectionHoverSound, 0.06);
};

const playPowerUpSelectionPressSound = () => {
  playBuffer(powerUpSelectionPressSound, 0.09);
};

// ── BASHO results-screen ceremony stingers (spec §5.8 / Phase 9) ──
// Reused combat/menu cues, dialed to tasteful menu volumes. BASHO-only:
// nothing here is wired into PvP / VS CPU flows.
const playBashoGong = () => {
  playBuffer(bellSound, 0.03);
};

const playBashoPurseTick = () => {
  playBuffer(powerUpSelectionPressSound, 0.05);
};

const playBashoApplause = () => {
  playBuffer(clapSound, 0.08);
};

const playBashoSomber = () => {
  playBuffer(roundDefeatSound, 0.03);
};

/** Kill leftover KO win/loss stingers so they can't sit under results BGM. */
const silenceResultStingers = () => {
  stopPlayingSrcs([roundVictorySound, roundDefeatSound, winnerSound]);
};

export {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
  setMusic,
  stopScreenMusic,
  cueForPage,
  unlockScreenMusic,
  resultsCue,
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
  playBashoGong,
  playBashoPurseTick,
  playBashoApplause,
  playBashoSomber,
  silenceResultStingers,
  warmCues,
};
