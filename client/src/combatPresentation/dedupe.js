/**
 * Presentation-event dedupe store (Phase 6).
 * Prevents retransmission / double React handlers from replaying FX.
 */

const MAX_SEEN = 256;
const seenOrder = [];
const seenSet = new Set();

export function hasSeenPresentationEvent(eventId) {
  if (!eventId) return false;
  return seenSet.has(eventId);
}

export function notePresentationEvent(eventId) {
  if (!eventId) return false;
  if (seenSet.has(eventId)) return false;
  seenSet.add(eventId);
  seenOrder.push(eventId);
  while (seenOrder.length > MAX_SEEN) {
    const old = seenOrder.shift();
    if (old) seenSet.delete(old);
  }
  return true;
}

/** Claim once — returns true if this is the first observation. */
export function claimPresentationEvent(eventId) {
  if (!eventId) return true;
  if (seenSet.has(eventId)) return false;
  return notePresentationEvent(eventId);
}

export function clearPresentationEvents() {
  seenSet.clear();
  seenOrder.length = 0;
}

export function presentationDedupeSize() {
  return seenSet.size;
}
