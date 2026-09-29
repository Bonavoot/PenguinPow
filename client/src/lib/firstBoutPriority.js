/**
 * First-bout sprite priority — pure, Node-safe (no asset imports).
 *
 * Given the two fighters' colors / gear, returns an ordered list of source
 * tokens the pre-match gate must decode before `pre_match_complete`.
 * Rarely-used poses (ritual, salt, snowball, flap, cinematic KO, …) stay off
 * this list and load in idle time after `game_start`.
 */

export const FIRST_BOUT_SPRITE_IDS = Object.freeze([
  // base poses
  "pumo-idle",
  "pumo-ready-position",
  "pumo-tachiai-position",
  // walk
  "pumo-waddle_spritesheet",
  // slap
  "slapAttack1",
  "slapAttack2",
  "slap-attack-1-blur-frame",
  "slap-attack-1-hit-frame",
  "slap-attack-2-blur-frame",
  "slap-attack-2-hit-frame",
  "attack",
  // grab
  "grabbing",
  "grab-attempt_spritesheet",
  "is-being-grabbed_spritesheet",
  // hit
  "hit_spritesheet",
  // dodge
  "dodging",
  // slide
  "sliding",
  // first-seconds combat (leaving these cold was the ghost-frame regression)
  "palm-thrust-startup",
  "palm-thrust-smear",
  "palm-thrust",
  "charging",
  "blocking",
  "blocking_spritesheet",
  "block-parry",
  "crouch-stance",
  "crouch-strafing_spritesheet",
  "recovering",
  "throwing",
  "pumo-flap-1",
  "pumo-flap-2",
]);

export const FIRST_BOUT_ARENA_IDS = Object.freeze([
  "dohyo-display",
  "game-map-444",
  "map-antarctica-sky",
  "game-map-antarctica2-floor",
]);

export const FIRST_BOUT_HUD_IDS = Object.freeze(["gyoji", "gyoji-ready"]);

const PRIORITY_SET = new Set(FIRST_BOUT_SPRITE_IDS);

/**
 * @param {{
 *   player1Color?: string,
 *   player2Color?: string,
 *   player1BodyColor?: string|null,
 *   player2BodyColor?: string|null,
 *   player1GearIds?: string[],
 *   player2GearIds?: string[],
 * }} spec
 * @returns {string[]} ordered source tokens
 */
export function listFirstBoutSources(spec = {}) {
  const p1Color = spec.player1Color || "#DA1B44";
  const p2Color = spec.player2Color || "#4169E1";
  const p1Body = spec.player1BodyColor || null;
  const p2Body = spec.player2BodyColor || null;
  const p1Gear = Array.isArray(spec.player1GearIds) ? spec.player1GearIds : [];
  const p2Gear = Array.isArray(spec.player2GearIds) ? spec.player2GearIds : [];

  const out = [];
  const seen = new Set();
  const add = (token) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  };

  const paintFighter = (player, color, body, gearIds) => {
    const bodyKey = body || "none";
    for (const id of FIRST_BOUT_SPRITE_IDS) {
      add(`sprite:${id}`);
      add(`tint:${id}:${color}:${bodyKey}:${player}`);
    }
    for (const gearId of gearIds) {
      if (!gearId) continue;
      for (const id of FIRST_BOUT_SPRITE_IDS) {
        add(`gear:${gearId}:${id}:${color}:${bodyKey}:${player}`);
      }
    }
  };

  paintFighter("p1", p1Color, p1Body, p1Gear);
  paintFighter("p2", p2Color, p2Body, p2Gear);
  for (const id of FIRST_BOUT_ARENA_IDS) add(`arena:${id}`);
  for (const id of FIRST_BOUT_HUD_IDS) add(`hud:${id}`);
  return out;
}

/** True when a runtime sprite URL is in the first-bout fighter set. */
export function isFirstBoutSpriteId(id) {
  if (!id) return false;
  if (PRIORITY_SET.has(id)) return true;
  // Longest-match bake ids for toppers are `pumo-idle-bald`, not `pumo-idle`.
  if (id.endsWith("-bald") && PRIORITY_SET.has(id.slice(0, -5))) return true;
  return false;
}
