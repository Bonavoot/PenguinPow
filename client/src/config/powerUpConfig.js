import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "../components/pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import flapIcon from "../assets/flap-icon.png";
import { C } from "../components/menuTheme";

export const POWER_UP_TYPE_COLORS = {
  speed: {
    main: "#00d2ff",
    deep: "#005f80",
    glow: "rgba(0, 210, 255, 0.45)",
  },
  power: {
    main: "#ff4444",
    deep: "#7a1c1c",
    glow: "rgba(255, 68, 68, 0.45)",
  },
  snowball: {
    main: "#74b9ff",
    deep: "#2a4a78",
    glow: "rgba(116, 185, 255, 0.45)",
  },
  pumo_army: {
    main: "#ffaa44",
    deep: "#8a5418",
    glow: "rgba(255, 170, 68, 0.45)",
  },
  thick_blubber: {
    main: "#aa77ff",
    deep: "#4a2c8a",
    glow: "rgba(170, 119, 255, 0.45)",
  },
  flap: {
    main: "#34e0c0",
    deep: "#15705f",
    glow: "rgba(52, 224, 192, 0.45)",
  },
};

const FALLBACK_TYPE_COLOR = {
  main: C.gold,
  deep: C.goldDeep,
  glow: "rgba(232, 197, 71, 0.45)",
};

export const POWER_UP_ICONS = {
  speed: happyFeetIcon,
  power: powerWaterIcon,
  snowball: snowballImage,
  pumo_army: pumoArmyIcon,
  thick_blubber: thickBlubberIcon,
  flap: flapIcon,
};

export const POWER_UP_LABELS = {
  speed: "Happy Feet",
  power: "Power Water",
  snowball: "Snowball",
  pumo_army: "Pumo Army",
  thick_blubber: "Thick Blubber",
  flap: "Flap",
};

export function getPowerUpTypeColor(type) {
  return POWER_UP_TYPE_COLORS[type] || FALLBACK_TYPE_COLOR;
}

export function getPowerUpIcon(type) {
  return POWER_UP_ICONS[type] || "";
}

export function getPowerUpLabel(type) {
  return POWER_UP_LABELS[type] || type;
}

/** Draft actives only — loadout actives like Flap are excluded. */
export const BASHO_DRAFT_ACTIVES = ["snowball", "pumo_army"];

export function isBashoDraftActive(type) {
  return BASHO_DRAFT_ACTIVES.includes(type);
}

/** Legacy saves may hold both actives; keep only the most recently picked. */
export function normalizeBashoDraftList(list = []) {
  const base = Array.isArray(list) ? list : [];
  let lastActive = null;
  for (const type of base) {
    if (isBashoDraftActive(type)) lastActive = type;
  }
  return base.filter(
    (type) => !isBashoDraftActive(type) || type === lastActive
  );
}

/** Stack a new pick; picking a different active replaces the previous one. */
export function applyBashoDraftPick(list = [], pickedType) {
  if (!pickedType) return normalizeBashoDraftList(list);
  const base = normalizeBashoDraftList(list);
  if (!isBashoDraftActive(pickedType)) return [...base, pickedType];
  const otherActives = BASHO_DRAFT_ACTIVES.filter((t) => t !== pickedType);
  return [...base.filter((t) => !otherActives.includes(t)), pickedType];
}

/** The single draft active currently owned, or null. */
export function getBashoActiveDraft(list = []) {
  const normalized = normalizeBashoDraftList(list);
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (isBashoDraftActive(normalized[i])) return normalized[i];
  }
  return null;
}

/** Snowball / Pumo Army only — for the stamina-bar power-up slot in BASHO HUD. */
export function toBashoHudActive(type) {
  return isBashoDraftActive(type) ? type : null;
}

/** Passives only — for the boon row beside the nameplate. */
export function getBashoPassiveDraft(list = []) {
  return normalizeBashoDraftList(list).filter((t) => !isBashoDraftActive(t));
}

/** First-pick order, one entry per unique type with stack count. */
export function groupDraftedPowerUps(list = []) {
  const order = [];
  const counts = {};

  for (const type of list) {
    if (!type) continue;
    if (!counts[type]) {
      order.push(type);
      counts[type] = 0;
    }
    counts[type] += 1;
  }

  return order.map((type) => ({ type, count: counts[type] }));
}
