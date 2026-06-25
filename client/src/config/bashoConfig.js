/**
 * bashoConfig.js — Single source of truth for BASHO mode data definitions.
 *
 * This is the data-driven backbone for the BASHO hub UI (Phase 1). Stats,
 * loadout categories, and the banzuke division ladder all live here so the
 * UI renders from config and future content (real loadout options, tuned
 * stat curves, etc.) auto-populates with zero UI rewrite.
 *
 * See BASHO_MODE_SPEC.md §5.4 (two-speed progression) and §5.6 (banzuke).
 *
 * IMPORTANT: nothing here may touch PvP. These definitions describe the
 * single-player BASHO sandbox only.
 */

// ============================================
// ATTRIBUTES (persistent, 5 stats — §5.4)
// ============================================

export const STAT_BASE = 1; // base points in every stat
export const STAT_MAX = 10; // per-stat cap

/*
 * The 5 persistent attributes. `kanji` is a single-glyph accent used for
 * premium flavor in the stat rows; `desc` is the plain-language effect.
 * Real min↔max tuning is a dedicated balance pass (spec §8.1) — these
 * definitions are deliberately effect-agnostic for now.
 */
export const ATTRIBUTES = [
  { key: "power", label: "Power", kanji: "力", desc: "Knockback you deal" },
  { key: "moveSpeed", label: "Move Speed", kanji: "速", desc: "Movement speed" },
  {
    key: "resistance",
    label: "Resistance",
    kanji: "重",
    desc: "Anti-knockback (weight)",
  },
  { key: "stamina", label: "Stamina", kanji: "気", desc: "Stamina pool & regen" },
  { key: "balance", label: "Balance", kanji: "均", desc: "Clinch & throw stability" },
];

// ============================================
// ABILITY LOADOUT (persistent — §5.4)
// ============================================

/*
 * Five loadout categories. Real sidegrade options live in LOADOUT_OPTIONS
 * below; a category with no options renders a "Coming soon" shell. The
 * catalog grows horizontally over dedicated design passes (spec §8.2) — the
 * UI and the point-buy engine are fully data-driven so new entries require
 * zero UI/engine rewrite.
 */
export const LOADOUT_CATEGORIES = [
  { key: "attack", label: "Attack", sub: "Oshi-zumo", kanji: "押" },
  { key: "defense", label: "Defense", sub: "Bōgyo", kanji: "防" },
  { key: "movement", label: "Movement", sub: "Ashi", kanji: "歩" },
  { key: "grappling", label: "Grappling", sub: "Yotsu-zumo", kanji: "組" },
  { key: "shinto", label: "Shinto", sub: "Blessings", kanji: "神" },
];

/*
 * Shared point budget across ALL categories (spec §5.4: "a limited point
 * budget — you can NEVER take all"). Grow the menu, not the budget: future
 * progression unlocks MORE options while this stays fixed. Tuning knob — kept
 * deliberately tight so picks are real tradeoffs once the catalog fills out.
 */
export const LOADOUT_BUDGET = 3;

/*
 * Fundamentals are ALWAYS available and never cost a point (spec §5.4: "Lock
 * additions/alternatives, never fundamentals"). Shown in the hub as on-by-
 * default so the player can see what an empty loadout already gives them.
 * A selected option may REPLACE one of these (e.g. Flap replaces Raw Parry).
 */
export const LOADOUT_DEFAULTS = {
  attack: ["Slap string", "Charge finisher"],
  defense: ["Raw Parry"],
  movement: ["Dodge", "Sidestep"],
  grappling: ["Grab", "Clinch"],
  shinto: [],
};

