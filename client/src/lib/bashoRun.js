/**
 * bashoRun — pure run-orchestration logic for a single BASHO (tournament).
 *
 * This module is the "brain" of a run: it has NO React and NO socket code,
 * so it is trivially testable and reusable. It owns:
 *   - run creation + the named-rikishi opponent roster (spec §5.7),
 *   - per-day opponent record generation (close to the player's — §5.7),
 *   - recording bout results + advancing days,
 *   - banzuke movement from a final/withdrawal record (spec §5.6),
 *   - Fake Injury (kyūjō) resolution (spec §5.3),
 *   - the stat-point drip on reaching a new best division (spec §5.4),
 *   - applying a finished run's outcome to the persistent career.
 *
 * The run object is serializable and is what gets stored in
 * `save.bashoRun` so an in-progress basho survives app restarts (resume).
 *
 * GUARDRAIL: single-player only. Nothing here influences PvP or VS CPU.
 * NOTE: the exact movement gradient + elite promotion gates (kadoban,
 * consecutive-yusho, zensho shortcut) are a dedicated balance pass
 * (spec §8.5 / Phase 8). What's here is a clean, authentic-ish MVP.
 */

import {
  DIVISIONS,
  getDivision,
  ENVELOPE_REWARDS,
  rewardTierMultiplier,
  difficultyForDivision,
} from "../config/bashoConfig";

// Total spendable stat points across a whole career (base is separate).
const MAX_STAT_BUDGET = 20;
// Points granted the first time you reach a new personal-best division.
const STAT_DRIP_PER_DIVISION = 2;

// ============================================
// OPPONENT ROSTER (spec §5.7 — placeholder shikona, devs will expand)
// ============================================

/*
 * Curated rival roster. Each rikishi has a STABLE shikona + colors + an AI
 * `archetype` (fighting style — see cpuAI.js PERSONALITY_PROFILES) so they read
 * as distinct characters rather than random palette swaps. Drawn by division
 * tier; per-run shuffled so the order varies but a given rikishi always looks
 * and fights the same. Archetypes are spread so each basho mixes styles.
 */
const RIKISHI = {
  lower: [
    { name: "Waddlemaru", archetype: "pusher", mawashiColor: "#D94848", bodyColor: null },
    { name: "Sir Slipsalot", archetype: "counter", mawashiColor: "#3B5EB0", bodyColor: null },
    { name: "Brrrtholomew", archetype: "grappler", mawashiColor: "#2E9E5A", bodyColor: "#4d4d4d" },
    { name: "Wobbleyama", archetype: "balanced", mawashiColor: "#E8913A", bodyColor: null },
    { name: "Krillbasher", archetype: "brawler", mawashiColor: "#CC3333", bodyColor: null },
    { name: "Tubby Tachiai", archetype: "grappler", mawashiColor: "#A85DBF", bodyColor: "#2656A8" },
    { name: "Slushpuppy", archetype: "balanced", mawashiColor: "#17A8A0", bodyColor: null },
    { name: "Flipper McShove", archetype: "pusher", mawashiColor: "#D4A520", bodyColor: null },
    { name: "Captain Coldcuts", archetype: "counter", mawashiColor: "#525252", bodyColor: null },
    { name: "Señor Belly", archetype: "grappler", mawashiColor: "#E87070", bodyColor: "#8B5E3C" },
    { name: "Frostbite Fumio", archetype: "pusher", mawashiColor: "#2E9E5A", bodyColor: null },
    { name: "Beaky Blinders", archetype: "brawler", mawashiColor: "#A85DBF", bodyColor: null },
  ],
  mid: [
    { name: "Mackerelyama", archetype: "grappler", mawashiColor: "#3B5EB0", bodyColor: "#2656A8" },
    { name: "Sushi Sumoto", archetype: "pusher", mawashiColor: "#D94848", bodyColor: null },
    { name: "Iceberg Ichiro", archetype: "counter", mawashiColor: "#17A8A0", bodyColor: null },
    { name: "Blubbernishiki", archetype: "grappler", mawashiColor: "#A85DBF", bodyColor: "#4d4d4d" },
    { name: "Glacier Gunkan", archetype: "pusher", mawashiColor: "#525252", bodyColor: null },
    { name: "Chill Norris", archetype: "counter", mawashiColor: "#2E9E5A", bodyColor: null },
    { name: "Penguinzilla", archetype: "brawler", mawashiColor: "#CC3333", bodyColor: "#8B5E3C" },
  ],
  elite: [
    { name: "Hakupengu", archetype: "counter", mawashiColor: "#D4A520", bodyColor: null },
    { name: "Shōgun Shirayuki", archetype: "pusher", mawashiColor: "#3B5EB0", bodyColor: null },
    { name: "The Tuxedo Tempest", archetype: "brawler", mawashiColor: "#525252", bodyColor: null },
    { name: "Avalanche Akira", archetype: "grappler", mawashiColor: "#17A8A0", bodyColor: "#4d4d4d" },
    { name: "Daimyo Defrost", archetype: "counter", mawashiColor: "#A85DBF", bodyColor: null },
    { name: "Chonkaisho", archetype: "grappler", mawashiColor: "#E8913A", bodyColor: "#8B5E3C" },
    { name: "Yoko-ZONO", archetype: "brawler", mawashiColor: "#CC3333", bodyColor: null },
  ],
};

