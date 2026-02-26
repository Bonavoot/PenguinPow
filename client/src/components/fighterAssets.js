import { getGlobalVolume } from "./Settings";
import { preloadSounds, playBuffer } from "../utils/audioEngine";
import { ANIMATED_SPRITES } from "../config/spriteConfig";

// ============================================
// STATIC SPRITE IMPORTS (Single frame images)
// ============================================
import pumo from "../assets/pumo.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import grabbing from "../assets/grabbing.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import attemptingPull from "../assets/is-attempting-pull.png";
import ready from "../assets/ready.png";
import attack from "../assets/attack.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";
import dodging from "../assets/dodging.png";
import throwing from "../assets/throwing.png";
import salt from "../assets/salt.png";
import saltBasket from "../assets/salt-basket.png";
import saltBasketEmpty from "../assets/salt-basket-empty.png";
import recovering from "../assets/recovering.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import snowball from "../assets/snowball.png";
import crouchStance from "../assets/crouch-stance.png";

// ============================================
// ANIMATED SPRITE IMPORTS (APNGs/GIFs)
// ============================================
import pumoWaddle from "../assets/pumo-waddle.png"; // APNG
import pumoArmy from "../assets/pumo-army.png"; // APNG
import crouching from "../assets/blocking.png"; // APNG
import bow from "../assets/bow.png"; // APNG
import grabAttempt from "../assets/grab-attempt.png"; // APNG
import hit from "../assets/hit.png"; // APNG
import snowballThrow from "../assets/snowball-throw.png"; // APNG
import beingGrabbed from "../assets/is-being-grabbed.gif";
import atTheRopes from "../assets/at-the-ropes.png"; // APNG
import crouchStrafingApng from "../assets/crouch-strafing.png"; // APNG
import isPerfectParried from "../assets/is_perfect_parried.png"; // APNG

// ============================================
// SOUND IMPORTS
// ============================================
import attackSound from "../sounds/attack-sound.wav";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import grabSound from "../sounds/grab-sound.mp3";
import winnerSound from "../sounds/winner-sound.wav";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import teWoTsuiteSound from "../sounds/tewotsuite.wav";
import bellSound from "../sounds/bell-sound.mp3";
import gameMusic from "../sounds/game-music.mp3";
import eeshiMusic from "../sounds/eeshi.wav";
import slapParrySound from "../sounds/slap-parry-sound.mp3";
import saltSound from "../sounds/salt-sound.mp3";
import snowballThrowSound from "../sounds/snowball-throw-sound.mp3";
import pumoArmySound from "../sounds/pumo-army-sound.mp3";
import thickBlubberSound from "../sounds/thick-blubber-sound.mp3";
import rawParryGruntSound from "../sounds/raw-parry-grunt.mp3";
import rawParrySuccessSound from "../sounds/raw-parry-success-sound.wav";
import regularRawParrySound from "../sounds/regular-raw-parry-sound.wav";
import stunnedSound from "../sounds/stunned-sound.mp3";
import gassedSound from "../sounds/gassed-sound.wav";
import gassedRegenSound from "../sounds/gassed-regen-sound.flac";
import grabBreakSound from "../sounds/grab-break-sound.wav";
import counterGrabSound from "../sounds/counter-grab-sound.wav";
import notEnoughStaminaSound from "../sounds/not-enough-stamina-sound.wav";
import grabClashSound from "../sounds/grab-clash-sound.wav";
import isTechingSound from "../sounds/is-teching-sound.wav";
import roundVictorySound from "../sounds/round-victory-sound.mp3";
import roundDefeatSound from "../sounds/round-defeat-sound.mp3";
import strafingSound from "../sounds/strafing-sound.wav";
import heartbeatSound from "../sounds/heartbeat.mp3";
import clap1Sound from "../sounds/clap1-sound.wav";
import clap2Sound from "../sounds/clap2-sound.mp3";
import clap3Sound from "../sounds/clap3-sound.wav";
import clap4Sound from "../sounds/clap4-sound.wav";
import slapHit01 from "../sounds/slap-hit-01.wav";
import slapHit02 from "../sounds/slap-hit-02.wav";
import slapHit03 from "../sounds/slap-hit-03.wav";

