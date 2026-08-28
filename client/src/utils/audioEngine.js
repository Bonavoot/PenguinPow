let audioContext = null;
/** Master SFX gain stage (historically named masterEQ — GainNode, not an EQ). */
let masterEQ = null;
/** Pending async loop starts keyed for cancel-before-decode safety. */
let pendingLoopSeq = 0;
const audioBuffers = new Map();
const loadingPromises = new Map();

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function getMasterEQ() {
  if (!masterEQ) {
    const ctx = getContext();
    masterEQ = ctx.createGain();
    masterEQ.gain.value = 1;
    masterEQ.connect(ctx.destination);
  }
  return masterEQ;
}

/** Live master SFX gain — changes affect currently playing SFX through this node. */
function setMasterSfxGain(gain) {
  const g = typeof gain === "number" && Number.isFinite(gain) ? Math.max(0, gain) : 1;
  const node = getMasterEQ();
  try {
    node.gain.value = g;
  } catch {
    /* ignore */
  }
  return g;
}

function getMasterSfxGain() {
  if (!masterEQ) return 1;
  return masterEQ.gain.value;
}

function ensureContextResumed() {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

if (!window.__audioEngineListenersAttached) {
  ["click", "touchstart", "keydown"].forEach((event) => {
    document.addEventListener(event, ensureContextResumed, { passive: true });
  });
  window.__audioEngineListenersAttached = true;
}

function trimLeadingSilence(ctx, buffer) {
  const threshold = 0.02;
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  let firstLoudSample = 0;

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      if (Math.abs(buffer.getChannelData(ch)[i]) > threshold) {
        firstLoudSample = i;
        i = buffer.length;
        break;
      }
    }
  }

  if (firstLoudSample === 0) return buffer;

  const newLength = buffer.length - firstLoudSample;
  const trimmed = ctx.createBuffer(channels, newLength, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    trimmed.getChannelData(ch).set(
      buffer.getChannelData(ch).subarray(firstLoudSample)
    );
  }
  return trimmed;
}

async function preloadSound(src) {
  if (audioBuffers.has(src)) return audioBuffers.get(src);
  if (loadingPromises.has(src)) return loadingPromises.get(src);

  const ctx = getContext();
  const promise = fetch(src)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      const trimmed = trimLeadingSilence(ctx, decoded);
      audioBuffers.set(src, trimmed);
      loadingPromises.delete(src);
      return trimmed;
    })
    .catch((err) => {
      console.error("Failed to preload sound:", src, err);
      loadingPromises.delete(src);
      return null;
    });

  loadingPromises.set(src, promise);
  return promise;
}

function preloadSounds(sources) {
  return Promise.all(sources.map((src) => preloadSound(src)));
}

const stopGenBySrc = new Map();
function oneShotGen(src) {
  return stopGenBySrc.get(src) || 0;
}
function bumpOneShotGen(src) {
  if (!src) return;
  stopGenBySrc.set(src, oneShotGen(src) + 1);
}

/**
 * Play a decoded buffer. When the buffer is not yet loaded:
 * - one-shots: fire-and-forget preload (legacy) — returns null
 * - loops: return a cancelable pending handle so stop() before decode
 *   prevents an orphaned loop from starting
 */
function playBuffer(src, volume = 1.0, duration = null, playbackRate = 1.0, loop = false, pan = 0) {
  const ctx = getContext();
  ensureContextResumed();

  const buffer = audioBuffers.get(src);
  if (!buffer) {
    if (loop) {
      const pendingId = ++pendingLoopSeq;
      const handle = {
        _pendingId: pendingId,
        _stopped: false,
        _inner: null,
        stop(opts) {
          if (this._stopped) return;
          this._stopped = true;
          if (this._inner && typeof this._inner.stop === "function") {
            try {
              this._inner.stop(opts);
            } catch {
              /* ignore */
            }
          }
        },
      };
      const gen = oneShotGen(src);
      preloadSound(src).then((buf) => {
        if (!buf || handle._stopped || gen !== oneShotGen(src)) return;
        const started = _play(ctx, buf, volume, duration, playbackRate, loop, pan, src);
        if (!started) return;
        handle._inner = {
          stop() {
            try {
              started.source.stop();
            } catch {
              /* ignore */
            }
            try {
              started.source.disconnect();
              started.gainNode.disconnect();
            } catch {
              /* ignore */
            }
          },
        };
        // Race: stop() during the tick between decode resolve and assign.
        if (handle._stopped) {
          handle._inner.stop();
        }
      });
      return handle;
    }
    const gen = oneShotGen(src);
    preloadSound(src).then((buf) => {
      if (!buf || gen !== oneShotGen(src)) return;
      _play(ctx, buf, volume, duration, playbackRate, loop, pan, src);
    });
    return null;
  }

  return _play(ctx, buffer, volume, duration, playbackRate, loop, pan, src);
}

