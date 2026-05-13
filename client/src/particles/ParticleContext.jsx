import { createContext, useContext, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { ParticleEngine } from "./ParticleEngine";
import { usePlayerColors } from "../context/PlayerColorContext";

const ParticleCtx = createContext(null);

// Special mawashi patterns can't be a single hex (rainbow scrolls hues,
// camo is multi-color, etc.) so we map each one to a representative
// solid color for the halo. Picked to FEEL like the pattern at a glance
// when seen as a single ring — vibrant, distinct from the standard
// preset palette, and clearly readable on the blue dohyo.
const SPECIAL_COLOR_RGB = {
  rainbow:   [255,  64, 200], // hot magenta — instantly reads as "rainbow player"
  fire:      [255, 107,  53], // fiery orange — middle of the fire gradient
  vaporwave: [255, 105, 180], // hot pink — top of the vaporwave gradient
  camo:      [120, 150,  60], // olive/sage — average of camo greens
  galaxy:    [153,  50, 204], // dark orchid — galaxy purple
  gold:      [255, 200,  40], // saturated gold — punches against blue dohyo
};

// Parse a player color spec into [r, g, b]. Accepts:
//   • "#rrggbb" / "#rgb" hex
//   • "rgb(r, g, b)" / "rgba(r, g, b, a)"
//   • Special pattern names ("rainbow", "fire", "vaporwave", "camo",
//     "galaxy", "gold") — mapped via SPECIAL_COLOR_RGB above so these
//     belts still produce a halo (otherwise parsing would fail and the
//     player would lose their identity marker).
// Returns null on unrecognized input.
function parseColorToRgb(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (SPECIAL_COLOR_RGB[trimmed]) return SPECIAL_COLOR_RGB[trimmed];
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].every(Number.isFinite)) return [r, g, b];
      return null;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every(Number.isFinite)) return [r, g, b];
      return null;
    }
    return null;
  }
  const rgbMatch = trimmed.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  return null;
}

export function ParticleProvider({ children }) {
  const canvasRef = useRef(null);
  const canvasBehindRef = useRef(null);
  const canvasFrontRef = useRef(null);
  const engineRef = useRef(null);
  // Bumped when the engine finishes init, so the color-bake effect below
  // re-runs even if colors haven't changed since first render.
  const [engineReadyTick, setEngineReadyTick] = useState(0);

  // Read player colors from the PlayerColorProvider above us in the tree.
  // Safe because App.jsx mounts PlayerColorProvider as an ancestor.
  const { player1Color, player2Color } = usePlayerColors();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine();
    engine.init(canvas);
    if (canvasBehindRef.current) {
      engine.initBehind(canvasBehindRef.current);
    }
    if (canvasFrontRef.current) {
      engine.initFront(canvasFrontRef.current);
    }
    engineRef.current = engine;
    setEngineReadyTick((n) => n + 1);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Bake per-player accent textures (halo ring + trail puff) whenever the
  // engine becomes ready or a player color changes. This keeps the colored
  // textures used by localPlayerHalo / sidestepStart / sidestepTrail in
  // sync with the active mawashi colors.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const accents = {};
    const p1Rgb = parseColorToRgb(player1Color);
    const p2Rgb = parseColorToRgb(player2Color);
    if (p1Rgb) accents.player1 = { rgb: p1Rgb };
    if (p2Rgb) accents.player2 = { rgb: p2Rgb };
    if (Object.keys(accents).length > 0) {
      engine.setAccentTextures(accents);
    }
  }, [player1Color, player2Color, engineReadyTick]);

  const emit = useCallback((preset, opts) => {
    engineRef.current?.emit(preset, opts);
  }, []);

  const setFrozen = useCallback((frozen) => {
    if (engineRef.current) engineRef.current.frozen = frozen;
  }, []);

  // Bake per-player accent textures (halo ring + trail puff) tinted to
  // the player's mawashi color. Called by PlayerColorContext whenever
  // colors are applied so localPlayerHalo / sidestepTrail / sidestepStart
  // can render in the correct color.
  // accents = { player1: { rgb: [r,g,b] }, player2: { rgb: [r,g,b] } }
  const setAccent = useCallback((accents) => {
    engineRef.current?.setAccentTextures(accents);
  }, []);

  const clearRawParryBlueHold = useCallback(() => {
    engineRef.current?.clearRawParryBlueHoldParticles();
  }, []);

  const value = useMemo(
    () => ({ emit, setFrozen, setAccent, clearRawParryBlueHold }),
    [emit, setFrozen, setAccent, clearRawParryBlueHold]
  );

  return (
    <ParticleCtx.Provider value={value}>
      <canvas
        ref={canvasBehindRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
      <canvas
        ref={canvasFrontRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 102,
        }}
      />
    </ParticleCtx.Provider>
  );
}

const noopCtx = {
  emit: () => {},
  setFrozen: () => {},
  setAccent: () => {},
  clearRawParryBlueHold: () => {},
};

export function useParticles() {
  return useContext(ParticleCtx) || noopCtx;
}
