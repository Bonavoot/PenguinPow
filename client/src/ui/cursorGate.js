// Explicit "needs a mouse click" reasons. Cursor is shown (custom) only while
// at least one reason is held — otherwise hidden. Fight, prematch, and
// between-round dead time hold nothing, so the cursor stays off.

const reasons = new Set();
const listeners = new Set();

function emit() {
  const visible = reasons.size > 0;
  listeners.forEach((listener) => listener(visible));
}

export function acquireCursor(reason) {
  if (!reason || reasons.has(reason)) return;
  reasons.add(reason);
  emit();
}

export function releaseCursor(reason) {
  if (!reason || !reasons.has(reason)) return;
  reasons.delete(reason);
  emit();
}

export function isCursorVisible() {
  return reasons.size > 0;
}

/** Subscribe to visibility changes. Returns unsubscribe. */
export function subscribeCursorVisible(listener) {
  listeners.add(listener);
  listener(reasons.size > 0);
  return () => listeners.delete(listener);
}