const playingBySrc = new Map();

function trackSource(src, source) {
  if (!src || !source) return;
  let set = playingBySrc.get(src);
  if (!set) {
    set = new Set();
    playingBySrc.set(src, set);
  }
  set.add(source);
}

function untrackSource(src, source) {
  const set = playingBySrc.get(src);
  if (!set) return;
  set.delete(source);
  if (set.size === 0) playingBySrc.delete(src);
}

function srcBasename(src) {
  if (!src) return "";
  const noQuery = String(src).split("?")[0];
  const parts = noQuery.split("/");
  return parts[parts.length - 1];
}

/** Stop in-flight and not-yet-decoded one-shots for these URLs. */
function stopPlayingSrcs(srcs) {
  if (!srcs || !srcs.length) return;
  const keys = new Set();
  for (const src of srcs) {
    if (!src) continue;
    bumpOneShotGen(src);
    keys.add(src);
    keys.add(srcBasename(src));
  }
  for (const [playingSrc, set] of [...playingBySrc.entries()]) {
    if (!keys.has(playingSrc) && !keys.has(srcBasename(playingSrc))) continue;
    bumpOneShotGen(playingSrc);
    for (const source of [...set]) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      untrackSource(playingSrc, source);
    }
  }
}

function _play(ctx, buffer, volume, duration, playbackRate = 1.0, loop = false, pan = 0, src = null) {
  try {
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = Math.max(0, volume);

    source.connect(gainNode);

    let panner = null;
    if (pan !== 0) {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gainNode.connect(panner);
      panner.connect(getMasterEQ());
    } else {
      gainNode.connect(getMasterEQ());
    }

    trackSource(src, source);
    source.onended = () => {
      untrackSource(src, source);
      try {
        source.disconnect();
        gainNode.disconnect();
        if (panner) panner.disconnect();
      } catch (e) {}
    };

    source.start(0);

    if (duration && !loop) {
      source.stop(ctx.currentTime + duration / 1000);
    }

    return { source, gainNode };
  } catch (error) {
    console.error("Error playing sound buffer:", error);
    return null;
  }
}

/**
 * Phase 4: warm browser media cache for long music tracks without decoding
 * full PCM AudioBuffers (~110 MB for the three battle WAVs previously).
 */
function preloadMusic(src) {
  if (!src || typeof Audio === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const el = new Audio();
      el.preload = "auto";
      el.src = src;
      const done = () => resolve(el);
      el.addEventListener("canplaythrough", done, { once: true });
      el.addEventListener("error", () => resolve(null), { once: true });
      // Some Chromium builds never fire canplaythrough for long files; don't hang.
      setTimeout(done, 8000);
      el.load();
    } catch {
      resolve(null);
    }
  });
}

