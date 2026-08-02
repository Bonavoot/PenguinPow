export const VIEWPORT_PRESETS = {
  "1280x720": { width: 1280, height: 720, label: "HD / 16:9" },
  "1920x1080": { width: 1920, height: 1080, label: "Full HD / 16:9" },
  "2560x1440": { width: 2560, height: 1440, label: "QHD / 16:9" },
  "1280x800": { width: 1280, height: 800, label: "Steam Deck / 16:10" },
};

const baseFighter = {
  stamina: 100,
  posture: 100,
  gassed: false,
  recovering: false,
  postureBroken: false,
  deepGrip: null,
  shove: null,
  powerUp: null,
  cooldown: false,
  charges: null,
  boons: [],
};

const pair = (left = {}, right = {}) => ({
  left: { ...baseFighter, ...left },
  right: { ...baseFighter, ...right },
});

export const HUD_FIXTURES = {
  neutral: {
    label: "Neutral",
    day: 6,
    score: [1, 0],
    fighters: pair(),
  },
  damaged: {
    label: "Damaged + ghost damage",
    day: 6,
    score: [1, 1],
    fighters: pair(
      { stamina: 68, ghostStamina: 84, posture: 74 },
      { stamina: 49, ghostStamina: 67, posture: 58 },
    ),
  },
  danger: {
    label: "Stamina danger",
    day: 7,
    score: [1, 1],
    fighters: pair(
      { stamina: 18, ghostStamina: 33, posture: 42 },
      { stamina: 31, posture: 64 },
    ),
  },
  gassed: {
    label: "Gassed",
    day: 7,
    score: [1, 1],
    fighters: pair(
      { stamina: 0, posture: 38, gassed: true },
      { stamina: 54, posture: 62 },
    ),
  },
  recovering: {
    label: "Second wind",
    day: 7,
    score: [1, 1],
    fighters: pair(
      { stamina: 42, posture: 43, recovering: true },
      { stamina: 61, posture: 72 },
    ),
  },
  postureDanger: {
    label: "Posture danger",
    day: 8,
    score: [1, 0],
    fighters: pair(
      { stamina: 66, posture: 12 },
      { stamina: 71, posture: 31 },
    ),
  },
  postureBroken: {
    label: "Posture broken",
    day: 8,
    score: [1, 0],
    fighters: pair(
      { stamina: 61, posture: 0, postureBroken: true },
      { stamina: 73, posture: 54 },
    ),
  },
  deepGrip: {
    label: "Deep Grip ownership",
    day: 9,
    score: [1, 1],
    fighters: pair(
      { stamina: 52, posture: 48, deepGrip: "hold" },
      { stamina: 57, posture: 34, deepGrip: "threat" },
    ),
  },
  clinchShove: {
    label: "Clinch shove",
    day: 9,
    score: [1, 1],
    fighters: pair(
      { stamina: 46, posture: 41, shove: "PUSH" },
      { stamina: 43, posture: 37, shove: "BACK" },
    ),
  },
  activePowerUp: {
    label: "Active power-up",
    day: 10,
    score: [1, 0],
    fighters: pair(
      { stamina: 79, posture: 83, powerUp: "speed" },
      { stamina: 82, posture: 77, powerUp: "power" },
    ),
  },
  cooldown: {
    label: "Cooldown + charges",
    day: 10,
    score: [1, 0],
    fighters: pair(
      {
        stamina: 73,
        posture: 65,
        powerUp: "snowball",
        cooldown: true,
        charges: 2,
      },
      {
        stamina: 86,
        posture: 74,
        powerUp: "pumo_army",
        cooldown: false,
        charges: 1,
      },
    ),
  },
  basho: {
    label: "BASHO day + boons",
    day: 12,
    score: [1, 1],
    basho: true,
    fighters: pair(
      {
        stamina: 72,
        posture: 61,
        powerUp: "shatter_palm",
        boons: ["BLUBBER ×2", "FLAP"],
      },
      {
        stamina: 64,
        posture: 48,
        powerUp: "snowball",
        charges: 3,
        boons: ["HAPPY FEET", "POWER WATER"],
      },
    ),
  },
  bashoMaximum: {
    label: "Maximum representative BASHO density",
    day: 12,
    score: [1, 1],
    basho: true,
    fighters: pair(
      {
        stamina: 58,
        posture: 46,
        powerUp: "pumo_army",
        charges: 3,
        boons: ["FEET ×2", "WATER", "BLUBBER ×3", "FLAP", "PALM ×2"],
      },
      {
        stamina: 64,
        posture: 39,
        powerUp: "snowball",
        cooldown: true,
        charges: 2,
        boons: ["FEET", "WATER ×2", "BLUBBER", "FLAP ×2", "PALM"],
      },
    ),
  },
  matchOver: {
    label: "Match over",
    day: 12,
    score: [2, 1],
    matchOver: true,
    fighters: pair(
      { stamina: 37, posture: 52, powerUp: "speed" },
      { stamina: 0, posture: 0, gassed: true, postureBroken: true },
    ),
  },
};

