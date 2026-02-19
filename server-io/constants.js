const GRAB_STATES = {
  INITIAL: "initial",
  ATTEMPTING: "attempting",
  SUCCESS: "success",
  COUNTERED: "countered",
  PUSHING: "pushing",
  ATTEMPTING_PULL: "attempting_pull",
  ATTEMPTING_THROW: "attempting_throw",
};

// Performance: game logic runs at TICK_RATE; broadcasts every N ticks to reduce network + client work
const TICK_RATE = 64;
const BROADCAST_EVERY_N_TICKS = 2; // 2 = 32 Hz broadcast (client interpolation smooths to 60fps)

module.exports = {
  GRAB_STATES,
  TICK_RATE,
  BROADCAST_EVERY_N_TICKS,
};
