/**
 * Bout clock constants — display mirror.
 *
 * The SERVER OWNS THE CLOCK (server-io/boutClock.js). It arms the
 * deadline at HAKKI-YOI and emits `bout_clock` with the whole second
 * whenever it changes, so the client never counts down on its own and
 * can't drift. BOUT_SECONDS here is only the value the HUD parks on
 * during the walk-up, before the first tick arrives — same mirroring
 * convention as combatTiming.js, and the server value always wins.
 *
 * 30 rather than the arcade-standard 99: a real tachiai-to-decision bout
 * is usually under fifteen seconds, so a 99 count would read as a number
 * that never moves. 30 still covers most exchanges, but it expires often
 * enough that the clock feels like a real pressure.
 *
 * MUST stay in lockstep with server-io/boutClock.js BOUT_SECONDS.
 */
export const BOUT_SECONDS = 30;

/** Below this the clock goes vermillion and pulses. */
export const CLOCK_URGENT_AT = 10;

/**
 * Bout card ("DAY 7" / "ROUND 2" / "FINAL ROUND") animation length.
 *
 * The server holds the tachiai open by exactly the shortfall this
 * implies, so the card is never clipped on bouts that skip the salt
 * throw. Change it here and BOUT_CARD_MS in server-io/boutClock.js
 * together, or later bouts start losing the tail of the card again.
 */
export const BOUT_CARD_SECONDS = 1.4;
