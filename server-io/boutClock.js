/**
 * Bout clock + hantei (judges' decision).
 *
 * Sumo has no time limit and no health bars, but it does have a rule for
 * an inconclusive bout: the judges confer and award it. That is hantei,
 * and it is what this module models. If the clock runs out, nobody was
 * pushed out and nobody collapsed, so the bout is decided on how each
 * wrestler was DOING at the bell.
 *
 * The score is one 0-100 number per wrestler, higher wins, and it is the
 * number the client prints over each penguin's head. Three inputs:
 *
 *   position (60%) — how far from the tawara you are standing. This
 *     dominates because it is the only one of the three that is actually
 *     sumo: the bout is about ring control, and a wrestler backed onto
 *     the straw was losing regardless of what the bars said.
 *   stamina  (25%) — you were being worn down.
 *   balance  (15%) — you were about to be thrown. Smallest weight
 *     because posture swings fast and hard; at a higher weight a single
 *     unlucky tip-slap at second 59 would decide the bout.
 *
 * Position is normalized so dead center is 100 and the straw is 0,
 * symmetrically on both sides. That is what makes "bigger number wins"
 * true no matter which half of the dohyo a wrestler is standing in — the
 * raw x coordinate can't be shown directly, because on the west side a
 * larger x means closer to going out.
 *
 * Pure functions, no imports, no state: the server owns the decision and
 * ships the finished scores to the client, so this math exists in
 * exactly one place and the client never has to agree with it.
 */

/** Bout length. Mirrored for display in client/src/config/boutClock.js. */
const BOUT_SECONDS = 30;

/**
 * Bout card animation length. MUST match BOUT_CARD_SECONDS on the client.
 *
 * 1.4s, not the 1.7s it started at. The card's length sets how long the
 * tachiai has to be held open on bouts that skip the salt throw, and
 * skipping the salt only saves 1483ms in the first place — a 1.7s card
 * would have handed nearly all of that back. At 1.4s a "ROUND 2" still
 * gets ~200ms in, ~800ms held and ~400ms out, which is a comfortable
 * read for two short words, and the no-salt bouts stay noticeably
 * quicker to the tachiai than the opener.
 */
const BOUT_CARD_MS = 1400;

/** readyStartTime → gyoji_call, in index.js and handleReadyPositions. */
const GYOJI_CALL_DELAY_MS = 700;

/**
 * How long the tachiai must wait after the bout card fires.
 *
 * The client kills the card the moment gyoji_call lands, so the card's
 * real screen time is (tachiai start − card fired) + GYOJI_CALL_DELAY_MS.
 * Holding for the difference gives it exactly its animation and not a
 * frame more.
 */
const BOUT_CARD_HOLD_MS = BOUT_CARD_MS - GYOJI_CALL_DELAY_MS;

/**
 * When the tachiai countdown may start.
 *
 * On the first bout the salt throw runs (1483ms) plus the walk, so the
 * card has finished long before the wrestlers are set and this returns
 * `now` unchanged. Later bouts SKIP the salt to get back into the fight
 * faster — which left the card perhaps a couple hundred ms before the
 * Gyoji cut it off. This buys back only the shortfall, so the fast path
 * stays fast and the card is never clipped.
 *
 * Returning a FUTURE readyStartTime rather than refusing to set one is
 * deliberate: every downstream beat is `now - readyStartTime >= X`, so a
 * seeded start shifts the whole ceremony as a unit instead of squeezing
 * HANDS DOWN against HAKKI-YOI.
 */
function tachiaiStartAt(now, boutCardAtSim) {
  if (!boutCardAtSim) return now;
  return Math.max(now, boutCardAtSim + BOUT_CARD_HOLD_MS);
}

const HANTEI_WEIGHTS = {
  position: 0.6,
  stamina: 0.25,
  balance: 0.15,
};

/**
 * Scores closer than this are a genuine stalemate → torinaoshi (the bout
 * is fought again). Kept deliberately tight: it should fire when two
 * wrestlers really are mirror images, not merely when the bout was
 * close, because a rematch is a much bigger interruption than a
 * decision the loser disagrees with.
 */
