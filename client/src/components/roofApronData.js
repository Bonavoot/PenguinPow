import apronSrc from "../assets/roof-apron.png";

export const APRON_SRC = apronSrc;
export const APRON_STORAGE_KEY = "penguin-pow-roof-apron-position";
export const APRON_VERSION_KEY = "penguin-pow-roof-apron-version";
export const APRON_CHANGED_EVENT = "penguin-pow-apron-changed";
export const CURRENT_APRON_VERSION = 4;

// Baked roof-apron placement — exported from the crowd editor (` key).
// DO NOT manually edit. Use the editor, then EXPORT and replace this object.
const ROOF_APRON_POSITION = {
  "x": 49.73617060432087,
  "y": 85.76324038937472,
  "size": 82,
  "squash": 0.78,
  "flip": false
};

export function normalizeApron(raw) {
  const base = { ...ROOF_APRON_POSITION, ...(raw || {}) };
  return {
    x: Number(base.x) || 50,
    y: Number(base.y) || 54,
    size: Math.max(5, Math.min(100, Number(base.size) || 54)),
    squash: Math.max(0.25, Math.min(1.5, Number(base.squash) || 1)),
    flip: !!base.flip,
  };
}

export default ROOF_APRON_POSITION;
