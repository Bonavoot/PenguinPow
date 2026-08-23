import {
  preloadSounds,
  preloadMusicTracks,
  playBuffer,
} from "../utils/audioEngine";
import { ANIMATED_SPRITES } from "../config/spriteConfig";
import { ALL_HEAD_OVERLAYS } from "../config/cosmetics";
import { ALL_BALD_BODY_SRCS } from "../config/baldSprites";

// ============================================
// STATIC SPRITE IMPORTS (Single frame images)
// ============================================
import pumo from "../assets/pumo-idle.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import grabbing from "../assets/grabbing.png";
import clinchPlanting from "../assets/clinch-planting.png";
// Arm-only overlay stacked on top of the (armless) grabbing/clinch-planting
// bodies so two locked penguins' arms visibly overlap. Same 960×960 canvas,
// pre-aligned to the body — see GameFighter's grab-arm overlay.
import beltGrabArm from "../assets/belt-grab-arm-only.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import attemptingPull from "../assets/is-attempting-pull.png";
import pumoSideProfile from "../assets/pumo-ready-position.png";
import pumoTachiaiPosition from "../assets/pumo-tachiai-position.png";
import attack from "../assets/attack.png";
import slapAttack1 from "../assets/slapAttack1.png";
import slapAttack2 from "../assets/slapAttack2.png";
import slapAttack3 from "../assets/attack.png";
import slapAttack1Blur from "../assets/slap-attack-1-blur-frame.png";
import slapAttack1Hit from "../assets/slap-attack-1-hit-frame.png";
import slapAttack2Blur from "../assets/slap-attack-2-blur-frame.png";
import slapAttack2Hit from "../assets/slap-attack-2-hit-frame.png";
import bellyBump from "../assets/belly-bump.png";
import palmThrust from "../assets/palm-thrust.png";
import palmThrustStartup from "../assets/palm-thrust-startup.png";
import palmThrustSmear from "../assets/palm-thrust-smear.png";
import lowKick from "../assets/kick.png";
import dodging from "../assets/dodging.png";
import sliding from "../assets/sliding.png";
import throwing from "../assets/throwing.png";
import salt from "../assets/salt.png";
import saltBasket from "../assets/salt-basket.png";
import saltBasketEmpty from "../assets/salt-basket-empty.png";
import recovering from "../assets/recovering.png";
import charging from "../assets/charging.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import rawParrySuccessFrame1 from "../assets/raw-parry-success-frame-1.png";
import rawParrySuccessFrame2 from "../assets/raw-parry-success-frame-2.png";
import rawParrySuccessFrame3 from "../assets/raw-parry-success-frame-3.png";
// Active parry WINDOW stance (space just pressed — can still deflect).
import blocking from "../assets/blocking.png";
// True GUARD / block floor (parry window expired while still holding).
import blockParry from "../assets/block-parry.png";
import snowball from "../assets/snowball.png";
import crouchStance from "../assets/crouch-stance.png";
import flap1 from "../assets/pumo-flap-1.png";
import flap2 from "../assets/pumo-flap-2.png";

// ============================================
// ANIMATED SPRITE IMPORTS (APNGs/GIFs)
// ============================================
import pumoWaddle from "../assets/pumo-waddle.png"; // APNG
import pumoArmy from "../assets/pumo-army.png"; // APNG
import crouching from "../assets/blocking.png"; // grab-break crouch
import bow from "../assets/bow.png"; // APNG
import grabAttempt from "../assets/grab-attempt.png"; // APNG
import hit from "../assets/hit.png"; // APNG
import bellyLaying from "../assets/pumo-belly-laying.png"; // static — clinch kill PULL victim (eyes closed, settled)
import bellyLayingEyesOpen from "../assets/pumo-belly-laying-eyes-open.png"; // static — clinch kill PULL victim (eyes open, during the slide)
import cinematicThrowKillLanding from "../assets/cinematic-throw-kill-landing.png"; // static — clinch kill THROW victim (flat on back after crash)
import pushDefeatPose from "../assets/push-defeat-pose.png"; // static — FORCE OUT (grabPush) loser after shove
import snowballThrow from "../assets/snowball-throw.png"; // APNG
import beingGrabbed from "../assets/is-being-grabbed.gif";
import atTheRopes from "../assets/at-the-ropes.png"; // APNG
import crouchStrafingApng from "../assets/crouch-strafing.png"; // APNG
import isPerfectParried from "../assets/is_perfect_parried.png"; // APNG