/*
 * Per-category option catalog. Each entry is a SIDEGRADE (different, not
 * strictly better) — the test is "name the player who picks it, and why."
 *
 * Shape: { id, label, kanji, cost, desc, replaces?: string, unlock?: string }
 *   - cost      : points drawn from the shared LOADOUT_BUDGET.
 *   - replaces  : label of the fundamental this swaps out (display only).
 *   - unlock    : optional unlock id required in career.unlocks; absent =
 *                 freely selectable (the envelope economy lands in §Phase 6).
 *
 * Phase 5 ships ONE real, playable sidegrade — the spec's canonical example —
 * to prove the whole loop end-to-end. The rest stay empty ("Coming soon")
 * pending their own design passes.
 */
export const LOADOUT_OPTIONS = {
  attack: [],
  defense: [
    {
      id: "flap",
      label: "Flap",
      kanji: "翔",
      cost: 1,
      replaces: "Raw Parry",
      unlock: "loadout_flap", // must be purchased from the kenshō shop (§Phase 6)
      desc: "Trade the parry for flight. Space beats your wings — a free liftoff to escape pressure and re-angle, with air-flaps to maneuver. You give up the parry reversal entirely: a mobility-first defense for players who'd rather not be there than counter.",
    },
  ],
  movement: [],
  grappling: [],
  shinto: [],
};

/* Flat id → option lookup across every category. */
export const LOADOUT_OPTION_BY_ID = Object.values(LOADOUT_OPTIONS)
  .flat()
  .reduce((acc, o) => {
    acc[o.id] = o;
    return acc;
  }, {});

/**
 * Total points spent by a `selected` map ({ category: [optionId, ...] }).
 * Unknown ids contribute 0 so a stale save can never over-count.
 */
export function loadoutSpent(selected = {}) {
  return Object.values(selected)
    .flat()
    .reduce((sum, id) => sum + (LOADOUT_OPTION_BY_ID[id]?.cost || 0), 0);
}

// ============================================
// ENVELOPE (KENSHŌ) ECONOMY (§5.4 / §Phase 6 / §8.3)
// ============================================

/*
 * Envelope earn rates per completed basho. The total is:
 *   (base + perWin·wins + KK? + promotion? + yushō?) × tier
 * where `tier` scales by division group (higher ranks pay more). These are
 * the signed-off STARTING numbers — all tuning lives here. Earn rates must
 * respect player time (spec §8.3): a clean lower-division KK already buys
 * meaningful progress.
 */
export const ENVELOPE_REWARDS = {
  base: 20, // just for completing the basho
  perWin: 10, // per bout won
  kachiKoshi: 30, // winning record bonus
  promotion: 50, // climbed a division/title
  yusho: 100, // championship
};

/*
 * Division-tier purse multiplier. Mirrors the opponent name tiers: lower
 * divisions ×1, the salaried sekitori ranks ×2, san'yaku + Yokozuna ×3.
 * Keyed by DIVISIONS index so it tracks the ladder automatically.
 */
export function rewardTierMultiplier(rank) {
  const idx = DIVISIONS.findIndex((d) => d.key === getDivision(rank).key);
  if (idx >= 6) return 3; // komusubi+ (san'yaku, yokozuna)
  if (idx >= 4) return 2; // juryo, maegashira
  return 1; // jonokuchi..makushita
}

/*
 * The kenshō shop catalog: things you spend envelopes to UNLOCK permanently.
 * Buying adds `id` to career.unlocks. Loadout-option unlocks reference the
 * same id the option carries in its `unlock` field, so purchasing here flips
 * that option from "Locked" to selectable with zero extra wiring. The catalog
 * grows alongside the loadout/cosmetic catalogs (§8.2/§8.3) — data only.
 */
export const UNLOCKS = [
  {
    id: "loadout_flap",
    label: "Flap",
    sub: "Defense Sidegrade",
    kanji: "翔",
    cost: 150,
    desc: "Unlock the Flap defense option: trade your raw parry for a flight liftoff.",
  },
];

export const UNLOCK_BY_ID = UNLOCKS.reduce((acc, u) => {
  acc[u.id] = u;
  return acc;
}, {});

/**
 * True when a career owns an unlock id. The "__all__" sentinel (debug
 * "Unlock All") grants everything.
 */
