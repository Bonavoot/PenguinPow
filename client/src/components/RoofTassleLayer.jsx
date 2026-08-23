import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import RoofTassleEditor, {
  TASSLE_STORAGE_KEY,
  TASSLE_COLORS,
  TASSLES_CHANGED_EVENT,
} from "./RoofTassleEditor";
import ROOF_TASSLE_POSITIONS from "./roofTasslePositionsData";
import ROOF_APRON_POSITION, {
  APRON_SRC,
  APRON_STORAGE_KEY,
  APRON_VERSION_KEY,
  APRON_CHANGED_EVENT,
  CURRENT_APRON_VERSION,
  normalizeApron,
} from "./roofApronData";

const TASSLE_VERSION_KEY = "penguin-pow-roof-tassle-version";
const CURRENT_TASSLE_VERSION = 7;

/* Light arena grade — shaded 3d tassles already carry volume; don't crush it. */
const TASSLE_FILTER =
  "brightness(0.92) saturate(0.96) drop-shadow(0 5px 7px rgba(0,0,0,0.45))";
/* No color grade — prior brightness/saturate crushed the purple and fought the art. */
const APRON_FILTER = "drop-shadow(0 4px 6px rgba(0,0,0,0.45))";

/* Apron always stacks above every tassle.
   front/back only orders tassles among themselves (+ opacity). */
const TASSLE_Z_BACK = 40;
const TASSLE_Z_FRONT = 80;
const APRON_Z = 200;
/* Keep size-based tiebreak from ever reaching the apron. */
const TASSLE_Z_SIZE_CAP = 19;

const RoofPropsLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Above dohyo (z:1), below arena-lighting (z:6) */
  z-index: 3;
  contain: layout style paint;
`;

const PropImg = styled.img`
  position: absolute;
  left: ${(p) => p.$x}%;
  bottom: ${(p) => p.$y}%;
  width: ${(p) => p.$size}%;
  height: auto;
  transform-origin: 50% 0%;
  transform: translateX(-50%)
    ${(p) => (p.$flip ? "scaleX(-1)" : "")}
    ${(p) => (p.$squash != null && p.$squash !== 1 ? `scaleY(${p.$squash})` : "")};
  z-index: ${(p) => p.$z};
  filter: ${(p) => p.$filter || TASSLE_FILTER};
  opacity: ${(p) => p.$opacity ?? 1};
  image-rendering: auto;
  user-select: none;
  pointer-events: none;
`;

function isFrontTassle(tassle) {
  return tassle.depth === "front" || (!tassle.depth && tassle.size >= 7);
}

function tassleZ(tassle) {
  const base = isFrontTassle(tassle) ? TASSLE_Z_FRONT : TASSLE_Z_BACK;
  return base + Math.min(TASSLE_Z_SIZE_CAP, Math.floor(tassle.size));
}

function loadTasslePositions() {
  try {
    const version = parseInt(localStorage.getItem(TASSLE_VERSION_KEY) || "0", 10);
    if (version < CURRENT_TASSLE_VERSION) {
      localStorage.removeItem(TASSLE_STORAGE_KEY);
      localStorage.setItem(TASSLE_VERSION_KEY, String(CURRENT_TASSLE_VERSION));
      return ROOF_TASSLE_POSITIONS.map((p) => ({ ...p }));
    }

    const raw = localStorage.getItem(TASSLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* fall through */
  }
  return ROOF_TASSLE_POSITIONS.map((p) => ({ ...p }));
}

function loadApronPosition() {
  try {
    const version = parseInt(localStorage.getItem(APRON_VERSION_KEY) || "0", 10);
    if (version < CURRENT_APRON_VERSION) {
      localStorage.removeItem(APRON_STORAGE_KEY);
      localStorage.setItem(APRON_VERSION_KEY, String(CURRENT_APRON_VERSION));
      return normalizeApron(ROOF_APRON_POSITION);
    }

    const raw = localStorage.getItem(APRON_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.x === "number") return normalizeApron(parsed);
    }
  } catch {
    /* fall through */
  }
  return normalizeApron(ROOF_APRON_POSITION);
}

Object.values(TASSLE_COLORS).forEach((c) => {
  const img = new Image();
  img.src = c.src;
});
{
  const img = new Image();
  img.src = APRON_SRC;
}

const isTassleEditorToggle = (e) =>
  e.key === "~" || (e.code === "Backquote" && e.shiftKey);

const RoofTassleLayer = () => {
  const [positions, setPositions] = useState(loadTasslePositions);
  const [apron, setApron] = useState(loadApronPosition);
  const [editorMode, setEditorMode] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (!isTassleEditorToggle(e)) return;
      e.preventDefault();
      setEditorMode((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const reloadTassles = () => setPositions(loadTasslePositions());
    const reloadApron = () => setApron(loadApronPosition());
    window.addEventListener(TASSLES_CHANGED_EVENT, reloadTassles);
    window.addEventListener(APRON_CHANGED_EVENT, reloadApron);
    return () => {
      window.removeEventListener(TASSLES_CHANGED_EVENT, reloadTassles);
      window.removeEventListener(APRON_CHANGED_EVENT, reloadApron);
    };
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorMode(false);
    setPositions(loadTasslePositions());
    setApron(loadApronPosition());
  }, []);

  const backTassles = positions.filter((t) => !isFrontTassle(t));
  const frontTassles = positions.filter((t) => isFrontTassle(t));

  const renderTassle = (tassle) => {
    const colorDef = TASSLE_COLORS[tassle.color] || TASSLE_COLORS.white;
    const front = isFrontTassle(tassle);
    return (
      <PropImg
        key={tassle.id}
        src={colorDef.src}
        $x={tassle.x}
        $y={tassle.y}
        $size={tassle.size}
        $flip={!!tassle.flip}
        $z={tassleZ(tassle)}
        $opacity={front ? 1 : 0.7}
        $filter={TASSLE_FILTER}
        alt=""
        draggable={false}
      />
    );
  };

  return (
    <>
      <RoofPropsLayer className="roof-props-layer" aria-hidden="true">
        {backTassles.map(renderTassle)}
        {frontTassles.map(renderTassle)}
        <PropImg
          src={APRON_SRC}
          $x={apron.x}
          $y={apron.y}
          $size={apron.size}
          $squash={apron.squash}
          $flip={!!apron.flip}
          $z={APRON_Z}
          $opacity={1}
          $filter={APRON_FILTER}
          alt=""
          draggable={false}
        />
      </RoofPropsLayer>
      {editorMode && (
        <RoofTassleEditor positions={positions} onClose={handleEditorClose} />
      )}
    </>
  );
};

export default RoofTassleLayer;