// ============================================
// SOUND IMPORTS
// ============================================
import attackSound from "../sounds/attack-sound.ogg";
import palmThrustWhiffSound from "../sounds/palm-thrust-whiff.ogg";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import grabSound from "../sounds/grab-sound.mp3";
import winnerSound from "../sounds/winner-sound.ogg";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import teWoTsuiteSound from "../sounds/tewotsuite.ogg";
import bellSound from "../sounds/bell-sound.mp3";
import battleMusic from "../sounds/battle-music-sound.ogg";
import battleMusic2 from "../sounds/battle-music-sound-2.ogg";
import battleMusic3 from "../sounds/battle-music-sound-3.ogg";
import eeshiMusic from "../sounds/eeshi.ogg";
import slapParrySound from "../sounds/slap-parry-sound.mp3";
import saltSound from "../sounds/salt-sound.mp3";
import snowballThrowSound from "../sounds/snowball-throw-sound.mp3";
import pumoArmySound from "../sounds/pumo-army-sound.mp3";
import thickBlubberSound from "../sounds/thick-blubber-sound.mp3";
import rawParryGruntSound from "../sounds/raw-parry-grunt.mp3";
import flapSound from "../sounds/flap-sound.wav";
import rawParrySuccessSound from "../sounds/raw-parry-success-sound.ogg";
import regularRawParrySound from "../sounds/regular-raw-parry-sound.ogg";
import stunnedSound from "../sounds/stunned-sound.mp3";
import gassedSound from "../sounds/gassed-sound.ogg";
import gassedRegenSound from "../sounds/gassed-regen-sound.ogg";
import grabBreakSound from "../sounds/grab-break-sound.ogg";
import glassBreakSound from "../sounds/glass-break-sound.ogg";
import counterGrabSound from "../sounds/counter-grab-sound.ogg";
import notEnoughStaminaSound from "../sounds/not-enough-stamina-sound.ogg";
import isTechingSound from "../sounds/is-teching-sound.ogg";
import roundVictorySound from "../sounds/round-victory-sound.mp3";
import roundDefeatSound from "../sounds/round-defeat-sound.mp3";
import strafingSound from "../sounds/strafing-sound.ogg";
import heartbeatSound from "../sounds/heartbeat.mp3";
import clap1Sound from "../sounds/clap1-sound.ogg";
import clap2Sound from "../sounds/clap2-sound.mp3";
import clap3Sound from "../sounds/clap3-sound.ogg";
import clap4Sound from "../sounds/clap4-sound.ogg";
import slapHit01 from "../sounds/slap-hit-01.ogg";
import slapHit02 from "../sounds/slap-hit-02.ogg";
import slapHit03 from "../sounds/slap-hit-03.ogg";

import slapWhiff01 from "../sounds/slap-whiff-01.ogg";
import slapWhiff02 from "../sounds/slap-whiff-02.ogg";
import slapWhiff03 from "../sounds/slap-whiff-03.ogg";
import chargedHit01 from "../sounds/charged-hit-01.ogg";
import chargedHit02 from "../sounds/charged-hit-02.ogg";
import chargedHit03 from "../sounds/charged-hit-03.ogg";
import chargedHit04 from "../sounds/charged-hit-04.ogg";
import grabHit01 from "../sounds/grab-hit-01.ogg";
import grabHit02 from "../sounds/grab-hit-02.ogg";
import grabHit03 from "../sounds/grab-hit-03.ogg";
import rawParry01 from "../sounds/raw-parry-01.ogg";
import rawParry02 from "../sounds/raw-parry-02.ogg";
import rawParry03 from "../sounds/raw-parry-03.ogg";
import chargeAttackLaunchSound from "../sounds/charge-attack-launch-sound.ogg";
import gunLaunchSound from "../sounds/gun-launch.ogg";

