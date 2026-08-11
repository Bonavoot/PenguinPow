export const DOHYO_STORAGE_KEY = "penguin-pow-dohyo-overlay";
export const DOHYO_VERSION_KEY = "penguin-pow-dohyo-overlay-version";
export const DOHYO_CHANGED_EVENT = "penguin-pow-dohyo-changed";
export const CURRENT_DOHYO_VERSION = 4;

// Baked dohyo overlay knobs — exported from the crowd editor (` key → Dohyo tab).
// DO NOT manually edit. Use the editor, then EXPORT and replace this object.
const DOHYO_OVERLAY = {
  "sizeW": 100.3,
  "sizeH": 109.2,
  "posX": 49.4,
  "posY": 69.9,
  "originX": 50,
  "originY": 105.7,
  "perspective": 295.9,
  "rotateX": 8.9,
  "scaleY": 0.85,
  "translateY": -1.8,
  "shadowTop": 58,
  "shadowWidth": 82,
  "shadowHeight": 34,
  "shadowBlur": 14,
  "shadowOpacity0": 0.48,
  "shadowOpacity1": 0.22
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeDohyo(raw) {
  const base = { ...DOHYO_OVERLAY, ...(raw || {}) };
  return {
    sizeW: clamp(num(base.sizeW, DOHYO_OVERLAY.sizeW), 20, 120),
    sizeH: clamp(num(base.sizeH, DOHYO_OVERLAY.sizeH), 20, 120),
    posX: num(base.posX, DOHYO_OVERLAY.posX),
    posY: num(base.posY, DOHYO_OVERLAY.posY),
    originX: num(base.originX, DOHYO_OVERLAY.originX),
    originY: num(base.originY, DOHYO_OVERLAY.originY),
    perspective: clamp(num(base.perspective, DOHYO_OVERLAY.perspective), 80, 2000),
    rotateX: clamp(num(base.rotateX, DOHYO_OVERLAY.rotateX), -30, 45),
    scaleY: clamp(num(base.scaleY, DOHYO_OVERLAY.scaleY), 0.35, 1.5),
    translateY: clamp(num(base.translateY, DOHYO_OVERLAY.translateY), -40, 40),
    shadowTop: clamp(num(base.shadowTop, DOHYO_OVERLAY.shadowTop), 0, 100),
    shadowWidth: clamp(num(base.shadowWidth, DOHYO_OVERLAY.shadowWidth), 10, 120),
    shadowHeight: clamp(num(base.shadowHeight, DOHYO_OVERLAY.shadowHeight), 5, 80),
    shadowBlur: clamp(num(base.shadowBlur, DOHYO_OVERLAY.shadowBlur), 0, 60),
    shadowOpacity0: clamp(num(base.shadowOpacity0, DOHYO_OVERLAY.shadowOpacity0), 0, 1),
    shadowOpacity1: clamp(num(base.shadowOpacity1, DOHYO_OVERLAY.shadowOpacity1), 0, 1),
  };
}

export function loadDohyoOverlay() {
  try {
    const version = parseInt(localStorage.getItem(DOHYO_VERSION_KEY) || "0", 10);
    if (version < CURRENT_DOHYO_VERSION) {
      localStorage.removeItem(DOHYO_STORAGE_KEY);
      localStorage.setItem(DOHYO_VERSION_KEY, String(CURRENT_DOHYO_VERSION));
      return normalizeDohyo(DOHYO_OVERLAY);
    }
    const raw = localStorage.getItem(DOHYO_STORAGE_KEY);
    if (raw) return normalizeDohyo(JSON.parse(raw));
  } catch { /* defaults */ }
  return normalizeDohyo(DOHYO_OVERLAY);
}

export function applyDohyoOverlayVars(el, data) {
  if (!el) return;
  const d = normalizeDohyo(data);
  const set = (k, v) => el.style.setProperty(k, v);
  set("--dohyo-size-w", `${d.sizeW}%`);
  set("--dohyo-size-h", `${d.sizeH}%`);
  set("--dohyo-pos-x", `${d.posX}%`);
  set("--dohyo-pos-y", `${d.posY}%`);
  set("--dohyo-origin-x", `${d.originX}%`);
  set("--dohyo-origin-y", `${d.originY}%`);
  set("--dohyo-perspective", `${d.perspective}px`);
  set("--dohyo-rotate-x", `${d.rotateX}deg`);
  set("--dohyo-scale-y", String(d.scaleY));
  set("--dohyo-translate-y", `${d.translateY}%`);
  set("--dohyo-shadow-top", `${d.shadowTop}%`);
  set("--dohyo-shadow-width", `${d.shadowWidth}%`);
  set("--dohyo-shadow-height", `${d.shadowHeight}%`);
  set("--dohyo-shadow-blur", `${d.shadowBlur}px`);
  set("--dohyo-shadow-opacity-0", String(d.shadowOpacity0));
  set("--dohyo-shadow-opacity-1", String(d.shadowOpacity1));
}

export { DOHYO_OVERLAY };
export default DOHYO_OVERLAY;