export function isUnlocked(career, id) {
  const owned = career?.unlocks || [];
  return owned.includes("__all__") || owned.includes(id);
}

// ============================================
// IN-BASHO POWER-UP DRAFT (per-run, stacking — §5.4 / §Phase 7)
// ============================================

/*
 * The pool the between-bout DAY-card draft rolls from. These are the existing
 * special power-ups MINUS Flap — Flap lives in the persistent loadout (Defense
 * sidegrade), and the §5.4 "one-home rule" keeps each effect in exactly ONE
 * system (loadout OR draft). The exotic pool expands here in a dedicated
 * content pass — adding ids is data-only.
 *
 * Picks STACK for the whole run (reset each basho): passives multiply, Thick
 * Blubber adds an absorption charge, the actives accumulate uses.
 */
export const BASHO_DRAFT_POOL = [
  "speed",
  "power",
  "snowball",
  "pumo_army",
  "thick_blubber",
];

/**
 * Roll `count` distinct draft options from the pool. Pure-random; the draft is
 * single-player so the client owns the roll (same trust model as the opponent
 * roster in lib/bashoRun). Falls back gracefully if count exceeds the pool.
 */
export function rollDraftOptions(count = 3, pool = BASHO_DRAFT_POOL) {
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, Math.min(count, bag.length));
}

// ============================================
// BANZUKE / RANK LADDER (§5.6)
// ============================================

/*
 * Divisions ordered bottom → top. `numbered` divisions hold a number
 * (lower number = higher rank); the titled san'yaku ranks + Yokozuna sit
 * above and carry no number. `maxNumber` is the gamified bottom slot for
 * a numbered division (real ranges are normalized — spec §5.6 note).
 */
export const DIVISIONS = [
  { key: "jonokuchi", label: "Jonokuchi", bouts: 7, kk: 4, numbered: true, maxNumber: 30 },
  { key: "jonidan", label: "Jonidan", bouts: 7, kk: 4, numbered: true, maxNumber: 100 },
  { key: "sandanme", label: "Sandanme", bouts: 7, kk: 4, numbered: true, maxNumber: 90 },
  { key: "makushita", label: "Makushita", bouts: 7, kk: 4, numbered: true, maxNumber: 60 },
  { key: "juryo", label: "Juryo", bouts: 15, kk: 8, numbered: true, maxNumber: 14 },
  { key: "maegashira", label: "Maegashira", bouts: 15, kk: 8, numbered: true, maxNumber: 17 },
  { key: "komusubi", label: "Komusubi", bouts: 15, kk: 8, numbered: false, title: "Komusubi" },
  { key: "sekiwake", label: "Sekiwake", bouts: 15, kk: 8, numbered: false, title: "Sekiwake" },
  { key: "ozeki", label: "Ozeki", bouts: 15, kk: 8, numbered: false, title: "Ozeki" },
  { key: "yokozuna", label: "Yokozuna", bouts: 15, kk: null, numbered: false, title: "Yokozuna" },
];

export const DIVISION_BY_KEY = DIVISIONS.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

/* The lowest rank everyone starts at — bottom of Jonokuchi. */
export const STARTING_RANK = {
  division: "jonokuchi",
  number: DIVISION_BY_KEY.jonokuchi.maxNumber,
  title: null,
  side: null,
};

/**
 * Look up a division definition from a rank object (tolerant of either a
 * division key like "jonokuchi" or a display label like "Jonokuchi").
 */
export function getDivision(rank) {
  if (!rank?.division) return DIVISION_BY_KEY.jonokuchi;
  const raw = String(rank.division).toLowerCase();
  return DIVISION_BY_KEY[raw] || DIVISION_BY_KEY.jonokuchi;
}

/**
 * Human-readable rank string, e.g. "Jonokuchi #30" or "Yokozuna".
 */