const battleMusicTracks = [battleMusic, battleMusic2, battleMusic3];

// ============================================
// PRELOAD-ONLY IMPORTS (not exported — consumed internally by preloading)
// ============================================
import gameMapBackground from "../assets/game-map-444.webp";
import antarcticaSky from "../assets/map-antarctica-sky.webp";
import antarcticaFloor from "../assets/game-map-floor.png";
import antarcticaWaterMask from "../assets/game-map-water-mask.png";
// In-match dohyo is the flat display bake; style webp is editor-only (--live).
import dohyoOverlay from "../assets/dohyo-display.webp";
import gyojiImage from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";
import dodgeEffectGif from "../assets/dodge-effect.gif";
import slapAttackHand from "../assets/slap-attack-hand.png";
import slapHitSheet from "../assets/slapattack-hit-effect.png";
import chargedHitSheet from "../assets/charged-attack-hit-effect.png";
import grabBreakSheet from "../assets/grab-break-effect.png";
import chargedAttackSmokeGif from "../assets/charged-attack-smoke.gif";
import snowEnvelope from "../assets/envelope.png";
import landingSmokeSheet from "../assets/landing-smoke-effect.png";
import straightUpSmokeSheet from "../assets/straight-up-smoke-effect.png";
import tiltedUpSmokeSheet from "../assets/tilted-up-smoke-effect.png";
import smokePuffSheet from "../assets/smoke-puff-effect.png";
import dashSmokeSheet from "../assets/dash-smoke-effect.png";
import chargedSmokeSheet from "../assets/charged-attack-smoke-effect.png";
import cinematicThrowLandSmokeSheet from "../assets/cinematicKill-throw-landing-smoke-effect.png";
// Attack / snowball parry bursts now share the grab-break star sheet.
import parryEffectSheet from "../assets/grab-break-effect.png";
import blockingEffectSheet from "../assets/blocking-effect.png";
import clampedEffectSheet from "../assets/clamped-effect.png";

// ============================================
// CONSTANTS
// ============================================
export const GROUND_LEVEL = 140;
export const SPRITE_HALF_W = 0;
export const PLAYER_MID_Y = 376;
/** Game-Y anchor for slap/charged/burst hit rings (HitEffect) + canvas impact sparks. */
export const HIT_EFFECT_Y = PLAYER_MID_Y - 10;
/**
 * Clinch Jolt grip / forearm / upper-waist seam (matches server
 * CLINCH_GRIP_CONTACT_Y). Temporary CSS Jolt fallback registration.
 */
export const CLINCH_GRIP_CONTACT_Y = 338;
/** Belly-slam / flap drop spark — higher on the body than a slap chest hit. */
export const FLAP_HIT_EFFECT_Y = PLAYER_MID_Y + 36;
/** Low kick / trip spark — same slap sheet, just above the feet (ground = 286). */
export const LOW_KICK_HIT_EFFECT_Y = 322;

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
export { chargeAttackLaunchSound, gunLaunchSound, chargedHit04 };
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
    // Fetching alone doesn't guarantee the bitmap is DECODED. Effects that use a
    // sheet as a CSS mask-image render fully-masked (invisible) until the decode
    // lands, so a short effect can finish before it ever shows. Forcing a decode
    // at startup makes first use instant. (decode() may reject if unsupported or
    // the src changes — harmless, so swallow it.)
    if (typeof img.decode === "function") {
      img.decode().catch(() => {});
    }
  }
};

