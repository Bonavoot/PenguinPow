/**
 * One dodge-start whoosh per hop.
 *
 * Predict and server confirm both used to play dodge-sound.mp3. Rope kick-off
 * then replayed the same sample as SLIDE_REDIRECT. That stacked 2–4 whooshes
 * on one Shift, especially off the tawara.
 *
 * Window is under the min dash gap (135ms dodge + 100ms cooldown).
 */

const DODGE_START_AUDIO_WINDOW_MS = 180;

const lastAtByFighter = new Map();
const lastStartTimeByFighter = new Map();
const pendingByFighter = new Map();

export function claimDodgeStartAudio(fighterId, dodgeStartTime) {
  const id = fighterId || "local";
  const now =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const prevAt = lastAtByFighter.get(id);
  const prevStart = lastStartTimeByFighter.get(id);
  const pending = !!pendingByFighter.get(id);

  if (dodgeStartTime && prevStart === dodgeStartTime) return false;

  // Confirm of a hop we already whooshed on the press frame.
  if (dodgeStartTime && pending) {
    lastStartTimeByFighter.set(id, dodgeStartTime);
    pendingByFighter.set(id, false);
    return false;
  }

  if (prevAt != null && now - prevAt < DODGE_START_AUDIO_WINDOW_MS) {
    if (dodgeStartTime) {
      lastStartTimeByFighter.set(id, dodgeStartTime);
      pendingByFighter.set(id, false);
    }
    return false;
  }

  lastAtByFighter.set(id, now);
  if (dodgeStartTime) {
    lastStartTimeByFighter.set(id, dodgeStartTime);
    pendingByFighter.set(id, false);
  } else {
    pendingByFighter.set(id, true);
  }
  return true;
}

export function clearDodgeStartAudio() {
  lastAtByFighter.clear();
  lastStartTimeByFighter.clear();
  pendingByFighter.clear();
}

export { DODGE_START_AUDIO_WINDOW_MS };
