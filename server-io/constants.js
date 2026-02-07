const GRAB_STATES = {
  INITIAL: "initial",
  ATTEMPTING: "attempting",
  SUCCESS: "success",
  COUNTERED: "countered",
};

// Performance: game logic runs at TICK_RATE; broadcasts every N ticks to reduce network + client work
const TICK_RATE = 64;
const BROADCAST_EVERY_N_TICKS = 1; // 1 = 64 Hz (smooth), 2 = 32 Hz (lower CPU/network but choppier)

module.exports = {
  GRAB_STATES,
  TICK_RATE,
  BROADCAST_EVERY_N_TICKS,
};