export const EVENT_FIXTURES = {
  none: { label: "No callout", tier: 0 },
  counterHit: {
    label: "COUNTER HIT",
    tier: 1,
    priority: "info",
    family: "recognition",
    cue: "startup caught",
  },
  punish: {
    label: "PUNISH",
    tier: 1,
    priority: "info",
    family: "recognition",
    cue: "recovery caught",
  },
  resisted: {
    label: "RESISTED",
    tier: 1,
    priority: "info",
    family: "technical",
    cue: "technique stopped",
  },
  grabBreak: {
    label: "GRAB BREAK",
    tier: 1,
    priority: "info",
    family: "technical",
    cue: "clinch released",
  },
  counterThrow: {
    label: "COUNTER THROW",
    tier: 1,
    priority: "info",
    family: "control",
    cue: "push reversed",
  },
  deepGrip: {
    label: "DEEP GRIP",
    tier: 1,
    priority: "info",
    family: "control",
    cue: "advantage secured",
  },
  counterGrab: {
    label: "COUNTER GRAB",
    tier: 1,
    priority: "info",
    family: "control",
    cue: "arm clamped",
  },
  grabTech: {
    label: "GRAB TECH",
    tier: 1,
    priority: "info",
    family: "technical",
    cue: "throw escaped",
  },
  clamped: {
    label: "CLAMPED",
    tier: 1,
    priority: "action",
    family: "warning",
    cue: "PLANT STILL AVAILABLE",
  },
  noStamina: {
    label: "NOT ENOUGH STAMINA",
    tier: 1,
    priority: "action",
    family: "warning",
    cue: "ACTION BLOCKED · RECOVER",
  },
  perfect: {
    label: "PERFECT",
    tier: 2,
    priority: "mastery",
    family: "mastery",
    cue: "perfect parry",
  },
  perfectBrace: {
    label: "PERFECT BRACE",
    tier: 2,
    priority: "mastery",
    family: "mastery",
    cue: "timed plant",
  },
  matador: {
    label: "MATADOR",
    tier: 2,
    priority: "mastery",
    family: "mastery",
    scale: "compact",
    cue: "grab line turned",
  },
  matadorBreak: {
    label: "MATADOR BREAK",
    tier: 2,
    priority: "mastery",
    family: "mastery",
    scale: "compact",
    cue: "read punished",
  },
};

export const MOMENT_FIXTURES = {
  fight: { label: "Live fight" },
  handsDown: { label: "HANDS DOWN" },
  hakkiYoi: { label: "HAKKI-YOI" },
  resultForce: {
    label: "FORCE OUT",
    result: "FORCE OUT",
    japanese: "寄り切り",
  },
  resultThrow: {
    label: "OVERARM THROW",
    result: "OVERARM THROW",
    japanese: "上手投げ",
  },
  resultLong: {
    label: "REAR PUSH OUT",
    result: "REAR PUSH OUT",
    japanese: "送り出し",
  },
  victory: { label: "Victory treatment" },
  defeat: { label: "Defeat treatment" },
  preMatch: { label: "PreMatch" },
  dayCard: { label: "Dark BASHO Day" },
  matchOver: { label: "MatchOver" },
  eventSheet: { label: "Combat event system sheet" },
  calloutScale: { label: "Ordinary ↔ mastery scale" },
};

export const RAPID_EVENT_KEYS = [
  "counterHit",
  "punish",
  "grabBreak",
  "perfect",
  "counterThrow",
  "matadorBreak",
];

export const POWER_UP_LABELS = {
  speed: "HAPPY FEET",
  power: "POWER WATER",
  snowball: "SNOWBALL",
  pumo_army: "PUMO ARMY",
  shatter_palm: "SHATTER PALM",
};