const initializeImagePreloading = () => {
  preloadImage(pumo);
  preloadImage(pumoWaddle);
  preloadImage(pumoArmy);

  preloadImage(attack);
  preloadImage(throwing);
  preloadImage(grabbing);
  preloadImage(clinchPlanting);
  preloadImage(beltGrabArm);
  preloadImage(grabAttempt);
  preloadImage(attemptingGrabThrow);
  preloadImage(attemptingPull);
  preloadImage(beingGrabbed);

  preloadImage(pumoSideProfile);
  preloadImage(pumoTachiaiPosition);
  preloadImage(hit);
  preloadImage(bellyLaying);
  preloadImage(bellyLayingEyesOpen);
  preloadImage(cinematicThrowKillLanding);
  preloadImage(pushDefeatPose);
  preloadImage(dodging);
  preloadImage(sliding);
  preloadImage(crouching);
  preloadImage(crouchStance);
  preloadImage(crouchStrafingApng);

  preloadImage(slapAttack1);
  preloadImage(slapAttack2);
  preloadImage(slapAttack3);
  preloadImage(slapAttack1Blur);
  preloadImage(slapAttack1Hit);
  preloadImage(slapAttack2Blur);
  preloadImage(slapAttack2Hit);
  preloadImage(bellyBump);
  preloadImage(palmThrust);
  preloadImage(palmThrustStartup);
  preloadImage(palmThrustSmear);
  preloadImage(lowKick);
  preloadImage(snowballThrow);

  preloadImage(bow);
  preloadImage(salt);
  preloadImage(saltBasket);
  preloadImage(saltBasketEmpty);
  preloadImage(recovering);
  preloadImage(charging);
  preloadImage(rawParrySuccess);
  preloadImage(rawParrySuccessFrame1);
  preloadImage(rawParrySuccessFrame2);
  preloadImage(rawParrySuccessFrame3);
  preloadImage(blocking);
  preloadImage(blockParry);
  preloadImage(atTheRopes);
  preloadImage(snowball);
  preloadImage(flap1);
  preloadImage(flap2);

  // Decode head-gear overlays early — combat pose swaps composite these onto the body.
  ALL_HEAD_OVERLAYS.forEach((overlay) => preloadImage(overlay));
  // Bald underlays for toppers — same poses as hat overlays when present.
  ALL_BALD_BODY_SRCS.forEach((src) => preloadImage(src));

  preloadImage(gameMapBackground);
  preloadImage(antarcticaSky);
  preloadImage(antarcticaFloor);
  preloadImage(antarcticaWaterMask);
  preloadImage(dohyoOverlay);

  preloadImage(powerWaterIcon);
  preloadImage(pumoArmyIcon);
  preloadImage(happyFeetIcon);
  preloadImage(thickBlubberIcon);

  preloadImage(gyojiImage);
  preloadImage(gyojiReady);
  preloadImage(gyojiPlayer1wins);
  preloadImage(gyojiPlayer2wins);

  preloadImage(dodgeEffectGif);
  preloadImage(slapAttackHand);
  preloadImage(slapHitSheet);
  preloadImage(chargedHitSheet);
  preloadImage(grabBreakSheet);
  preloadImage(chargedAttackSmokeGif);
  preloadImage(snowEnvelope);
  preloadImage(landingSmokeSheet);
  preloadImage(straightUpSmokeSheet);
  preloadImage(tiltedUpSmokeSheet);
  preloadImage(smokePuffSheet);
  preloadImage(dashSmokeSheet);
  preloadImage(chargedSmokeSheet);
  preloadImage(cinematicThrowLandSmokeSheet);
  preloadImage(parryEffectSheet);
  preloadImage(blockingEffectSheet);
  preloadImage(clampedEffectSheet);
};

initializeImagePreloading();

// ============================================
// SOUND PRELOADING
// ============================================
preloadSounds([
  attackSound,
  palmThrustWhiffSound,
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
  flapSound,
  rawParrySuccessSound,
  regularRawParrySound,
  stunnedSound,
  grabBreakSound,
  glassBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
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
  gunLaunchSound,
  eeshiMusic,
]);