const HANTEI_TIE_EPSILON = 0.5;

/**
 * Build the ring the decision is measured against.
 *
 * Deliberately the ROPE boundaries (MAP_LEFT/RIGHT_BOUNDARY, the line a
 * ring-out is actually called on), not the wider visible clay
 * (DOHYO_LEFT/RIGHT_BOUNDARY). Scoring against the clay would give a
 * wrestler standing on the straw a non-zero position score even though
 * one more shove ends the bout — the number has to hit 0 exactly where
 * losing happens.
 */
function ringFromBoundaries(left, right) {
  return {
    centerX: (left + right) / 2,
    halfWidth: (right - left) / 2,
  };
}

/**
 * Text for the card that plays over the walk-up.
 *
 * BASHO counts days; everything else counts rounds. "FINAL ROUND" wins
 * over the number in best-of-3 at one fall apiece, because at that point
 * what matters is that the next fall ends the match, not that it happens
 * to be the third.
 *
 * @returns {{label: string, final: boolean}}
 */
function describeBout(opts) {
  const {
    matchMode,
    bashoBout = 0,
    bashoTotalBouts = 1,
    winsP1 = 0,
    winsP2 = 0,
  } = opts || {};

  if (matchMode === "basho") {
    const total = bashoTotalBouts || 1;
    const day = Math.min(bashoBout + 1, total);
    return { label: `DAY ${day}`, final: day >= total };
  }

  const final = winsP1 >= 1 && winsP2 >= 1;
  return {
    label: final ? "FINAL ROUND" : `ROUND ${winsP1 + winsP2 + 1}`,
    final,
  };
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Ring control, 1 at dead center falling to 0 at the straw.
 *
 * @param {number} x            wrestler's horizontal position
 * @param {number} centerX      horizontal midpoint of the dohyo
 * @param {number} halfWidth    center → tawara distance
 */
function ringSafety(x, centerX, halfWidth) {
  if (!(halfWidth > 0) || !Number.isFinite(x)) return 1;
  return clamp01(1 - Math.abs(x - centerX) / halfWidth);
}

/**
 * @param {{x:number, stamina:number, balance:number}} p  wrestler state
 *   (stamina and balance are 0-100)
 * @param {{centerX:number, halfWidth:number}} ring
 * @returns {number} 0-100, one decimal place
 */
function hanteiScore(p, ring) {
  const position = ringSafety(p.x, ring.centerX, ring.halfWidth);
  const stamina = clamp01((p.stamina ?? 0) / 100);
  const balance = clamp01((p.balance ?? 0) / 100);

  const raw =
    position * HANTEI_WEIGHTS.position +
    stamina * HANTEI_WEIGHTS.stamina +
    balance * HANTEI_WEIGHTS.balance;

  // One decimal so the printed numbers can differ without showing a
  // pile of digits, and so the tie band means what it looks like.
  return Math.round(raw * 1000) / 10;
}

/**
 * Award an expired bout.
 *
 * @returns {{winner: "player1"|"player2"|null, scores: {player1:number, player2:number}}}
 *   `winner: null` means torinaoshi — too close to call, fight it again.
 */
function resolveHantei(p1, p2, ring) {
  const scores = {
    player1: hanteiScore(p1, ring),
    player2: hanteiScore(p2, ring),
  };

  const margin = scores.player1 - scores.player2;
  if (Math.abs(margin) < HANTEI_TIE_EPSILON) {
    return { winner: null, scores };
  }
  return { winner: margin > 0 ? "player1" : "player2", scores };
}

module.exports = {
  BOUT_SECONDS,
  BOUT_CARD_MS,
  BOUT_CARD_HOLD_MS,
  GYOJI_CALL_DELAY_MS,
  tachiaiStartAt,
  HANTEI_WEIGHTS,
  HANTEI_TIE_EPSILON,
  ringFromBoundaries,
  describeBout,
  ringSafety,
  hanteiScore,
  resolveHantei,
};