import slapWhiff01 from "../sounds/slap-whiff-01.wav";
import slapWhiff02 from "../sounds/slap-whiff-02.wav";
import slapWhiff03 from "../sounds/slap-whiff-03.wav";
import chargedHit01 from "../sounds/charged-hit-01.wav";
import chargedHit02 from "../sounds/charged-hit-02.wav";
import chargedHit03 from "../sounds/charged-hit-03.wav";
import chargedHit04 from "../sounds/charged-hit-04.wav";
import grabHit01 from "../sounds/grab-hit-01.wav";
import grabHit02 from "../sounds/grab-hit-02.wav";
import grabHit03 from "../sounds/grab-hit-03.wav";
import rawParry01 from "../sounds/raw-parry-01.wav";
import rawParry02 from "../sounds/raw-parry-02.wav";
import rawParry03 from "../sounds/raw-parry-03.wav";
import chargeAttackLaunchSound from "../sounds/charge-attack-launch-sound.wav";


// ============================================
// PRELOAD-ONLY IMPORTS (not exported — consumed internally by preloading)
// ============================================
import gameMapBackground from "../assets/game-map-1.png";
import dohyoOverlay from "../assets/dohyo.png";
import gyojiImage from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";
import gyojiHakkiyoi from "../assets/gyoji-hakkiyoi.gif";
import dodgeEffectGif from "../assets/dodge-effect.gif";
import slapAttackHand from "../assets/slap-attack-hand.png";

// ============================================
// CONSTANTS
// ============================================
export const GROUND_LEVEL = 140;
export const SPRITE_HALF_W = 0;
export const PLAYER_MID_Y = 366;

// ============================================
// RITUAL ANIMATION CONFIGURATION
// ============================================
const ritualPart1Spritesheet = ANIMATED_SPRITES.player1.ritualPart1.src;
const ritualPart2Spritesheet = ANIMATED_SPRITES.player1.ritualPart2.src;
const ritualPart3Spritesheet = ANIMATED_SPRITES.player1.ritualPart3.src;
const ritualPart4Spritesheet = ANIMATED_SPRITES.player1.ritualPart4.src;

export const RITUAL_SPRITE_CONFIG = [
  {
    spritesheet: ritualPart1Spritesheet,
    frameCount: 28,
    frameWidth: 480,
    fps: 14,
  },
  {
    spritesheet: ritualPart2Spritesheet,
    frameCount: 24,
    frameWidth: 480,
    fps: 14,
  },
  {
    spritesheet: ritualPart3Spritesheet,
    frameCount: 39,
    frameWidth: 480,
    fps: 14,
  },
  {
    spritesheet: ritualPart4Spritesheet,
    frameCount: 38,
    frameWidth: 480,
    fps: 14,
  },
];

export const RITUAL_ANIMATION_DURATIONS = RITUAL_SPRITE_CONFIG.map((config) =>
  Math.round((config.frameCount / config.fps) * 1000)
);

export const CLAP_SOUND_OFFSET = 100;

export const ritualSpritesheetsPlayer1 = RITUAL_SPRITE_CONFIG;
export const ritualSpritesheetsPlayer2 = RITUAL_SPRITE_CONFIG;

export const ritualClapSounds = [clap1Sound, clap2Sound, clap3Sound, clap4Sound];

export const slapHitSounds = [slapHit01, slapHit02, slapHit03];
export const slapWhiffSounds = [slapWhiff01, slapWhiff02, slapWhiff03];
export const chargedHitSounds = [chargedHit01, chargedHit02, chargedHit03, chargedHit04];
export const grabHitSounds = [grabHit01, grabHit02, grabHit03];
export const rawParrySounds = [rawParry01, rawParry02, rawParry03];
export { chargeAttackLaunchSound };
export const pickRandomSound = (sounds) => sounds[Math.floor(Math.random() * sounds.length)];

// ============================================
// IMAGE PRELOADING
// ============================================
const imagePool = new Map();

const preloadImage = (src) => {
  if (!imagePool.has(src)) {
    const img = new Image();
    img.src = src;
    imagePool.set(src, img);
  }
};