// Battle music: stream (HTMLAudioElement), do not decodeAudioData into RAM.
preloadMusicTracks(battleMusicTracks);

// ============================================
// SOUND PLAYBACK HELPER
// ============================================
const PITCH_VARIATION = 0.06;

// Authored volumes only — master SFX gain (Settings) carries the user scale
// so changing the slider affects currently playing buffer voices.
// Returns playBuffer handle so combat-audio voice-steal can stop sources.
export const playSound = (audioFile, volume = 1.0, duration = null, playbackRate = 1.0, pan = 0) => {
  return playBuffer(audioFile, volume, duration, playbackRate, false, pan);
};

export const playSoundVaried = (audioFile, volume = 1.0, duration = null, playbackRate = 1.0, pan = 0) => {
  const pitchShift = 1 + (Math.random() * 2 - 1) * PITCH_VARIATION;
  return playBuffer(audioFile, volume, duration, playbackRate * pitchShift, false, pan);
};

// Shared "rope slam" body — placeholder until a dedicated tawara hit exists.
// Intentionally a charged-hit sample (mild rate), NOT a pitch-mangled slap:
// it should feel like the RING absorbing the pin, layered under slap/palm
// attack SFX or alone on a grab-drive clamp.
//   mode: "hit"   — slap/palm clamp (attack SFX already playing)
//         "drive" — grab push first contact; quieter solo bed (no attack layer)
//   rehit: lighter on rapid slap/palm clamp rehitas
export const playRopeClampBody = (pan = 0, { mode = "hit", rehit = false } = {}) => {
  const body = pickRandomSound(chargedHitSounds);
  if (mode === "drive") {
    // Solo bed under the shove — soft, near-natural rate so the transient
    // lands with the pin (slow rates stretched the attack and felt late).
    playSound(body, 0.018, null, 0.94, pan);
    return;
  }
  if (rehit) {
    playSound(body, 0.028, null, 0.82, pan);
    return;
  }
  playSound(body, 0.04, null, 0.82, pan);
  playSound(body, 0.02, null, 0.7, pan);
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
  clinchPlanting,
  beltGrabArm,
  attemptingGrabThrow,
  attemptingPull,
  pumoSideProfile,
  pumoTachiaiPosition,
  attack,
  slapAttack1,
  slapAttack2,
  slapAttack3,
  slapAttack1Blur,
  slapAttack1Hit,
  slapAttack2Blur,
  slapAttack2Hit,
  bellyBump,
  palmThrust,
  palmThrustStartup,
  palmThrustSmear,
  lowKick,
  dodging,
  sliding,
  throwing,
  salt,
  saltBasket,
  saltBasketEmpty,
  recovering,
  charging,
  rawParrySuccess,
  rawParrySuccessFrame1,
  rawParrySuccessFrame2,
  rawParrySuccessFrame3,
  blocking,
  blockParry,
  snowball,
  crouchStance,
  flap1,
  flap2,
  pumoWaddle,
  pumoArmy,
  crouching,
  bow,
  grabAttempt,
  hit,
  bellyLaying,
  bellyLayingEyesOpen,
  cinematicThrowKillLanding,
  pushDefeatPose,
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
  palmThrustWhiffSound,
  hitSound,
  dodgeSound,
  throwSound,
  grabSound,
  winnerSound,
  hakkiyoiSound,
  teWoTsuiteSound,
  bellSound,
  battleMusicTracks,
  eeshiMusic,
  slapParrySound,
  saltSound,
  snowballThrowSound,
  pumoArmySound,
  thickBlubberSound,
  rawParryGruntSound,
  flapSound,
  rawParrySuccessSound,
  regularRawParrySound,
  stunnedSound,
  gassedSound,
  gassedRegenSound,
  grabBreakSound,
  glassBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
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