/*
 * Division gatekeepers — the FINAL-day boss for the upper divisions (Juryo+).
 * A boss is a signature rikishi with a real combat edge: elevated `stats`
 * (1..10, mapped to combat mods server-side; baseline is 4), a larger `size`
 * (default body is 0.85), and a stacked power-up `powerUps` loadout. `stats`,
 * `size` and `powerUps` are applied to the BASHO CPU opponent ONLY (the
 * firewall: a non-BASHO fighter never receives them). Difficulty climbs to
 * IMPOSSIBLE at the very top (Ozeki/Yokozuna). Keyed by division.
 */
const BOSSES = {
  juryo: {
    name: "Ironbeak Tatsu", archetype: "grappler",
    mawashiColor: "#1F6FEB", bodyColor: "#2b2b2b",
    stats: { power: 5, moveSpeed: 5, resistance: 5, stamina: 5, balance: 6 },
    size: 0.92, powerUps: [], difficulty: "HARD",
  },
  maegashira: {
    name: "Sleetstorm Satō", archetype: "pusher",
    mawashiColor: "#E85D1A", bodyColor: null,
    stats: { power: 6, moveSpeed: 6, resistance: 5, stamina: 5, balance: 5 },
    size: 0.94, powerUps: [], difficulty: "HARD",
  },
  komusubi: {
    name: "Glaefross the Wall", archetype: "counter",
    mawashiColor: "#4B3B8F", bodyColor: null,
    stats: { power: 5, moveSpeed: 5, resistance: 7, stamina: 6, balance: 6 },
    size: 0.96, powerUps: [], difficulty: "HARD",
  },
  sekiwake: {
    name: "Tsunami Tsukasa", archetype: "brawler",
    mawashiColor: "#B01E1E", bodyColor: "#3a3a3a",
    stats: { power: 7, moveSpeed: 6, resistance: 6, stamina: 6, balance: 6 },
    size: 1.0, powerUps: ["power"], difficulty: "HARD",
  },
  ozeki: {
    name: "Emperor Frostfuji", archetype: "pusher",
    mawashiColor: "#0B5FA5", bodyColor: "#1f1f1f",
    stats: { power: 8, moveSpeed: 7, resistance: 7, stamina: 7, balance: 7 },
    size: 1.02, powerUps: ["power", "thick_blubber"], difficulty: "IMPOSSIBLE",
  },
  yokozuna: {
    name: "Hakuhō-tan, Grand Champion", archetype: "grappler",
    mawashiColor: "#D4AF37", bodyColor: "#161616",
    stats: { power: 9, moveSpeed: 8, resistance: 8, stamina: 8, balance: 9 },
    size: 1.05, powerUps: ["power", "thick_blubber", "speed"], difficulty: "IMPOSSIBLE",
  },
};

/*
 * Every distinct (mawashi, body) color pair used by the rival roster + the
 * division bosses. Consumed by the Settings "Install Sprite Pack" warmup so
 * those exact opponent looks are pre-recolored once and never re-loaded
 * mid-basho — including the bosses' custom palettes that aren't in the normal
 * color presets. De-duplicated by color pair.
 */