const initializeImagePreloading = () => {
  preloadImage(pumo);
  preloadImage(pumoWaddle);
  preloadImage(pumoArmy);

  preloadImage(attack);
  preloadImage(throwing);
  preloadImage(grabbing);
  preloadImage(grabAttempt);
  preloadImage(attemptingGrabThrow);
  preloadImage(attemptingPull);
  preloadImage(beingGrabbed);

  preloadImage(ready);
  preloadImage(hit);
  preloadImage(dodging);
  preloadImage(crouching);
  preloadImage(crouchStance);
  preloadImage(crouchStrafingApng);

  preloadImage(slapAttack1);
  preloadImage(slapAttack2);
  preloadImage(snowballThrow);

  preloadImage(bow);
  preloadImage(salt);
  preloadImage(saltBasket);
  preloadImage(saltBasketEmpty);
  preloadImage(recovering);
  preloadImage(rawParrySuccess);
  preloadImage(atTheRopes);
  preloadImage(snowball);

  preloadImage(gameMapBackground);
  preloadImage(dohyoOverlay);

  preloadImage(powerWaterIcon);
  preloadImage(pumoArmyIcon);
  preloadImage(happyFeetIcon);
  preloadImage(thickBlubberIcon);

  preloadImage(gyojiImage);
  preloadImage(gyojiReady);
  preloadImage(gyojiPlayer1wins);
  preloadImage(gyojiPlayer2wins);
  preloadImage(gyojiHakkiyoi);

  preloadImage(dodgeEffectGif);
  preloadImage(slapAttackHand);
};

initializeImagePreloading();

// ============================================
// SOUND PRELOADING
// ============================================
preloadSounds([
  attackSound,
  hitSound,
  dodgeSound,
  throwSound,
  grabSound,
  slapParrySound,
  saltSound,
  snowballThrowSound,
  pumoArmySound,
  hakkiyoiSound,
  teWoTsuiteSound,
  bellSound,
  winnerSound,
  thickBlubberSound,
  rawParryGruntSound,
  rawParrySuccessSound,
  regularRawParrySound,
  stunnedSound,
  grabBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
  grabClashSound,
  isTechingSound,
  gassedSound,
  gassedRegenSound,

  roundVictorySound,
  roundDefeatSound,
  clap1Sound,
  clap2Sound,
  clap3Sound,
  clap4Sound,
  strafingSound,
  heartbeatSound,
  slapHit01,
  slapHit02,
  slapHit03,
  slapWhiff01,
  slapWhiff02,
  slapWhiff03,
  chargedHit01,
  chargedHit02,
  chargedHit03,
  chargedHit04,
  grabHit01,
  grabHit02,
  grabHit03,
  rawParry01,
  rawParry02,
  rawParry03,
  chargeAttackLaunchSound,
  eeshiMusic,
]);

// ============================================
// SOUND PLAYBACK HELPER
// ============================================
const PITCH_VARIATION = 0.06;

export const playSound = (audioFile, volume = 1.0, duration = null, playbackRate = 1.0, pan = 0) => {
  playBuffer(audioFile, volume * getGlobalVolume(), duration, playbackRate, false, pan);
};

export const playSoundVaried = (audioFile, volume = 1.0, duration = null, playbackRate = 1.0, pan = 0) => {
  const pitchShift = 1 + (Math.random() * 2 - 1) * PITCH_VARIATION;
  playBuffer(audioFile, volume * getGlobalVolume(), duration, playbackRate * pitchShift, false, pan);
};

export const xToPan = (x, screenWidth = 1100) => {
  return Math.max(-1, Math.min(1, ((x / screenWidth) * 2 - 1) * 0.6));
};

// ============================================
// SPRITE EXPORTS (used by getImageSrc and component)
// ============================================
export {
  pumo,
  grabbing,
  attemptingGrabThrow,
  attemptingPull,
  ready,
  attack,
  slapAttack1,
  slapAttack2,
  dodging,
  throwing,
  salt,
  saltBasket,
  saltBasketEmpty,
  recovering,
  rawParrySuccess,
  snowball,
  crouchStance,
  pumoWaddle,
  pumoArmy,
  crouching,
  bow,
  grabAttempt,
  hit,
  snowballThrow,
  beingGrabbed,
  atTheRopes,
  crouchStrafingApng,
  isPerfectParried,
};

// ============================================
// SOUND EXPORTS (used by component useEffects/socket handlers)
// ============================================
export {
  attackSound,
  hitSound,
  dodgeSound,
  throwSound,
  grabSound,
  winnerSound,
  hakkiyoiSound,
  teWoTsuiteSound,
  bellSound,
  gameMusic,
  eeshiMusic,
  slapParrySound,
  saltSound,
  snowballThrowSound,
  pumoArmySound,
  thickBlubberSound,
  rawParryGruntSound,
  rawParrySuccessSound,
  regularRawParrySound,
  stunnedSound,
  gassedSound,
  gassedRegenSound,
  grabBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
  grabClashSound,
  isTechingSound,
  roundVictorySound,
  roundDefeatSound,
  strafingSound,
  heartbeatSound,
  clap1Sound,
  clap2Sound,
  clap3Sound,
  clap4Sound,
};
