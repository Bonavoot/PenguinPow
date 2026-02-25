const {
  ALL_TRACKED_PROPS,
  ALWAYS_SEND_PROPS,
  DELTA_TRACKED_PROPS,
} = require("./constants");

// Shallow-compare two arrays of flat objects without JSON.stringify.
// Used for snowballs/pumoArmy which are small arrays (~0-5 elements) of flat objects.
// ~10-50x faster than JSON.stringify comparison for typical game state.
function shallowArrayEquals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (itemA === itemB) continue;
    const keys = Object.keys(itemA);
    if (keys.length !== Object.keys(itemB).length) return false;
    for (let k = 0; k < keys.length; k++) {
      if (itemA[keys[k]] !== itemB[keys[k]]) return false;
    }
  }
  return true;
}

function computePlayerDelta(currentState, previousState) {
  if (!previousState) {
    const delta = {};
    for (let i = 0; i < ALL_TRACKED_PROPS.length; i++) {
      const prop = ALL_TRACKED_PROPS[i];
      if (currentState[prop] !== undefined) {
        delta[prop] = currentState[prop];
      }
    }
    return delta;
  }
  
  const delta = {};
  
  for (let i = 0; i < ALWAYS_SEND_PROPS.length; i++) {
    delta[ALWAYS_SEND_PROPS[i]] = currentState[ALWAYS_SEND_PROPS[i]];
  }
  
  for (let i = 0; i < DELTA_TRACKED_PROPS.length; i++) {
    const prop = DELTA_TRACKED_PROPS[i];
    const current = currentState[prop];
    const previous = previousState[prop];
    
    if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        if (!shallowArrayEquals(current, previous)) {
          delta[prop] = current;
        }
      } else {
        if (!previous || current.x !== previous.x || current.y !== previous.y) {
          delta[prop] = current;
        }
      }
    } else if (current !== previous) {
      delta[prop] = current;
    }
  }
  
  return delta;
}

// Shallow copy of player state for comparison.
// Replaces JSON.parse(JSON.stringify()) which was the most expensive per-tick operation.
// Safe because snowballs/pumoArmy elements and knockbackVelocity are flat objects (no nesting).
function clonePlayerState(player) {
  const clone = {};
  for (let i = 0; i < ALL_TRACKED_PROPS.length; i++) {
    const prop = ALL_TRACKED_PROPS[i];
    const value = player[prop];
    if (value !== undefined) {
      if (Array.isArray(value)) {
        clone[prop] = value.map(item => ({...item}));
      } else if (typeof value === 'object' && value !== null) {
        clone[prop] = {...value};
      } else {
        clone[prop] = value;
      }
    }
  }
  return clone;
}

module.exports = {
  shallowArrayEquals,
  computePlayerDelta,
  clonePlayerState,
};
