// ============================================
// LOCAL INPUT BRIDGE
// ============================================
// Game.jsx owns the live keyboard/gamepad key state object (mutated in place,
// never recreated). The movement predictor in GameFighter needs to read it
// every animation frame without prop-drilling or re-renders, so Game.jsx
// registers the object here and GameFighter reads it through getters.
//
// If nothing is registered (e.g. mobile touch controls, spectators, replays)
// getLocalKeyState() returns null and the predictor simply stays passive —
// rendering falls back to the standard server interpolation path.

let localKeyState = null;
let gameActive = false;

export function registerLocalKeyState(keyStateObject) {
  localKeyState = keyStateObject;
}

export function unregisterLocalKeyState(keyStateObject) {
  if (localKeyState === keyStateObject) {
    localKeyState = null;
  }
}

export function getLocalKeyState() {
  return localKeyState;
}

export function setLocalGameActive(active) {
  gameActive = !!active;
}

export function isLocalGameActive() {
  return gameActive;
}