export function formatRank(rank) {
  const div = getDivision(rank);
  if (!div.numbered) return div.label;
  const n = rank?.number ?? div.maxNumber;
  return `${div.label} #${n}`;
}

/**
 * Bouts in the current basho for a given rank (7 lower / 15 upper).
 */
export function boutsForRank(rank) {
  return getDivision(rank).bouts;
}

// ============================================
// DIFFICULTY LADDER (spec §5.5) — maps division → CPU AI tier
// ============================================

/* Tier order, low → high. Used by the intra-basho ramp to "bump up one tier". */
export const DIFFICULTY_ORDER = ["EASY", "NORMAL", "HARD", "IMPOSSIBLE"];

/*
 * Per-division base difficulty (spec §5.5): early ranks are gentle, real heat
 * only once the player is climbing. Bosses (Ozeki/Yokozuna) sit at IMPOSSIBLE.
 * The CPU brain (server-io/cpuAI.js) is one expert dialed up/down by these tiers.
 */
export const DIVISION_DIFFICULTY = {
  jonokuchi: "EASY",
  jonidan: "EASY",
  sandanme: "EASY",
  makushita: "NORMAL",
  juryo: "NORMAL",
  maegashira: "HARD",
  komusubi: "HARD",
  sekiwake: "HARD",
  ozeki: "IMPOSSIBLE",
  yokozuna: "IMPOSSIBLE",
};

export function difficultyForDivision(divisionKey) {
  return DIVISION_DIFFICULTY[String(divisionKey || "").toLowerCase()] || "HARD";
}

// ============================================
// AI PERSONALITY ARCHETYPES (rival roster — §5.7 / Phase 8 follow-up)
// ============================================

/*
 * UI-facing metadata for the CPU personality archetypes. The actual behavior
 * lives server-side in cpuAI.js (PERSONALITY_PROFILES) keyed by the SAME keys;
 * this table is just for displaying a rival's fighting style on the DAY card.
 * `balanced` is the neutral default (no displayed tag).
 */
export const AI_ARCHETYPES = {
  balanced: { key: "balanced", label: "All-rounder", kanji: "均", desc: "No clear tendency — adapts to the bout." },
  pusher: { key: "pusher", label: "Pusher", kanji: "押", desc: "Oshi-zumo — relentless forward slaps and charges." },
  grappler: { key: "grappler", label: "Grappler", kanji: "組", desc: "Yotsu-zumo — hunts the belt and the clinch." },
  counter: { key: "counter", label: "Counter", kanji: "受", desc: "Patient — parries and punishes your mistakes." },
  brawler: { key: "brawler", label: "Brawler", kanji: "烈", desc: "All-out aggression with little regard for defense." },
};

export const ARCHETYPE_KEYS = Object.keys(AI_ARCHETYPES);

/* Step a difficulty tier up one notch (clamped at IMPOSSIBLE). */
export function bumpDifficulty(tier) {
  const i = DIFFICULTY_ORDER.indexOf(tier);
  if (i < 0) return tier;
  return DIFFICULTY_ORDER[Math.min(i + 1, DIFFICULTY_ORDER.length - 1)];
}

/**
 * Effective difficulty for a specific bout in a run, applying the intra-basho
 * ramp (spec §5.5): in the BACK THIRD of the basho, once a winning record
 * (kachi-koshi) is already SECURED, step the base division difficulty up one
 * tier so a strong run finishes hotter. `boutIndex` is 0-based (day − 1).
 */
export function effectiveDifficulty(run, boutIndex) {
  const base = difficultyForDivision(run?.division);
  const total = run?.totalBouts || 1;
  const backThirdStart = Math.ceil((total * 2) / 3); // 0-based bout index
  const kk =
    run?.kk ??
    getDivision({ division: run?.division }).kk ??
    Math.ceil(total / 2);
  const wins = run?.record?.wins ?? 0;
  if (kk != null && boutIndex >= backThirdStart && wins >= kk) {
    return bumpDifficulty(base);
  }
  return base;
}
