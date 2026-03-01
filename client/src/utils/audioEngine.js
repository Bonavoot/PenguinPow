let audioContext = null;
let masterEQ = null;
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

/**
 * Play a sound effect instantly from a pre-decoded AudioBuffer.
 * @param {string} src - The sound file URL (same as what was passed to preloadSound)
 * @param {number} volume - Final volume, caller should apply global volume
 * @param {number|null} duration - Optional max duration in milliseconds
 * @returns {{ source: AudioBufferSourceNode, gainNode: GainNode } | null}
 */
function playBuffer(src, volume = 1.0, duration = null, playbackRate = 1.0, loop = false, pan = 0) {
  const ctx = getContext();
  ensureContextResumed();

  const buffer = audioBuffers.get(src);
  if (!buffer) {
    preloadSound(src).then((buf) => {
      if (buf) _play(ctx, buf, volume, duration, playbackRate, loop, pan);
    });
    return null;
  }

  return _play(ctx, buffer, volume, duration, playbackRate, loop, pan);
}

function _play(ctx, buffer, volume, duration, playbackRate = 1.0, loop = false, pan = 0) {
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

    source.onended = () => {
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

function createCrossfadeLoop(src, volume = 1.0, crossfadeDuration = 2.0) {
  const ctx = getContext();

  const buffer = audioBuffers.get(src);
  if (!buffer) return null;

  const activeSources = [];
  const pendingTimers = [];
  let nextTimer = null;
  let stopped = false;
  let isFirstPlay = true;

  const CURVE_STEPS = 64;
  const fadeInCurve = new Float32Array(CURVE_STEPS);
  const fadeOutCurve = new Float32Array(CURVE_STEPS);
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = i / (CURVE_STEPS - 1);
    fadeInCurve[i] = Math.sin(t * Math.PI / 2) * volume;
    fadeOutCurve[i] = Math.cos(t * Math.PI / 2) * volume;
  }

  function scheduleNext() {
    if (stopped) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(getMasterEQ());

    const startTime = ctx.currentTime;

    if (isFirstPlay) {
      gainNode.gain.value = volume;
      isFirstPlay = false;
    } else {
      gainNode.gain.value = 0;
      gainNode.gain.setValueCurveAtTime(fadeInCurve, startTime, crossfadeDuration);
    }

    if (activeSources.length > 0) {
      const prev = activeSources[activeSources.length - 1];
      prev.gainNode.gain.cancelScheduledValues(startTime);
      prev.gainNode.gain.setValueCurveAtTime(fadeOutCurve, startTime, crossfadeDuration);
      const fadeTimer = setTimeout(() => {
        if (stopped) return;
        try { prev.source.stop(); } catch (e) {}
        try { prev.source.disconnect(); prev.gainNode.disconnect(); } catch (e) {}
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
      ctx.resume().then(() => { if (!stopped) scheduleNext(); });
    } else {
      scheduleNext();
    }
  }

  begin();

  return {
    stop() {
      stopped = true;
      pendingTimers.forEach(clearTimeout);
      pendingTimers.length = 0;
      if (nextTimer) clearTimeout(nextTimer);
      const now = ctx.currentTime;
      for (const entry of activeSources) {
        try {
          entry.gainNode.gain.cancelScheduledValues(now);
          entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
          entry.gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        } catch (e) {}
      }
      const stopTimer = setTimeout(() => {
        for (const entry of activeSources) {
          try { entry.source.stop(); } catch (e) {}
          try { entry.source.disconnect(); entry.gainNode.disconnect(); } catch (e) {}
        }
        activeSources.length = 0;
      }, 350);
      pendingTimers.push(stopTimer);
    }
  };
}

export { preloadSound, preloadSounds, playBuffer, ensureContextResumed, createCrossfadeLoop };