export function getRosterColorCombos() {
  const seen = new Set();
  const out = [];
  const add = (mawashiColor, bodyColor) => {
    if (!mawashiColor) return;
    const body = bodyColor || null;
    const key = `${mawashiColor}|${body}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ mawashiColor, bodyColor: body });
  };
  Object.values(RIKISHI).forEach((tier) =>
    tier.forEach((r) => add(r.mawashiColor, r.bodyColor))
  );
  Object.values(BOSSES).forEach((b) => add(b.mawashiColor, b.bodyColor));
  return out;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function divisionIndex(key) {
  return DIVISIONS.findIndex((d) => d.key === key);
}

/* Which roster pool a division draws its rank-and-file rivals from. */
function rosterTier(div) {
  const idx = divisionIndex(div.key);
  if (idx >= 6) return "elite"; // san'yaku + yokozuna
  if (idx >= 4) return "mid"; // juryo, maegashira
  return "lower"; // jonokuchi..makushita
}

/* True when this division crowns its basho with a final-day boss (Juryo+). */
function divisionHasBoss(div) {
  return divisionIndex(div.key) >= 4 && !!BOSSES[div.key];
}

// ============================================
// RUN CREATION
// ============================================

/**
 * Build a fresh run for the player's current career rank. Generates the
 * full opponent roster (names + colors) up front so it's stable across
 * save/resume; per-day records are filled in as days begin (they depend
 * on the evolving player record — §5.7).
 */
export function createRun(career) {
  const div = getDivision(career.rank);
  const totalBouts = div.bouts;
  const roster = shuffle(RIKISHI[rosterTier(div)]);
  const hasBoss = divisionHasBoss(div);

  // Base difficulty for this division (spec §5.5). The intra-basho ramp
  // (effectiveDifficulty) is applied per-bout at play time since it depends on
  // the evolving record; this is the stable baseline stored on the roster.
  const baseDifficulty = difficultyForDivision(div.key);

  const opponents = [];
  for (let i = 0; i < totalBouts; i++) {
    const isFinalDay = i === totalBouts - 1;
    if (isFinalDay && hasBoss) {
      // The division gatekeeper closes out the basho: signature colors, a
      // fighting style, and a real combat edge (stats/size/power-ups applied to
      // the CPU server-side). difficulty may exceed the division base.
      const b = BOSSES[div.key];
      opponents.push({
        name: b.name,
        mawashiColor: b.mawashiColor,
        bodyColor: b.bodyColor ?? null,
        difficulty: b.difficulty || baseDifficulty,
        archetype: b.archetype || "balanced",
        boss: true,
        stats: b.stats || null,
        size: b.size || null,
        powerUps: b.powerUps || [],
        record: null, // filled by startDay()
      });
    } else {
      const r = roster[i % roster.length];
      opponents.push({
        name: r.name,
        mawashiColor: r.mawashiColor,
        bodyColor: r.bodyColor ?? null,
        difficulty: baseDifficulty,
        archetype: r.archetype || "balanced",
        boss: false,
        record: null, // filled by startDay()
      });
    }
  }

  return {
    active: true,
    division: div.key,
    totalBouts,
    kk: div.kk,
    day: 1, // 1-indexed; the next bout to play
    record: { wins: 0, losses: 0 },
    results: [], // [{ day, won, winType }]
    opponents,
    startRank: { ...career.rank },
    // Stacking in-basho draft (§Phase 7). Accumulates one pick per bout; reset
    // every basho (lives on the run, never the career).
    draftedPowerUps: [],
    createdAt: Date.now(),
  };
}

/**
 * Returns true when every bout has been played.
 */
export function isRunComplete(run) {
  return run.day > run.totalBouts;
}

/**
 * The opponent for the current day, with a record close to the player's
 * (same number of prior bouts; wins within ±1 — §5.7). The generated
 * record is memoized onto the opponent so it stays stable if recomputed.
 */
export function startDay(run) {
  if (isRunComplete(run)) return run;
  const opp = run.opponents[run.day - 1];
  if (opp && !opp.record) {
    const played = run.day - 1;
    let ow = run.record.wins + (Math.floor(Math.random() * 3) - 1); // ±1
    ow = clamp(ow, 0, played);
    opp.record = { wins: ow, losses: played - ow };
  }
  return run;
}

/**
 * The current opponent object (name, colors, difficulty, record).
 */
export function currentOpponent(run) {
  return run.opponents[run.day - 1] || null;
}

/**
 * Record a bout outcome and advance to the next day. Returns a NEW run
 * object (does not mutate the input).
 */
export function recordBout(run, won, winType) {
  const next = {
    ...run,
    record: { ...run.record },
    results: [...run.results],
  };
  if (won) next.record.wins += 1;
  else next.record.losses += 1;
  next.results.push({ day: run.day, won: !!won, winType: winType || null });
  next.day = run.day + 1;
  return next;
}

// ============================================
// BANZUKE MOVEMENT (spec §5.6)
// ============================================

/**
 * Compute the rank change from a record. Works for both a completed basho
 * and a Fake-Injury withdrawal (just pass the record at the moment).
 *
 * Returns: { newRank, kachiKoshi, makeKoshi, yusho, promoted, demoted,
 *            divisionChanged, diff }.
 */
export function computeBanzukeMovement(startRank, record, totalBouts, kk) {
  const div = getDivision(startRank);
  const idx = divisionIndex(div.key);
  const diff = record.wins - record.losses;
  const winsNeeded = kk ?? div.kk ?? Math.ceil(totalBouts / 2);
  const kachiKoshi = record.wins >= winsNeeded;
  const makeKoshi = !kachiKoshi;
  // A perfect (zensho) or near-perfect record takes the championship.
  const yusho = record.losses === 0 && record.wins >= Math.ceil(totalBouts * 0.9);

  let newDivIdx = idx;
  let newNumber = div.numbered ? startRank.number ?? div.maxNumber : null;
  let promoted = false;
  let demoted = false;

  if (div.numbered) {
    // Lower number = higher rank. Winning record lowers the number.
    const step = Math.max(1, Math.round(div.maxNumber / div.bouts));
    newNumber = (startRank.number ?? div.maxNumber) - diff * step;

    if (newNumber < 1) {
      // Topped the division → promote into the bottom of the next one.
      const above = DIVISIONS[idx + 1];
      if (above) {
        newDivIdx = idx + 1;
        promoted = true;
        newNumber = above.numbered ? above.maxNumber : null;
      } else {
        newNumber = 1;
      }
    } else if (newNumber > div.maxNumber) {
      // Fell past the bottom → demote into the top of the one below.
      const below = DIVISIONS[idx - 1];
      if (below) {
        newDivIdx = idx - 1;
        demoted = true;
        newNumber = below.numbered ? 1 : null;
      } else {
        newNumber = div.maxNumber; // already the lowest division — clamp
      }
    }
  } else {
    // Titled ranks (Komusubi / Sekiwake / Ozeki / Yokozuna).
    // MVP gates — kadoban grace, two-yusho Yokozuna gate, etc. are §8/Phase 8.
    if (div.key === "yokozuna") {
      // Yokozuna never demotes.
      newDivIdx = idx;
    } else if (div.key === "ozeki") {
      if (yusho) {
        newDivIdx = idx + 1; // → Yokozuna (simplified; real gate = 2 consecutive yusho)
        promoted = true;
      } else if (makeKoshi) {
        newDivIdx = idx - 1; // → Sekiwake (simplified kadoban)
        demoted = true;
      }
    } else if (kachiKoshi) {
      const above = DIVISIONS[idx + 1];
      if (above) {
        newDivIdx = idx + 1;
        promoted = true;
      }
    } else {
      const below = DIVISIONS[idx - 1];
      if (below) {
        newDivIdx = idx - 1;
        demoted = true;
      }
    }
  }

  const newDiv = DIVISIONS[newDivIdx];
  const newRank = {
    division: newDiv.key,
    number: newDiv.numbered
      ? clamp(newNumber ?? newDiv.maxNumber, 1, newDiv.maxNumber)
      : null,
    title: newDiv.numbered ? null : newDiv.label,
    side: null,
  };

  return {
    newRank,
    kachiKoshi,
    makeKoshi,
    yusho,
    promoted,
    demoted,
    divisionChanged: newDivIdx !== idx,
    diff,
  };
}

/**
 * Movement for a completed run.
 */
export function runMovement(run) {
  return computeBanzukeMovement(run.startRank, run.record, run.totalBouts, run.kk);
}

/**
 * Fake Injury (kyūjō) — withdraw now and resolve on the current record
 * (spec §5.3). Returns the same movement shape as a completed run.
 */
export function fakeInjuryMovement(run) {
  return computeBanzukeMovement(run.startRank, run.record, run.totalBouts, run.kk);
}

// ============================================
// APPLY OUTCOME TO CAREER (persistent layer)
// ============================================

/**
 * Apply a finished (or withdrawn) run to the persistent career: new rank,
 * lifetime tallies, yusho count, the stat-point drip if a new personal-best
 * division was reached (spec §5.4), and the envelope (kenshō) purse earned
 * (spec §Phase 6). Returns { career, movement, drip, earned }. Does not
 * mutate the input career.
 */
export function applyRunResult(career, run) {
  const movement = runMovement(run);

  const idxNew = divisionIndex(movement.newRank.division);
  const idxBest = divisionIndex(career.bestDivisionReached || "jonokuchi");
  const reachedNewBest = idxNew > idxBest;

  // Stat drip, capped so total awarded never exceeds the career budget.
  const totalAwarded =
    (career.statPoints?.available || 0) +
    Object.values(career.statPoints?.spent || {}).reduce((a, b) => a + b, 0);
  const drip = reachedNewBest
    ? clamp(STAT_DRIP_PER_DIVISION, 0, MAX_STAT_BUDGET - totalAwarded)
    : 0;

  // Envelope purse: tier-scaled rewards for the basho's performance. Computed
  // off the division the run was FOUGHT in (startRank) so a single climb out
  // of a division doesn't retroactively pay the higher tier.
  const tier = rewardTierMultiplier(run.startRank);
  const earned = Math.round(
    (ENVELOPE_REWARDS.base +
      ENVELOPE_REWARDS.perWin * run.record.wins +
      (movement.kachiKoshi ? ENVELOPE_REWARDS.kachiKoshi : 0) +
      (movement.promoted ? ENVELOPE_REWARDS.promotion : 0) +
      (movement.yusho ? ENVELOPE_REWARDS.yusho : 0)) *
      tier,
  );

  // Per-line purse breakdown for the results-screen reveal ceremony. `tier`
  // is an integer (1/2/3), so each line × tier is exact and the lines sum to
  // `earned` with no rounding drift. Only meaningful lines are included.
  const breakdown = [
    { key: "base", label: "Completion", amount: ENVELOPE_REWARDS.base * tier },
  ];
  if (run.record.wins > 0) {
    breakdown.push({
      key: "wins",
      label: `Wins × ${run.record.wins}`,
      amount: ENVELOPE_REWARDS.perWin * run.record.wins * tier,
    });
  }
  if (movement.kachiKoshi) {
    breakdown.push({
      key: "kk",
      label: "Kachi-koshi",
      amount: ENVELOPE_REWARDS.kachiKoshi * tier,
    });
  }
  if (movement.promoted) {
    breakdown.push({
      key: "promo",
      label: "Promotion",
      amount: ENVELOPE_REWARDS.promotion * tier,
    });
  }
  if (movement.yusho) {
    breakdown.push({
      key: "yusho",
      label: "Yūshō",
      amount: ENVELOPE_REWARDS.yusho * tier,
    });
  }

  const newCareer = {
    ...career,
    rank: movement.newRank,
    bestDivisionReached: reachedNewBest
      ? movement.newRank.division
      : career.bestDivisionReached,
    envelopes: (career.envelopes || 0) + earned,
    statPoints: {
      ...career.statPoints,
      available: (career.statPoints?.available || 0) + drip,
    },
    lifetime: {
      ...career.lifetime,
      bashos: (career.lifetime?.bashos || 0) + 1,
      yusho: (career.lifetime?.yusho || 0) + (movement.yusho ? 1 : 0),
      boutsWon: (career.lifetime?.boutsWon || 0) + run.record.wins,
      boutsLost: (career.lifetime?.boutsLost || 0) + run.record.losses,
    },
  };

  return { career: newCareer, movement, drip, earned, breakdown, tier };
}