function preloadMusicTracks(sources) {
  return Promise.all(sources.map((src) => preloadMusic(src)));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function rampHtmlVolume(el, from, to, seconds, onDone) {
  const start = performance.now();
  const dur = Math.max(0.05, seconds) * 1000;
  el.volume = clamp01(from);
  let raf = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    // equal-power-ish ease
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

/**
 * Streamed crossfade loop via HTMLAudioElement (no AudioBuffer residency).
 * Same stop({ fadeOut, hold }) surface as the buffer-based loop.
 */
function createStreamedCrossfadeLoop(
  src,
  volume = 1.0,
  crossfadeDuration = 2.0,
  initialFadeIn = 0,
  { startPaused = false } = {}
) {
  const pool = [new Audio(), new Audio()];
  for (const el of pool) {
    el.preload = "auto";
    el.src = src;
    el.loop = false;
    try {
      el.load();
    } catch {
      /* ignore */
    }
  }
  let poolIdx = 0;
  let activeEl = null;
  let durationSec = NaN;
  let stopped = false;
  let paused = !!startPaused;
  let pauseGen = 0;
  let isFirstPlay = true;
  let nextTimer = null;
  let stopHoldTimer = null;
  const pendingTimers = [];
  const cancelRamps = [];

  const trackCancel = (fn) => {
    cancelRamps.push(fn);
  };
  const clearRamps = () => {
    while (cancelRamps.length) {
      try {
        cancelRamps.pop()();
      } catch {
        /* ignore */
      }
    }
  };

  function scheduleNext() {
    if (stopped || paused) return;
    const el = pool[poolIdx++ % 2];
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }

    const startPlayback = () => {
      if (stopped || paused) return;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        durationSec = el.duration;
      }

      if (isFirstPlay) {
        if (initialFadeIn > 0) {
          el.volume = 0;
          el.play().catch(() => {});
          trackCancel(rampHtmlVolume(el, 0, volume, initialFadeIn));
        } else {
          el.volume = clamp01(volume);
          el.play().catch(() => {});
        }
        isFirstPlay = false;
      } else {
        el.volume = 0;
        el.play().catch(() => {});
        trackCancel(rampHtmlVolume(el, 0, volume, crossfadeDuration));
        if (activeEl && activeEl !== el) {
          const prev = activeEl;
          trackCancel(
            rampHtmlVolume(prev, prev.volume, 0, crossfadeDuration, () => {
              try {
                prev.pause();
              } catch {
                /* ignore */
              }
            })
          );
        }
      }
      activeEl = el;

      const d = Number.isFinite(durationSec) ? durationSec : el.duration;
      const lead = Math.max(0.25, (d || 30) - crossfadeDuration);
      nextTimer = setTimeout(scheduleNext, lead * 1000);
      pendingTimers.push(nextTimer);
    };

    if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
      startPlayback();
    } else {
      el.addEventListener(
        "loadedmetadata",
        () => {
          durationSec = el.duration;
          startPlayback();
        },
        { once: true }
      );
      el.load();
    }
  }

  if (!paused) scheduleNext();

  function playingPoolEls() {
    return pool.filter((el) => !el.paused || el === activeEl);
  }

  return {
    pause({ fadeOut = 0.5 } = {}) {
      if (stopped || paused) return;
      paused = true;
      const gen = ++pauseGen;
      if (nextTimer) {
        clearTimeout(nextTimer);
        nextTimer = null;
      }
      clearRamps();
      const fade = Math.max(0.05, fadeOut);
      for (const el of playingPoolEls()) {
        const from = el.volume;
        trackCancel(
          rampHtmlVolume(el, from, 0, fade, () => {
            if (stopped || !paused || gen !== pauseGen) return;
            try {
              el.pause();
            } catch {
              /* ignore */
            }
          })
        );
      }
    },
    resume({ fadeIn = 0.5 } = {}) {
      if (stopped || !paused) return;
      paused = false;
      pauseGen += 1;
      clearRamps();
      // Prepared before first play (HAKKIYOI): start from 0 using initialFadeIn.
      if (!activeEl) {
        scheduleNext();
        return;
      }
      const el = activeEl;
      const fade = Math.max(0.05, fadeIn);
      el.volume = 0;
      el.play().catch(() => {});
      trackCancel(rampHtmlVolume(el, 0, volume, fade));
      const d =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : durationSec;
      const remaining = Math.max(
        0.25,
        (d || 30) - (el.currentTime || 0) - crossfadeDuration
      );
      nextTimer = setTimeout(scheduleNext, remaining * 1000);
      pendingTimers.push(nextTimer);
    },
    isPaused() {
      return paused && !stopped;
    },
    stop({ fadeOut = 0.5, hold = 0 } = {}) {
      if (stopHoldTimer) {
        clearTimeout(stopHoldTimer);
        stopHoldTimer = null;
      }
      paused = false;
      pauseGen += 1;

      const beginFade = () => {
        stopHoldTimer = null;
        stopped = true;
        pendingTimers.forEach(clearTimeout);
        pendingTimers.length = 0;
        if (nextTimer) clearTimeout(nextTimer);
        clearRamps();
        const duration = Math.max(0.05, fadeOut);
        const targets = playingPoolEls();
        for (const el of targets) {
          trackCancel(
            rampHtmlVolume(el, el.volume, 0, duration, () => {
              try {
                el.pause();
              } catch {
                /* ignore */
              }
            })
          );
        }
        const stopTimer = setTimeout(() => {
          clearRamps();
          for (const el of pool) {
            try {
              el.pause();
              el.removeAttribute("src");
              el.load();
            } catch {
              /* ignore */
            }
          }
          activeEl = null;
        }, duration * 1000 + 80);
        pendingTimers.push(stopTimer);
      };

      if (hold > 0 && !stopped) {
        stopHoldTimer = setTimeout(beginFade, hold * 1000);
      } else {
        beginFade();
      }
    },
  };
}

