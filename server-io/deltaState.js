const {
  ALL_TRACKED_PROPS,
  ALWAYS_SEND_PROPS,
  DELTA_TRACKED_PROPS,
  LANDING_DIAG_DELTA_PROPS,
} = require("./constants");
const { LANDING_DEBUG_NET } = require("./landingFlags");

/**
 * Effective tracked-prop lists. Landing diagnostics ride the wire only when
 * LANDING_DEBUG_NET is on — production PvP stays lean.
 */
function getDeltaTrackedProps() {
  if (!LANDING_DEBUG_NET) return DELTA_TRACKED_PROPS;
  return DELTA_TRACKED_PROPS.concat(LANDING_DIAG_DELTA_PROPS);
}

function getAllTrackedProps() {
  if (!LANDING_DEBUG_NET) return ALL_TRACKED_PROPS;
  return ALL_TRACKED_PROPS.concat(LANDING_DIAG_DELTA_PROPS);
}

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
  const allProps = getAllTrackedProps();
  const deltaProps = getDeltaTrackedProps();

  if (!previousState) {
    const delta = {};
    for (let i = 0; i < allProps.length; i++) {
      const prop = allProps[i];
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
  
  for (let i = 0; i < deltaProps.length; i++) {
    const prop = deltaProps[i];
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
  const allProps = getAllTrackedProps();
  for (let i = 0; i < allProps.length; i++) {
    const prop = allProps[i];
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
  computePlayerDelta,
  clonePlayerState,
  getDeltaTrackedProps,
  getAllTrackedProps,
  LANDING_DIAG_DELTA_PROPS,
};
