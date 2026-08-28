/**
 * Screen BGM director — streamed HTMLAudio cues (never decodeAudioData).
 *
 * Match beds (eeshi / battle) stay in GameFighter. This only owns the
 * title / menu / lobby / customize / results tracks so page changes
 * crossfade instead of stacking.
 *
 * Tracks are OGG and loaded on demand. Do not preload every cue at once —
 * that was ~140MB of WAV competing with the title theme in Chrome.
 */
import titleMusic from "../sounds/title-screen-music.ogg";
import mainMenuMusic from "../sounds/main-menu-music.ogg";
import customizeMusic from "../sounds/customization-music.ogg";
import lobbyMusic from "../sounds/lobby-music.ogg";
import resultsLoseMusic from "../sounds/results-screen.ogg";
import resultsWinMusic from "../sounds/winner-results-screen.ogg";
import { getGlobalVolume } from "../components/Settings";
import { preloadMusic } from "./audioEngine";

const SCREEN_VOL = 0.009;
const CROSSFADE_SEC = 0.85;

const CUES = {
  title: titleMusic,
  menu: mainMenuMusic,
  customize: customizeMusic,
  lobby: lobbyMusic,
  resultsLose: resultsLoseMusic,
  resultsWin: resultsWinMusic,
};

const WARM_NEXT = {
  title: "menu",
  menu: "lobby",
};

let currentCue = null;
let currentEl = null;
let outgoingEl = null;
let cancelCurrentRamp = null;
let cancelOutgoingRamp = null;
let volumeSyncInterval = null;
let playGen = 0;
let gestureUnlock = null;

function authoredVolume() {
  return SCREEN_VOL * getGlobalVolume();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function rampVolume(el, from, to, seconds, onDone) {
  const start = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  el.volume = clamp01(from);
  let raf = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = Math.sin(t * Math.PI * 0.5);
    el.volume = clamp01(from + (to - from) * eased);
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else if (onDone) {
      onDone();
    }
  };
  raf = requestAnimationFrame(step);
  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}

function disposeEl(el) {
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    /* ignore */
  }
}

function fadeOutAndDispose(el, seconds) {
  if (!el) return () => {};
  const from = el.volume;
  return rampVolume(el, from, 0, seconds, () => disposeEl(el));
}

function startVolumeSync() {
  if (volumeSyncInterval) return;
  volumeSyncInterval = setInterval(() => {
    if (!currentEl || currentEl.paused) return;
    currentEl.volume = clamp01(authoredVolume());
  }, 100);
}

function stopVolumeSync() {
  if (!volumeSyncInterval) return;
  clearInterval(volumeSyncInterval);
  volumeSyncInterval = null;
}

function beginOutgoing(el) {
  if (cancelOutgoingRamp) {
    cancelOutgoingRamp();
    cancelOutgoingRamp = null;
  }
  if (outgoingEl && outgoingEl !== el) disposeEl(outgoingEl);
  outgoingEl = el;
  cancelOutgoingRamp = fadeOutAndDispose(el, CROSSFADE_SEC);
}

function warmCue(cue) {
  const src = CUES[cue];
  if (src) preloadMusic(src);
}

export function warmCues(cues) {
  if (!cues) return;
  for (const cue of cues) warmCue(cue);
}

function fadeInCurrent(el, gen) {
  cancelCurrentRamp = rampVolume(el, 0, authoredVolume(), CROSSFADE_SEC, () => {
    if (gen !== playGen || currentEl !== el) return;
    cancelCurrentRamp = null;
    startVolumeSync();
    const next = WARM_NEXT[currentCue];
    if (next) warmCue(next);
  });
}

function armGestureUnlock(tryFn) {
  if (gestureUnlock) return;
  const unlock = () => {
    gestureUnlock = null;
    tryFn();
  };
  gestureUnlock = unlock;
  for (const event of ["pointerdown", "keydown", "touchstart"]) {
    document.addEventListener(event, unlock, { capture: true, once: true });
  }
}

/**
 * Chrome blocks autoplay until a click/key. Call this from the title
 * screen on any input (including during "Connecting") so BGM can start
 * without leaving the screen.
 */
export function unlockScreenMusic() {
  if (typeof gestureUnlock === "function") {
    const fn = gestureUnlock;
    gestureUnlock = null;
    fn();
    return;
  }
  if (currentEl && currentCue && currentEl.paused) {
    currentEl.play().catch(() => {});
  }
}

/**
 * Map MainMenu `currentPage` to a screen cue. `game` returns null so
 * GameFighter can take over without a competing bed.
 */
export function cueForPage(page) {
  switch (page) {
    case "mainMenu":
    case "rooms":
      return "menu";
    case "lobby":
    case "basho":
      return "lobby";
    case "customize":
    case "hatTuner":
      return "customize";
    default:
      return null;
  }
}

export function resultsCue(won) {
  return won ? "resultsWin" : "resultsLose";
}

/**
 * Play a screen cue. Same cue already playing → no-op.
 * Pass null to fade out whatever is playing.
 */
export function setMusic(cue) {
  if (cue && !CUES[cue]) return;

  if (cue && cue === currentCue && currentEl && !currentEl.paused) {
    return;
  }

  playGen += 1;
  const gen = playGen;

  stopVolumeSync();

  if (cancelCurrentRamp) {
    cancelCurrentRamp();
    cancelCurrentRamp = null;
  }

  if (!cue) {
    currentCue = null;
    if (currentEl) {
      beginOutgoing(currentEl);
      currentEl = null;
    }
    return;
  }

  if (currentEl) {
    beginOutgoing(currentEl);
    currentEl = null;
  }

  currentCue = cue;
  const el = new Audio();
  el.preload = "auto";
  el.loop = true;
  el.volume = 0;
  el.src = CUES[cue];
  currentEl = el;

  let playInFlight = false;

  const tryPlay = () => {
    if (gen !== playGen || currentEl !== el) return;
    if (!el.paused && !el.ended) return;
    if (playInFlight) return;
    playInFlight = true;
    const playPromise = el.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      playInFlight = false;
      fadeInCurrent(el, gen);
      return;
    }
    playPromise
      .then(() => {
        playInFlight = false;
        if (gen !== playGen || currentEl !== el) return;
        fadeInCurrent(el, gen);
      })
      .catch((error) => {
        playInFlight = false;
        if (error?.name === "AbortError") return;
        if (error?.name === "NotAllowedError") {
          armGestureUnlock(tryPlay);
          return;
        }
        console.error("Error playing screen music:", error);
      });
  };

  tryPlay();
  el.addEventListener("canplay", tryPlay, { once: true });
  el.addEventListener("loadeddata", tryPlay, { once: true });
}

export function stopScreenMusic() {
  setMusic(null);
}

export function getMusicCue() {
  return currentCue;
}