function createBufferCrossfadeLoop(
  src,
  volume = 1.0,
  crossfadeDuration = 2.0,
  initialFadeIn = 0
) {
  const ctx = getContext();

  const buffer = audioBuffers.get(src);
  if (!buffer) return null;

  const activeSources = [];
  const pendingTimers = [];
  let nextTimer = null;
  let stopHoldTimer = null;
  let stopped = false;
  let isFirstPlay = true;

  const instanceMaster = ctx.createGain();
  instanceMaster.connect(getMasterEQ());

  const CURVE_STEPS = 64;
  const fadeInCurve = new Float32Array(CURVE_STEPS);
  const fadeOutCurve = new Float32Array(CURVE_STEPS);
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = i / (CURVE_STEPS - 1);
    fadeInCurve[i] = Math.sin((t * Math.PI) / 2);
    fadeOutCurve[i] = Math.cos((t * Math.PI) / 2);
  }

  function scheduleNext() {
    if (stopped) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(instanceMaster);

    const startTime = ctx.currentTime;

    if (isFirstPlay) {
      if (initialFadeIn > 0) {
        instanceMaster.gain.setValueAtTime(0, startTime);
        instanceMaster.gain.linearRampToValueAtTime(
          volume,
          startTime + initialFadeIn
        );
      } else {
        instanceMaster.gain.setValueAtTime(volume, startTime);
      }
      gainNode.gain.value = 1;
      isFirstPlay = false;
    } else {
      gainNode.gain.value = 0;
      gainNode.gain.setValueCurveAtTime(
        fadeInCurve,
        startTime,
        crossfadeDuration
      );
    }

    if (activeSources.length > 0) {
      const prev = activeSources[activeSources.length - 1];
      prev.gainNode.gain.cancelScheduledValues(startTime);
      prev.gainNode.gain.setValueCurveAtTime(
        fadeOutCurve,
        startTime,
        crossfadeDuration
      );
      const fadeTimer = setTimeout(() => {
        if (stopped) return;
        try {
          prev.source.stop();
        } catch (e) {}
        try {
          prev.source.disconnect();
          prev.gainNode.disconnect();
        } catch (e) {}
        const idx = activeSources.indexOf(prev);
        if (idx !== -1) activeSources.splice(idx, 1);
      }, crossfadeDuration * 1000 + 100);
      pendingTimers.push(fadeTimer);
    }

    source.start(0);
    activeSources.push({ source, gainNode });

    const nextTime = (buffer.duration - crossfadeDuration) * 1000;
    nextTimer = setTimeout(scheduleNext, nextTime);
    pendingTimers.push(nextTimer);
  }

  function begin() {
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (!stopped) scheduleNext();
      });
    } else {
      scheduleNext();
    }
  }

  begin();

  return {
    // hold: keep playing at full volume before fade (seconds)
    // fadeOut: gain ramp to silence (seconds)
    stop({ fadeOut = 0.5, hold = 0 } = {}) {
      if (stopHoldTimer) {
        clearTimeout(stopHoldTimer);
        stopHoldTimer = null;
      }

      const beginFade = () => {
        stopHoldTimer = null;
        stopped = true;
        pendingTimers.forEach(clearTimeout);
        pendingTimers.length = 0;
        if (nextTimer) clearTimeout(nextTimer);
        const duration = Math.max(0.05, fadeOut);
        const now = ctx.currentTime;
        try {
          instanceMaster.gain.cancelScheduledValues(now);
          instanceMaster.gain.setValueAtTime(instanceMaster.gain.value, now);
          instanceMaster.gain.linearRampToValueAtTime(0, now + duration);
        } catch (e) {}
        const stopTimer = setTimeout(() => {
          for (const entry of activeSources) {
            try {
              entry.source.stop();
            } catch (e) {}
            try {
              entry.source.disconnect();
              entry.gainNode.disconnect();
            } catch (e) {}
          }
          activeSources.length = 0;
          try {
            instanceMaster.disconnect();
          } catch (e) {}
        }, duration * 1000 + 50);
        pendingTimers.push(stopTimer);
      };

      if (hold > 0 && !stopped) {
        stopHoldTimer = setTimeout(beginFade, hold * 1000);
      } else {
        beginFade();
      }
    },
  };
}

/**
 * Prefer decoded AudioBuffer loops for short SFX-style music (eeshi).
 * Fall back to streamed HTMLAudioElement loops for long battle tracks that
 * were intentionally not preloadSound()'d.
 */
function createCrossfadeLoop(
  src,
  volume = 1.0,
  crossfadeDuration = 2.0,
  initialFadeIn = 0,
  opts = {}
) {
  if (audioBuffers.has(src) && !opts.startPaused) {
    return createBufferCrossfadeLoop(
      src,
      volume,
      crossfadeDuration,
      initialFadeIn
    );
  }
  return createStreamedCrossfadeLoop(
    src,
    volume,
    crossfadeDuration,
    initialFadeIn,
    opts
  );
}

export {
  preloadSound,
  preloadSounds,
  preloadMusic,
  preloadMusicTracks,
  playBuffer,
  stopPlayingSrcs,
  ensureContextResumed,
  createCrossfadeLoop,
  setMasterSfxGain,
  getMasterSfxGain,
  getMasterEQ,
};
