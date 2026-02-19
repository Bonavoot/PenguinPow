let audioContext = null;
const audioBuffers = new Map();
const loadingPromises = new Map();

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function ensureContextResumed() {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

["click", "touchstart", "keydown"].forEach((event) => {
  document.addEventListener(event, ensureContextResumed, { passive: true });
});

async function preloadSound(src) {
  if (audioBuffers.has(src)) return audioBuffers.get(src);
  if (loadingPromises.has(src)) return loadingPromises.get(src);

  const ctx = getContext();
  const promise = fetch(src)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      audioBuffers.set(src, decoded);
      loadingPromises.delete(src);
      return decoded;
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
 * @param {number} volume - Final volume (0-1), caller should apply global volume
 * @param {number|null} duration - Optional max duration in milliseconds
 * @returns {{ source: AudioBufferSourceNode, gainNode: GainNode } | null}
 */
function playBuffer(src, volume = 1.0, duration = null) {
  const ctx = getContext();
  ensureContextResumed();

  const buffer = audioBuffers.get(src);
  if (!buffer) {
    preloadSound(src).then((buf) => {
      if (buf) _play(ctx, buf, volume, duration);
    });
    return null;
  }

  return _play(ctx, buffer, volume, duration);
}

function _play(ctx, buffer, volume, duration) {
  try {
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    gainNode.gain.value = Math.max(0, Math.min(1, volume));

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0);

    if (duration) {
      source.stop(ctx.currentTime + duration / 1000);
    }

    return { source, gainNode };
  } catch (error) {
    console.error("Error playing sound buffer:", error);
    return null;
  }
}

export { preloadSound, preloadSounds, playBuffer, ensureContextResumed };
