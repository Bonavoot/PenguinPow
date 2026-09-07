// One-shot hand-off from the match view to the lobby: why the bout ended
// without a normal result (opponent left / disconnected). Module-level so the
// Game → Lobby page switch needs no prop threading; consumed once on read.
let pending = null;

export function setMatchOutcomeNotice(notice) {
  pending = notice ? { ...notice, at: Date.now() } : null;
}

/** Returns the notice (if set within the last 15 s) and clears it. */
export function takeMatchOutcomeNotice() {
  const n = pending;
  pending = null;
  if (!n || Date.now() - n.at > 15000) return null;
  return n;
}
