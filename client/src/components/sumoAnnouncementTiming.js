/**
 * Timing contract for the SumoAnnouncementBanner rail.
 *
 * Lives outside the component file so callers can reason about how long a plaque
 * is on screen without importing the component.
 *
 * The `duration` a caller passes to the banner is a target for the HOLD, not the
 * time on screen: a shared minimum hold and the slide-away exit both extend past
 * it. Anything that needs a plaque to retire alongside a gameplay beat must ask
 * announcementVisibleMs() rather than assume the two are equal.
 */

export const ANNOUNCEMENT_EXIT_S = 0.28;
export const ANNOUNCEMENT_MIN_HOLD_S = 0.4;

/** When the plaque is actually gone from the rail, in ms. */
export function announcementVisibleMs(durationS) {
  const hold = Math.max(ANNOUNCEMENT_MIN_HOLD_S, durationS - ANNOUNCEMENT_EXIT_S);
  return Math.round((hold + ANNOUNCEMENT_EXIT_S) * 1000);
}
