import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import gameMapBg from "../assets/game-map-444.webp";
import dohyoStyleBg from "../assets/dohyo-style.webp";
import {
  TASSLE_STORAGE_KEY,
  TASSLE_COLORS,
  TASSLE_COLOR_ORDER,
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
import DOHYO_OVERLAY, {
  DOHYO_STORAGE_KEY,
  DOHYO_VERSION_KEY,
  DOHYO_CHANGED_EVENT,
  CURRENT_DOHYO_VERSION,
  normalizeDohyo,
  loadDohyoOverlay,
  applyDohyoOverlayVars,
} from "./dohyoOverlayData";
import { EDITOR_CAMERA_PRESETS } from "../hooks/useCamera";

const CROWD_STORAGE_KEY = "penguin-pow-crowd-positions";
const EDITOR_TAB_CROWD = "crowd";
const EDITOR_TAB_DOHYO = "dohyo";
// Same logical stage as .app-container — keeps perspective(px) matching in-game.
const STAGE_W = 1280;
const STAGE_H = 720;

/** Editor-only live 3D dohyo (was App.css .dohyo-overlay--live). */
const LiveDohyoOverlay = styled.div.attrs({ className: "dohyo-overlay" })`
  background-image: url(${dohyoStyleBg});
  background-size: var(--dohyo-size-w, 90%) var(--dohyo-size-h, 80%);
  background-position: var(--dohyo-pos-x, 50%) var(--dohyo-pos-y, 25%);
  transform-origin: var(--dohyo-origin-x, 48%) var(--dohyo-origin-y, 108%);
  transform: perspective(var(--dohyo-perspective, 380px))
    rotateX(var(--dohyo-rotate-x, 5deg))
    scaleY(var(--dohyo-scale-y, 0.85))
    translateY(var(--dohyo-translate-y, 7%));
`;

const CAMERA_PRESET_ORDER = ["ready", "prematch", "fightWide", "flat"];
const CAMERA_PRESET_LABELS = {
  ready: "Ready (match)",
  prematch: "Prematch",
  fightWide: "Fight wide",
  flat: "Flat 1:1",
};

/** Slider + number field for the Dohyo panel (step 0.1 by default). */
function DohyoSlider({ label, value, min, max, step = 0.1, onChange, onGestureStart, onGestureEnd }) {
  const decimals = (() => {
    const s = String(step);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
  })();
  const format = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? String(Number(n.toFixed(decimals))) : "";
  };
  const n = Number(value);
  const rangeVal = Number.isFinite(n) ? n : min;
  // Local draft while typing/spinning — avoids controlled type=number runaway
  // (re-render mid-hold drops mouseup and the browser keeps stepping).
  const [draft, setDraft] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [value, focused, decimals]);

  const commitDraft = () => {
    const next = Number(draft);
    if (Number.isFinite(next)) onChange(next);
    else setDraft(format(value));
    onGestureEnd?.();
    setFocused(false);
  };

  const stop = (e) => e.stopPropagation();
  const begin = (e) => {
    stop(e);
    onGestureStart?.();
  };
  const end = () => onGestureEnd?.();

  const stepBy = (dir) => {
    onGestureStart?.();
    const base = Number.isFinite(Number(draft)) ? Number(draft) : rangeVal;
    const next = Math.max(min, Math.min(max, Number((base + dir * step).toFixed(decimals))));
    setDraft(String(next));
    onChange(next);
    onGestureEnd?.();
  };

  return (
    <label
      style={{ display: "block", marginBottom: 8, lineHeight: 1.3 }}
      onMouseDown={stop}
      onPointerDown={stop}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
        <span style={{ color: "#9ab", flex: 1 }}>{label}</span>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={stop}
          onClick={(e) => { e.preventDefault(); stepBy(-1); }}
          style={{
            width: 22,
            height: 22,
            padding: 0,
            background: "#1a1a28",
            color: "#8af",
            border: "1px solid #333",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: "20px",
          }}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={focused ? draft : format(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          onFocus={() => {
            setFocused(true);
            setDraft(format(value));
            onGestureStart?.();
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            stop(e);
            if (e.key === "Enter") {
              e.target.blur();
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              stepBy(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              stepBy(-1);
            }
          }}
          style={{
            width: 56,
            background: "#12121c",
            color: "#ff0",
            border: "1px solid #333",
            borderRadius: 3,
            fontFamily: "monospace",
            fontSize: 11,
            padding: "2px 4px",
            textAlign: "right",
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={stop}
          onClick={(e) => { e.preventDefault(); stepBy(1); }}
          style={{
            width: 22,
            height: 22,
            padding: 0,
            background: "#1a1a28",
            color: "#8af",
            border: "1px solid #333",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: "20px",
          }}
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeVal}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseDown={begin}
        onPointerDown={begin}
        onMouseUp={end}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ width: "100%", accentColor: "#6af", marginTop: 2 }}
      />
    </label>
  );
}
const TASSLE_VERSION_KEY = "penguin-pow-roof-tassle-version";
const CURRENT_TASSLE_VERSION = 7;
/* Apron always above every tassle. front/back only orders tassles + opacity. */
const TASSLE_Z_BACK_EDITOR = 5000;
const TASSLE_Z_FRONT_EDITOR = 6000;
const TASSLE_Z_SIZE_CAP_EDITOR = 99;
const APRON_Z_EDITOR = 9000;

function isFrontTassle(t) {
  return t.depth === "front" || (!t.depth && t.size >= 7);
}

function tassleZEditor(tassle, selected) {
  if (selected) return APRON_Z_EDITOR - 1;
  const base = isFrontTassle(tassle) ? TASSLE_Z_FRONT_EDITOR : TASSLE_Z_BACK_EDITOR;
  return base + Math.min(TASSLE_Z_SIZE_CAP_EDITOR, Math.floor(tassle.size));
}

// Matches CrowdLayer: crowd is always full opacity (no size-based fade).
const computeCrowdOpacity = () => 1;

function loadTasslePositionsForEditor() {
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((p) => ({ ...p }));
    }
  } catch {
    /* defaults */
  }
  return ROOF_TASSLE_POSITIONS.map((p) => ({ ...p }));
}

function loadApronForEditor() {
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
    /* defaults */
  }
  return normalizeApron(ROOF_APRON_POSITION);
}

const CrowdEditor = ({ positions, crowdTypes, onClose }) => {
  const [editorTab, setEditorTab] = useState(EDITOR_TAB_CROWD);
  const [editorPositions, setEditorPositions] = useState(
    () => positions.map(p => ({ ...p }))
  );
  const [tasslePositions, setTasslePositions] = useState(loadTasslePositionsForEditor);
  const [apronPosition, setApronPosition] = useState(loadApronForEditor);
  const [dohyoOverlay, setDohyoOverlay] = useState(loadDohyoOverlay);
  // Dohyo tab: show locked crowd under the plate (or hide for a clean map+dohyo view)
  const [showCrowdInDohyoTab, setShowCrowdInDohyoTab] = useState(true);
  // Match live useCamera framing so edits preview as in-game (default = ready stance)
  const [dohyoCameraPreset, setDohyoCameraPreset] = useState("ready");
  const dohyoCameraPresetRef = useRef(dohyoCameraPreset);
  // { kind: 'crowd'|'tassle'|'apron'|'dohyo', id? }
  const [selection, setSelection] = useState(null);
  // Hold Alt to click through the apron onto tassles underneath
  const [apronClickThrough, setApronClickThrough] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [stageFit, setStageFit] = useState(1);
  const viewportRef = useRef(null);
  const containerRef = useRef(null); // 1280×720 logical stage
  const positionsRef = useRef(editorPositions);
  const tasslesRef = useRef(tasslePositions);
  const apronRef = useRef(apronPosition);
  const dohyoRef = useRef(dohyoOverlay);
  const editorTabRef = useRef(editorTab);
  // Dohyo undo/redo — one entry per gesture (slider drag / plate drag / key nudge)
  const dohyoUndoRef = useRef([]);
  const dohyoRedoRef = useRef([]);
  const dohyoGestureRef = useRef(false);

  useEffect(() => {
    positionsRef.current = editorPositions;
  }, [editorPositions]);

  useEffect(() => {
    tasslesRef.current = tasslePositions;
  }, [tasslePositions]);

  useEffect(() => {
    apronRef.current = apronPosition;
  }, [apronPosition]);

  useEffect(() => {
    dohyoRef.current = dohyoOverlay;
  }, [dohyoOverlay]);

  useEffect(() => {
    editorTabRef.current = editorTab;
  }, [editorTab]);

  useEffect(() => {
    dohyoCameraPresetRef.current = dohyoCameraPreset;
  }, [dohyoCameraPreset]);

  // Fit the 1280×720 stage into the preview viewport (like --app-zoom in-game).
  // perspective() is absolute CSS px — without a fixed stage it foreshortens
  // differently than the live 1280-wide game container.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setStageFit(w / STAGE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pushDohyoHistory = useCallback((snapshot) => {
    dohyoUndoRef.current.push(normalizeDohyo(snapshot));
    if (dohyoUndoRef.current.length > 80) dohyoUndoRef.current.shift();
    dohyoRedoRef.current = [];
  }, []);

  const beginDohyoGesture = useCallback(() => {
    if (dohyoGestureRef.current) return;
    dohyoGestureRef.current = true;
    pushDohyoHistory(dohyoRef.current);
  }, [pushDohyoHistory]);

  const endDohyoGesture = useCallback(() => {
    dohyoGestureRef.current = false;
  }, []);

  const undoDohyo = useCallback(() => {
    const prev = dohyoUndoRef.current.pop();
    if (!prev) return;
    dohyoRedoRef.current.push(normalizeDohyo(dohyoRef.current));
    dohyoGestureRef.current = false;
    setDohyoOverlay(normalizeDohyo(prev));
  }, []);

  const redoDohyo = useCallback(() => {
    const next = dohyoRedoRef.current.pop();
    if (!next) return;
    dohyoUndoRef.current.push(normalizeDohyo(dohyoRef.current));
    dohyoGestureRef.current = false;
    setDohyoOverlay(normalizeDohyo(next));
  }, []);

  // Auto-save crowd to localStorage on every change
  useEffect(() => {
    localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(editorPositions));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [editorPositions]);

  // Auto-save tassles + notify in-game layer
  useEffect(() => {
    localStorage.setItem(TASSLE_STORAGE_KEY, JSON.stringify(tasslePositions));
    window.dispatchEvent(new Event(TASSLES_CHANGED_EVENT));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [tasslePositions]);

  // Auto-save apron + notify in-game layer
  useEffect(() => {
    localStorage.setItem(APRON_STORAGE_KEY, JSON.stringify(apronPosition));
    window.dispatchEvent(new Event(APRON_CHANGED_EVENT));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [apronPosition]);

  // Auto-save dohyo knobs + push CSS vars (live game + this editor)
  useEffect(() => {
    const data = normalizeDohyo(dohyoOverlay);
    localStorage.setItem(DOHYO_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(DOHYO_VERSION_KEY, String(CURRENT_DOHYO_VERSION));
    applyDohyoOverlayVars(document.documentElement, data);
    window.dispatchEvent(new Event(DOHYO_CHANGED_EVENT));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [dohyoOverlay]);

  // Entering Dohyo tab selects the plate; leaving clears dohyo selection
  useEffect(() => {
    if (editorTab === EDITOR_TAB_DOHYO) {
      setSelection({ kind: "dohyo" });
    } else if (selection?.kind === "dohyo") {
      setSelection(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on tab change
  }, [editorTab]);

  // Lock body scroll while editor is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Weighted random type selection (matches addMember logic)
  const pickRandomType = useCallback(() => {
    const totalWeight = crowdTypes.reduce((sum, type) => sum + type.weight, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < crowdTypes.length; i++) {
      random -= crowdTypes[i].weight;
      if (random <= 0) return i;
    }
    return 0;
  }, [crowdTypes]);

  const autoSizeForY = useCallback((y) => {
    const t = Math.max(0, Math.min(1, (y - 35) / 65));
    return 8.5 - t * 6.8;
  }, []);

  const addNewMember = useCallback((x, y) => {
    const size = autoSizeForY(y);
    const typeIndex = pickRandomType();
    const type = crowdTypes[typeIndex];
    const sizeMultiplier = type.sizeMultiplier || 1;
    const yOffsetRatio = type.yOffsetRatio || 0;
    const finalSize = size * sizeMultiplier;
    const scaledYOffset = finalSize * yOffsetRatio;

    let newId;
    setEditorPositions(prev => {
      newId = prev.reduce((max, m) => Math.max(max, m.id), 0) + 1;
      return [...prev, {
        id: newId,
        x,
        y: y + scaledYOffset,
        size: finalSize,
        typeIndex,
        flip: Math.random() > 0.5,
        yOffsetRatio,
        sizeMultiplier,
      }];
    });
    setTimeout(() => setSelection({ kind: "crowd", id: newId }), 0);
  }, [crowdTypes, pickRandomType, autoSizeForY]);

  const duplicateSelected = useCallback(() => {
    if (!selection || selection.kind !== "crowd") return;
    const source = positionsRef.current?.find(m => m.id === selection.id);
    if (!source) return;
    const maxId = positionsRef.current.reduce((max, m) => Math.max(max, m.id), 0);
    const newId = maxId + 1;
    setEditorPositions(prev => [...prev, { ...source, id: newId, x: source.x + 2 }]);
    setSelection({ kind: "crowd", id: newId });
  }, [selection]);

  const deleteSelected = useCallback(() => {
    if (!selection || selection.kind !== "crowd") return;
    setEditorPositions(prev => prev.filter(m => m.id !== selection.id));
    setSelection(null);
  }, [selection]);

  const nudgeCrowd = useCallback((id, dx, dy) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, x: m.x + dx, y: m.y + dy } : m
    ));
  }, []);

  const nudgeTassle = useCallback((id, dx, dy) => {
    setTasslePositions(prev => prev.map(m =>
      m.id === id ? { ...m, x: m.x + dx, y: m.y + dy } : m
    ));
  }, []);

  const flipCrowd = useCallback((id) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, flip: !m.flip } : m
    ));
  }, []);

  const flipTassle = useCallback((id) => {
    setTasslePositions(prev => prev.map(m =>
      m.id === id ? { ...m, flip: !m.flip } : m
    ));
  }, []);

  const resizeCrowd = useCallback((id, delta) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, size: Math.max(0.3, m.size + delta) } : m
    ));
  }, []);

  const resizeTassle = useCallback((id, delta) => {
    setTasslePositions(prev => prev.map(m =>
      m.id === id ? { ...m, size: Math.max(0.5, Math.min(20, m.size + delta)) } : m
    ));
  }, []);

  const nudgeApron = useCallback((dx, dy) => {
    setApronPosition((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const flipApron = useCallback(() => {
    setApronPosition((prev) => ({ ...prev, flip: !prev.flip }));
  }, []);

  const resizeApron = useCallback((delta) => {
    setApronPosition((prev) => ({
      ...prev,
      size: Math.max(5, Math.min(100, prev.size + delta)),
    }));
  }, []);

  // Vertical squash — foreshorten without uniform upscale (keeps outlines thinner)
  const squashApron = useCallback((delta) => {
    setApronPosition((prev) => ({
      ...prev,
      squash: Math.max(0.25, Math.min(1.5, (prev.squash ?? 1) + delta)),
    }));
  }, []);

  const cycleTassleColor = useCallback((id) => {
    setTasslePositions(prev => prev.map(m => {
      if (m.id !== id) return m;
      const idx = TASSLE_COLOR_ORDER.indexOf(m.color);
      const next = TASSLE_COLOR_ORDER[(idx + 1) % TASSLE_COLOR_ORDER.length];
      return { ...m, color: next };
    }));
  }, []);

  const toggleTassleDepth = useCallback((id) => {
    setTasslePositions((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = m.depth === "front" ? "back" : "front";
        return { ...m, depth: next };
      })
    );
  }, []);

  const patchDohyo = useCallback((patch) => {
    setDohyoOverlay((prev) => {
      if (!dohyoGestureRef.current) {
        pushDohyoHistory(prev);
      }
      return normalizeDohyo({ ...prev, ...patch });
    });
  }, [pushDohyoHistory]);

  const nudgeDohyo = useCallback((dx, dy) => {
    setDohyoOverlay((prev) => {
      if (!dohyoGestureRef.current) pushDohyoHistory(prev);
      return normalizeDohyo({ ...prev, posX: prev.posX + dx, posY: prev.posY + dy });
    });
  }, [pushDohyoHistory]);

  const resizeDohyo = useCallback((dw, dh = 0) => {
    setDohyoOverlay((prev) => {
      if (!dohyoGestureRef.current) pushDohyoHistory(prev);
      return normalizeDohyo({
        ...prev,
        sizeW: prev.sizeW + dw,
        sizeH: prev.sizeH + dh,
      });
    });
  }, [pushDohyoHistory]);

  // Capture keyboard so the game doesn't receive it — but never steal keys from
  // focused form controls (range/number sliders need arrows + typing).
  useEffect(() => {
    const isFormField = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };

    const onKeyDown = (e) => {
      const onDohyoTab = editorTabRef.current === EDITOR_TAB_DOHYO;
      const mod = e.ctrlKey || e.metaKey;

      // Dohyo undo/redo even while a slider/number is focused
      if (onDohyoTab && mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) redoDohyo();
        else undoDohyo();
        return;
      }
      if (onDohyoTab && mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        redoDohyo();
        return;
      }

      // Let slider/number inputs keep arrows, digits, etc.
      if (isFormField(e.target)) {
        if (e.key === "`" || e.key === "~" || e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          onClose();
        }
        return;
      }

      e.stopImmediatePropagation();

      if (e.key === "Alt") {
        setApronClickThrough(true);
      }

      if (e.key === "`" || e.key === "~" || e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "1" && !mod) {
        e.preventDefault();
        setEditorTab(EDITOR_TAB_CROWD);
        return;
      }
      if (e.key === "2" && !mod) {
        e.preventDefault();
        setEditorTab(EDITOR_TAB_DOHYO);
        return;
      }

      // Dohyo tab: plate only (crowd locked)
      if (onDohyoTab) {
        if (e.key === "o" || e.key === "O") {
          e.preventDefault();
          setSelection({ kind: "dohyo" });
          return;
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          setShowCrowdInDohyoTab((v) => !v);
          return;
        }
        const dStep = e.shiftKey ? 0.1 : 0.5;
        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            nudgeDohyo(-dStep, 0);
            break;
          case "ArrowRight":
            e.preventDefault();
            nudgeDohyo(dStep, 0);
            break;
          case "ArrowUp":
            e.preventDefault();
            nudgeDohyo(0, -dStep);
            break;
          case "ArrowDown":
            e.preventDefault();
            nudgeDohyo(0, dStep);
            break;
          case "=":
          case "+":
            e.preventDefault();
            resizeDohyo(0.5, 0);
            break;
          case "-":
          case "_":
            e.preventDefault();
            resizeDohyo(-0.5, 0);
            break;
          default:
            break;
        }
        return;
      }

      // Ctrl+D = duplicate selected crowd member
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // A = select apron; T = cycle tassles (works when apron is blocking clicks)
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setSelection({ kind: "apron" });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        const list = tasslesRef.current || [];
        if (list.length === 0) return;
        const curIdx = selection?.kind === "tassle"
          ? list.findIndex((m) => m.id === selection.id)
          : -1;
        const next = list[(curIdx + 1) % list.length];
        setSelection({ kind: "tassle", id: next.id });
        return;
      }

      if (!selection) return;

      const step = e.shiftKey ? 0.1 : 0.5;
      if (selection.kind === "apron") {
        switch (e.key) {
          case "ArrowLeft":  e.preventDefault(); nudgeApron(-step, 0); break;
          case "ArrowRight": e.preventDefault(); nudgeApron(step, 0); break;
          case "ArrowUp":    e.preventDefault(); nudgeApron(0, step); break;
          case "ArrowDown":  e.preventDefault(); nudgeApron(0, -step); break;
          case "f": case "F": e.preventDefault(); flipApron(); break;
          case "=": case "+": e.preventDefault(); resizeApron(0.5); break;
          case "-": case "_": e.preventDefault(); resizeApron(-0.5); break;
          case "[": e.preventDefault(); squashApron(-0.03); break;
          case "]": e.preventDefault(); squashApron(0.03); break;
          default: break;
        }
        return;
      }

      if (selection.kind === "tassle") {
        switch (e.key) {
          case "ArrowLeft":  e.preventDefault(); nudgeTassle(selection.id, -step, 0); break;
          case "ArrowRight": e.preventDefault(); nudgeTassle(selection.id, step, 0); break;
          case "ArrowUp":    e.preventDefault(); nudgeTassle(selection.id, 0, step); break;
          case "ArrowDown":  e.preventDefault(); nudgeTassle(selection.id, 0, -step); break;
          case "f": case "F": e.preventDefault(); flipTassle(selection.id); break;
          case "c": case "C": e.preventDefault(); cycleTassleColor(selection.id); break;
          case "d": case "D": e.preventDefault(); toggleTassleDepth(selection.id); break;
          case "=": case "+": e.preventDefault(); resizeTassle(selection.id, 0.15); break;
          case "-": case "_": e.preventDefault(); resizeTassle(selection.id, -0.15); break;
          default: break;
        }
        return;
      }

      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); nudgeCrowd(selection.id, -step, 0); break;
        case "ArrowRight": e.preventDefault(); nudgeCrowd(selection.id, step, 0); break;
        case "ArrowUp":    e.preventDefault(); nudgeCrowd(selection.id, 0, step); break;
        case "ArrowDown":  e.preventDefault(); nudgeCrowd(selection.id, 0, -step); break;
        case "f": case "F": e.preventDefault(); flipCrowd(selection.id); break;
        case "=": case "+": e.preventDefault(); resizeCrowd(selection.id, 0.1); break;
        case "-": case "_": e.preventDefault(); resizeCrowd(selection.id, -0.1); break;
        case "Delete": case "Backspace": e.preventDefault(); deleteSelected(); break;
        default: break;
      }
    };

    const onKeyUp = (e) => {
      e.stopImmediatePropagation();
      if (e.key === "Alt") setApronClickThrough(false);
    };

    const onBlur = () => setApronClickThrough(false);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    selection, onClose, duplicateSelected, deleteSelected,
    nudgeCrowd, nudgeTassle, nudgeApron, flipCrowd, flipTassle, flipApron,
    resizeCrowd, resizeTassle, resizeApron, squashApron, cycleTassleColor,
    toggleTassleDepth, nudgeDohyo, resizeDohyo, undoDohyo, redoDohyo,
  ]);

  const handleMouseDown = useCallback((e, kind, id) => {
    if (editorTabRef.current === EDITOR_TAB_DOHYO) return;
    e.stopPropagation();
    e.preventDefault();
    setSelection(kind === "apron" ? { kind: "apron" } : { kind, id });

    const container = containerRef.current;
    if (!container) return;

    let item;
    if (kind === "apron") item = apronRef.current;
    else if (kind === "tassle") item = tasslesRef.current?.find((m) => m.id === id);
    else item = positionsRef.current?.find((m) => m.id === id);
    if (!item) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = item.x;
    const startY = item.y;
    const rect = container.getBoundingClientRect();

    const onMove = (moveEvt) => {
      const dx = ((moveEvt.clientX - startMouseX) / rect.width) * 100;
      const dy = -((moveEvt.clientY - startMouseY) / rect.height) * 100;
      if (kind === "apron") {
        setApronPosition((prev) => ({ ...prev, x: startX + dx, y: startY + dy }));
      } else if (kind === "tassle") {
        setTasslePositions((prev) =>
          prev.map((m) => (m.id === id ? { ...m, x: startX + dx, y: startY + dy } : m))
        );
      } else {
        setEditorPositions((prev) =>
          prev.map((m) => (m.id === id ? { ...m, x: startX + dx, y: startY + dy } : m))
        );
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleDohyoMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setSelection({ kind: "dohyo" });
    beginDohyoGesture();

    const container = containerRef.current;
    if (!container) return;
    const start = dohyoRef.current;
    if (!start) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = start.posX;
    const startY = start.posY;
    const rect = container.getBoundingClientRect();
    // Mouse is in viewport space; plate knobs are in unscaled scene space
    const camScale =
      EDITOR_CAMERA_PRESETS[dohyoCameraPresetRef.current]?.scale || 1;

    const onMove = (moveEvt) => {
      const dx =
        (((moveEvt.clientX - startMouseX) / rect.width) * 100) / camScale;
      // background-position Y grows downward (unlike crowd bottom-%)
      const dy =
        (((moveEvt.clientY - startMouseY) / rect.height) * 100) / camScale;
      setDohyoOverlay(
        normalizeDohyo({ ...start, posX: startX + dx, posY: startY + dy }),
      );
    };

    const onUp = () => {
      endDohyoGesture();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [beginDohyoGesture, endDohyoGesture]);

  const handleWheel = useCallback((e, kind, id) => {
    if (editorTabRef.current === EDITOR_TAB_DOHYO) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    if (kind === "apron") {
      // Scroll = width; Shift+scroll = vertical squash (perspective foreshorten)
      if (e.shiftKey) squashApron(e.deltaY < 0 ? 0.03 : -0.03);
      else resizeApron(e.deltaY < 0 ? 0.5 : -0.5);
      setSelection({ kind: "apron" });
    } else if (kind === "tassle") {
      resizeTassle(id, delta);
      setSelection({ kind, id });
    } else {
      resizeCrowd(id, delta);
      setSelection({ kind, id });
    }
  }, [resizeCrowd, resizeTassle, resizeApron, squashApron]);

  const handleDohyoWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelection({ kind: "dohyo" });
    const dir = e.deltaY < 0 ? 0.5 : -0.5;
    if (e.shiftKey) resizeDohyo(0, dir);
    else resizeDohyo(dir, 0);
  }, [resizeDohyo]);

  // Ctrl+click on map background = add new member at that position
  const handleMapClick = useCallback((e) => {
    if (editorTabRef.current === EDITOR_TAB_DOHYO) {
      setSelection({ kind: "dohyo" });
      return;
    }
    if (!e.ctrlKey && !e.metaKey) {
      setSelection(null);
      return;
    }
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((rect.bottom - e.clientY) / rect.height) * 100;

    addNewMember(x, y);
  }, [addNewMember]);

  const handleReset = useCallback(() => {
    if (!window.confirm("Reset all crowd positions to code defaults?\nThis will discard ALL editor changes including added members.")) return;
    localStorage.removeItem(CROWD_STORAGE_KEY);
    onClose();
  }, [onClose]);

  const handleResetTassles = useCallback(() => {
    if (!window.confirm("Reset roof tassles to code defaults?")) return;
    localStorage.removeItem(TASSLE_STORAGE_KEY);
    setTasslePositions(ROOF_TASSLE_POSITIONS.map((p) => ({ ...p })));
    setSelection(null);
  }, []);

  const handleResetApron = useCallback(() => {
    if (!window.confirm("Reset roof apron to code defaults?")) return;
    localStorage.removeItem(APRON_STORAGE_KEY);
    setApronPosition(normalizeApron(ROOF_APRON_POSITION));
    setSelection(null);
  }, []);

  const handleResetDohyo = useCallback(() => {
    if (!window.confirm("Reset dohyo overlay to code defaults?")) return;
    pushDohyoHistory(dohyoRef.current);
    dohyoGestureRef.current = false;
    localStorage.removeItem(DOHYO_STORAGE_KEY);
    setDohyoOverlay(normalizeDohyo(DOHYO_OVERLAY));
    setSelection({ kind: "dohyo" });
  }, [pushDohyoHistory]);

  const isDohyoTab = editorTab === EDITOR_TAB_DOHYO;
  const selectedMember = selection?.kind === "crowd"
    ? editorPositions.find(m => m.id === selection.id)
    : null;
  const selectedTassle = selection?.kind === "tassle"
    ? tasslePositions.find(m => m.id === selection.id)
    : null;
  const apronSelected = selection?.kind === "apron";
  const dohyoSelected = selection?.kind === "dohyo";
  const activeCam =
    EDITOR_CAMERA_PRESETS[isDohyoTab ? dohyoCameraPreset : "flat"] ||
    EDITOR_CAMERA_PRESETS.flat;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#0a0a14",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        userSelect: "none",
      }}
      onClick={() => setSelection(null)}
    >
      {/* Stage column — leaves the right rail free for the control panel */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "36px 16px 16px",
          gap: 8,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <span style={{
            color: "#0f0",
            fontFamily: "monospace",
            fontSize: "13px",
            fontWeight: "bold",
            textShadow: "0 0 8px rgba(0,255,0,0.4)",
            letterSpacing: "1px",
          }}>
            {isDohyoTab ? "DOHYO EDITOR" : "CROWD EDITOR"}
          </span>
          <span style={{
            color: saveFlash ? "#0f0" : "#444",
            fontFamily: "monospace",
            fontSize: "11px",
            transition: "color 0.3s",
          }}>
            {saveFlash ? "saved" : "auto-save on"}
          </span>
        </div>

      {/* Viewport (fits column) + fixed 1280×720 stage scaled inside — same
          logical size as the game so perspective(px) matches without reload. */}
      <div
        ref={viewportRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(100%, calc((100vh - 72px) * 16 / 9))",
          aspectRatio: "16 / 9",
          maxHeight: "calc(100vh - 72px)",
          overflow: "hidden",
          borderRadius: "4px",
          boxShadow: "0 0 60px rgba(0,0,0,0.9)",
          cursor: "crosshair",
          flexShrink: 1,
        }}
        onClick={handleMapClick}
      >
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${stageFit})`,
            transformOrigin: "top left",
          }}
        >
        {/* Scene layer — same transform as .game-scene (scale + Y bias). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "center center",
            transform: `translate3d(${activeCam.x}%, ${activeCam.y}%, 0) scale(${activeCam.scale})`,
            willChange: "transform",
          }}
        >
        {/* Map background */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${gameMapBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center -12%",
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
        }} />

        {/* Game-accurate stack: map → stands crowd → dohyo → foreground crowd.
            (Old editor painted ALL crowd above the plate, so front-row overlap
            looked clear here but covered in-game.) */}
        {(!isDohyoTab || showCrowdInDohyoTab) &&
          editorPositions
            .filter((m) => !m._hidden && m.customZIndex === undefined)
            .map((member) => {
              const crowdType = crowdTypes[member.typeIndex];
              if (!crowdType) return null;
              const isSelected =
                !isDohyoTab &&
                selection?.kind === "crowd" &&
                selection.id === member.id;
              const locked = isDohyoTab;
              // Behind dohyo (z200). Selected bumps above so you can still edit.
              const z = isSelected
                ? 10001
                : Math.floor(100 - member.y);

              return (
                <div
                  key={member.id}
                  style={{
                    position: "absolute",
                    left: `${member.x}%`,
                    bottom: `${member.y}%`,
                    width: `${member.size}%`,
                    transform: `translateX(-50%) ${member.flip ? "scaleX(-1)" : ""}`,
                    cursor: locked ? "default" : "grab",
                    zIndex: z,
                    pointerEvents: locked ? "none" : "auto",
                    opacity: locked ? 0.55 : computeCrowdOpacity(),
                  }}
                  onMouseDown={
                    locked
                      ? undefined
                      : (e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "crowd", member.id);
                        }
                  }
                  onWheel={
                    locked
                      ? undefined
                      : (e) => handleWheel(e, "crowd", member.id)
                  }
                >
                  <img
                    src={crowdType.idle}
                    style={{
                      width: "100%",
                      height: "auto",
                      outline: isSelected
                        ? "3px solid #00ff00"
                        : "1px solid rgba(255,255,255,0.12)",
                      outlineOffset: "1px",
                      imageRendering: "auto",
                      filter: member.applyDarkFilter
                        ? "brightness(0.58) saturate(0.75)"
                        : "none",
                    }}
                    draggable={false}
                    alt=""
                  />
                  {!locked && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "50%",
                        transform: `translateX(-50%) ${member.flip ? "scaleX(-1)" : ""}`,
                        background: isSelected ? "#00ff00" : "rgba(0,0,0,0.8)",
                        color: isSelected ? "#000" : "#ccc",
                        fontSize: "9px",
                        fontFamily: "monospace",
                        padding: "1px 4px",
                        borderRadius: "2px",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        fontWeight: "bold",
                        marginBottom: "1px",
                      }}
                    >
                      {member.id}
                    </div>
                  )}
                </div>
              );
            })}

        {/* Dohyo — above stands crowd, below foreground (matches live z:1) */}
        <LiveDohyoOverlay
          style={{
            zIndex: 200,
            pointerEvents: isDohyoTab ? "auto" : "none",
            cursor: isDohyoTab ? "grab" : "default",
            outline:
              isDohyoTab && dohyoSelected
                ? "2px solid rgba(100,180,255,0.85)"
                : "2px solid transparent",
            outlineOffset: "-2px",
          }}
          onMouseDown={isDohyoTab ? handleDohyoMouseDown : undefined}
          onWheel={isDohyoTab ? handleDohyoWheel : undefined}
          aria-hidden={!isDohyoTab}
          role="presentation"
        />

        {/* Foreground crowd (customZIndex) — in front of dohyo + ice, like live z:4 */}
        {(!isDohyoTab || showCrowdInDohyoTab) &&
          editorPositions
            .filter((m) => !m._hidden && m.customZIndex !== undefined)
            .map((member) => {
              const crowdType = crowdTypes[member.typeIndex];
              if (!crowdType) return null;
              const isSelected =
                !isDohyoTab &&
                selection?.kind === "crowd" &&
                selection.id === member.id;
              const locked = isDohyoTab;
              const z = isSelected
                ? 10001
                : 300 + Math.floor(100 - member.y);

              return (
                <div
                  key={`fg-${member.id}`}
                  style={{
                    position: "absolute",
                    left: `${member.x}%`,
                    bottom: `${member.y}%`,
                    width: `${member.size}%`,
                    transform: `translateX(-50%) ${member.flip ? "scaleX(-1)" : ""}`,
                    cursor: locked ? "default" : "grab",
                    zIndex: z,
                    pointerEvents: locked ? "none" : "auto",
                    opacity: locked ? 0.7 : computeCrowdOpacity(),
                  }}
                  onMouseDown={
                    locked
                      ? undefined
                      : (e) => {
                          e.stopPropagation();
                          handleMouseDown(e, "crowd", member.id);
                        }
                  }
                  onWheel={
                    locked
                      ? undefined
                      : (e) => handleWheel(e, "crowd", member.id)
                  }
                >
                  <img
                    src={crowdType.idle}
                    style={{
                      width: "100%",
                      height: "auto",
                      outline: isSelected
                        ? "3px solid #00ff00"
                        : "1px solid rgba(255,200,80,0.35)",
                      outlineOffset: "1px",
                      imageRendering: "auto",
                      filter: member.applyDarkFilter
                        ? "brightness(0.58) saturate(0.75)"
                        : "brightness(0.85)",
                    }}
                    draggable={false}
                    alt=""
                  />
                  {!locked && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "50%",
                        transform: `translateX(-50%) ${member.flip ? "scaleX(-1)" : ""}`,
                        background: isSelected ? "#00ff00" : "rgba(0,0,0,0.8)",
                        color: isSelected ? "#000" : "#fc8",
                        fontSize: "9px",
                        fontFamily: "monospace",
                        padding: "1px 4px",
                        borderRadius: "2px",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        fontWeight: "bold",
                        marginBottom: "1px",
                      }}
                    >
                      {member.id}·fg
                    </div>
                  )}
                </div>
              );
            })}

        {/* All tassles under the apron (front/back only orders tassles among themselves). */}
        {!isDohyoTab && tasslePositions
          .filter((t) => !isFrontTassle(t))
          .map((tassle) => {
            const colorDef = TASSLE_COLORS[tassle.color] || TASSLE_COLORS.white;
            const isSelected = selection?.kind === "tassle" && selection.id === tassle.id;
            return (
              <div
                key={`tassle-${tassle.id}`}
                style={{
                  position: "absolute",
                  left: `${tassle.x}%`,
                  bottom: `${tassle.y}%`,
                  width: `${tassle.size}%`,
                  transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                  cursor: "grab",
                  zIndex: tassleZEditor(tassle, isSelected),
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "tassle", tassle.id); }}
                onWheel={(e) => handleWheel(e, "tassle", tassle.id)}
              >
                <img
                  src={colorDef.src}
                  style={{
                    width: "100%",
                    height: "auto",
                    outline: isSelected
                      ? "3px solid #00ff00"
                      : "2px solid rgba(255,255,0,0.7)",
                    outlineOffset: "2px",
                    imageRendering: "auto",
                    filter:
                      "brightness(0.88) saturate(0.9) drop-shadow(0 5px 7px rgba(0,0,0,0.45))",
                    opacity: 0.7,
                    background: "rgba(255,255,255,0.06)",
                  }}
                  draggable={false}
                  alt=""
                />
                <div style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                  background: isSelected ? "#00ff00" : "rgba(0,0,0,0.9)",
                  color: isSelected ? "#000" : "#ff0",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  padding: "2px 5px",
                  borderRadius: "2px",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}>
                  {tassle.color}·back
                </div>
              </div>
            );
          })}

        {!isDohyoTab && tasslePositions
          .filter((t) => isFrontTassle(t))
          .map((tassle) => {
            const colorDef = TASSLE_COLORS[tassle.color] || TASSLE_COLORS.white;
            const isSelected = selection?.kind === "tassle" && selection.id === tassle.id;
            return (
              <div
                key={`tassle-front-${tassle.id}`}
                style={{
                  position: "absolute",
                  left: `${tassle.x}%`,
                  bottom: `${tassle.y}%`,
                  width: `${tassle.size}%`,
                  transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                  cursor: "grab",
                  zIndex: tassleZEditor(tassle, isSelected),
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "tassle", tassle.id); }}
                onWheel={(e) => handleWheel(e, "tassle", tassle.id)}
              >
                <img
                  src={colorDef.src}
                  style={{
                    width: "100%",
                    height: "auto",
                    outline: isSelected
                      ? "3px solid #00ff00"
                      : "2px solid rgba(255,255,0,0.7)",
                    outlineOffset: "2px",
                    imageRendering: "auto",
                    filter:
                      "brightness(0.88) saturate(0.9) drop-shadow(0 5px 7px rgba(0,0,0,0.45))",
                    opacity: 1,
                    background: "rgba(255,255,255,0.06)",
                  }}
                  draggable={false}
                  alt=""
                />
                <div style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                  background: isSelected ? "#00ff00" : "rgba(0,0,0,0.9)",
                  color: isSelected ? "#000" : "#ff0",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  padding: "2px 5px",
                  borderRadius: "2px",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}>
                  {tassle.color}·front
                </div>
              </div>
            );
          })}

        {/* Apron always above every tassle. Hold Alt to click through. Hidden on Dohyo tab. */}
        {!isDohyoTab && (
        <div
          style={{
            position: "absolute",
            left: `${apronPosition.x}%`,
            bottom: `${apronPosition.y}%`,
            width: `${apronPosition.size}%`,
            transformOrigin: "50% 0%",
            transform: `translateX(-50%) ${apronPosition.flip ? "scaleX(-1)" : ""} scaleY(${apronPosition.squash ?? 1})`,
            cursor: apronClickThrough ? "default" : "grab",
            zIndex: apronSelected ? 10002 : APRON_Z_EDITOR,
            pointerEvents: apronClickThrough ? "none" : "auto",
            opacity: apronClickThrough ? 0.45 : 1,
          }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, "apron"); }}
          onWheel={(e) => handleWheel(e, "apron")}
        >
          <img
            src={APRON_SRC}
            style={{
              width: "100%",
              height: "auto",
              outline: apronSelected
                ? "3px solid #00ff00"
                : "2px solid rgba(200,120,255,0.85)",
              outlineOffset: "2px",
              imageRendering: "auto",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))",
              opacity: apronClickThrough ? 0.45 : 1,
              background: "rgba(255,255,255,0.04)",
            }}
            draggable={false}
            alt=""
          />
          <div style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: `translateX(-50%) ${apronPosition.flip ? "scaleX(-1)" : ""}`,
            background: apronSelected ? "#00ff00" : "rgba(0,0,0,0.9)",
            color: apronSelected ? "#000" : "#d8a",
            fontSize: "10px",
            fontFamily: "monospace",
            padding: "2px 5px",
            borderRadius: "2px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            fontWeight: "bold",
            marginBottom: "2px",
          }}>
            {apronClickThrough ? "apron (Alt: click-through)" : "roof-apron"}
          </div>
        </div>
        )}
        </div>
        </div>
      </div>
      </div>

      {/* Control Panel — solid right rail, never overlays the stage */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          background: "#080818",
          color: "#ccc",
          padding: "18px 16px",
          fontFamily: "monospace",
          fontSize: "12px",
          borderLeft: "1px solid #2a2a3a",
          pointerEvents: "auto",
          overflowY: "auto",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setEditorTab(EDITOR_TAB_CROWD)}
            style={{
              flex: 1,
              padding: "7px 4px",
              background: !isDohyoTab ? "#164" : "#12121c",
              color: !isDohyoTab ? "#afa" : "#666",
              border: `1px solid ${!isDohyoTab ? "#3a6" : "#333"}`,
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            CROWD + ROOF
          </button>
          <button
            type="button"
            onClick={() => setEditorTab(EDITOR_TAB_DOHYO)}
            style={{
              flex: 1,
              padding: "7px 4px",
              background: isDohyoTab ? "#146" : "#12121c",
              color: isDohyoTab ? "#aef" : "#666",
              border: `1px solid ${isDohyoTab ? "#36a" : "#333"}`,
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            DOHYO
          </button>
        </div>

        {isDohyoTab ? (
          <>
            <div style={{ color: "#6af", fontWeight: "bold", marginBottom: 4, fontSize: "13px", letterSpacing: "0.5px" }}>
              DOHYO OVERLAY
            </div>
            <div style={{ color: "#666", fontSize: "10px", marginBottom: 10, lineHeight: 1.5 }}>
              1280×720 stage (scaled to fit) · perspective matches live
            </div>

            <div style={{ color: "#8af", fontSize: 10, marginBottom: 4 }}>Camera (in-game)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
              {CAMERA_PRESET_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDohyoCameraPreset(key)}
                  style={{
                    padding: "4px 7px",
                    background: dohyoCameraPreset === key ? "#146" : "#12121c",
                    color: dohyoCameraPreset === key ? "#aef" : "#666",
                    border: `1px solid ${dohyoCameraPreset === key ? "#36a" : "#333"}`,
                    borderRadius: 3,
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: 9,
                    fontWeight: "bold",
                  }}
                >
                  {CAMERA_PRESET_LABELS[key]}
                </button>
              ))}
            </div>
            <div style={{ color: "#555", fontSize: 9, marginBottom: 10, lineHeight: 1.5 }}>
              scale {activeCam.scale.toFixed(3)} · y {activeCam.y}
            </div>

            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              color: "#9ab",
              fontSize: 11,
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={showCrowdInDohyoTab}
                onChange={(e) => setShowCrowdInDohyoTab(e.target.checked)}
              />
              Show crowd (locked)
            </label>

            <div style={{ color: "#8af", fontSize: 10, marginBottom: 6 }}>Plate</div>
            <DohyoSlider label="size W %" value={dohyoOverlay.sizeW} min={20} max={120} onChange={(v) => patchDohyo({ sizeW: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="size H %" value={dohyoOverlay.sizeH} min={20} max={120} onChange={(v) => patchDohyo({ sizeH: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="pos X %" value={dohyoOverlay.posX} min={0} max={100} onChange={(v) => patchDohyo({ posX: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="pos Y %" value={dohyoOverlay.posY} min={0} max={100} onChange={(v) => patchDohyo({ posY: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />

            <div style={{ color: "#8af", fontSize: 10, margin: "10px 0 6px" }}>Perspective</div>
            <DohyoSlider label="origin X %" value={dohyoOverlay.originX} min={0} max={100} onChange={(v) => patchDohyo({ originX: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="origin Y %" value={dohyoOverlay.originY} min={50} max={160} onChange={(v) => patchDohyo({ originY: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="perspective px" value={dohyoOverlay.perspective} min={80} max={2000} onChange={(v) => patchDohyo({ perspective: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="rotateX deg" value={dohyoOverlay.rotateX} min={-30} max={45} onChange={(v) => patchDohyo({ rotateX: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="scaleY" value={dohyoOverlay.scaleY} min={0.35} max={1.5} step={0.01} onChange={(v) => patchDohyo({ scaleY: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="translateY %" value={dohyoOverlay.translateY} min={-40} max={40} onChange={(v) => patchDohyo({ translateY: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />

            <div style={{ color: "#8af", fontSize: 10, margin: "10px 0 6px" }}>Contact shadow</div>
            <DohyoSlider label="shadow top %" value={dohyoOverlay.shadowTop} min={0} max={100} onChange={(v) => patchDohyo({ shadowTop: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="shadow width %" value={dohyoOverlay.shadowWidth} min={10} max={120} onChange={(v) => patchDohyo({ shadowWidth: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="shadow height %" value={dohyoOverlay.shadowHeight} min={5} max={80} onChange={(v) => patchDohyo({ shadowHeight: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="shadow blur px" value={dohyoOverlay.shadowBlur} min={0} max={60} onChange={(v) => patchDohyo({ shadowBlur: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="shadow opacity 0" value={dohyoOverlay.shadowOpacity0} min={0} max={1} step={0.01} onChange={(v) => patchDohyo({ shadowOpacity0: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />
            <DohyoSlider label="shadow opacity 1" value={dohyoOverlay.shadowOpacity1} min={0} max={1} step={0.01} onChange={(v) => patchDohyo({ shadowOpacity1: v })} onGestureStart={beginDohyoGesture} onGestureEnd={endDohyoGesture} />

            <div style={{ color: "#555", fontSize: 10, lineHeight: 1.7, marginTop: 8 }}>
              <div>Drag plate → pos · Scroll = width · Shift+scroll = height</div>
              <div>Ctrl+Z undo · Ctrl+Shift+Z / Ctrl+Y redo</div>
              <div>Arrows nudge (Shift = fine) · H toggle crowd · 1/2 tabs</div>
              <div style={{ marginTop: 4, color: "#664" }}>
                After big moves: regen ice clip
                <br />
                <span style={{ color: "#444" }}>node scripts/measure-ice-clip.mjs --write</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const data = normalizeDohyo(dohyoOverlay);
                const moduleSrc =
                  `export const DOHYO_STORAGE_KEY = "penguin-pow-dohyo-overlay";\n` +
                  `export const DOHYO_VERSION_KEY = "penguin-pow-dohyo-overlay-version";\n` +
                  `export const DOHYO_CHANGED_EVENT = "penguin-pow-dohyo-changed";\n` +
                  `export const CURRENT_DOHYO_VERSION = ${CURRENT_DOHYO_VERSION};\n\n` +
                  `// Baked dohyo overlay knobs — exported from the crowd editor (\` key → Dohyo tab).\n` +
                  `// DO NOT manually edit. Use the editor, then EXPORT and replace this object.\n` +
                  `const DOHYO_OVERLAY = ${JSON.stringify(data, null, 2)};\n\n` +
                  `const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));\n` +
                  `const num = (v, fallback) => {\n` +
                  `  const n = Number(v);\n` +
                  `  return Number.isFinite(n) ? n : fallback;\n` +
                  `};\n\n` +
                  `export function normalizeDohyo(raw) {\n` +
                  `  const base = { ...DOHYO_OVERLAY, ...(raw || {}) };\n` +
                  `  return {\n` +
                  `    sizeW: clamp(num(base.sizeW, DOHYO_OVERLAY.sizeW), 20, 120),\n` +
                  `    sizeH: clamp(num(base.sizeH, DOHYO_OVERLAY.sizeH), 20, 120),\n` +
                  `    posX: num(base.posX, DOHYO_OVERLAY.posX),\n` +
                  `    posY: num(base.posY, DOHYO_OVERLAY.posY),\n` +
                  `    originX: num(base.originX, DOHYO_OVERLAY.originX),\n` +
                  `    originY: num(base.originY, DOHYO_OVERLAY.originY),\n` +
                  `    perspective: clamp(num(base.perspective, DOHYO_OVERLAY.perspective), 80, 2000),\n` +
                  `    rotateX: clamp(num(base.rotateX, DOHYO_OVERLAY.rotateX), -30, 45),\n` +
                  `    scaleY: clamp(num(base.scaleY, DOHYO_OVERLAY.scaleY), 0.35, 1.5),\n` +
                  `    translateY: clamp(num(base.translateY, DOHYO_OVERLAY.translateY), -40, 40),\n` +
                  `    shadowTop: clamp(num(base.shadowTop, DOHYO_OVERLAY.shadowTop), 0, 100),\n` +
                  `    shadowWidth: clamp(num(base.shadowWidth, DOHYO_OVERLAY.shadowWidth), 10, 120),\n` +
                  `    shadowHeight: clamp(num(base.shadowHeight, DOHYO_OVERLAY.shadowHeight), 5, 80),\n` +
                  `    shadowBlur: clamp(num(base.shadowBlur, DOHYO_OVERLAY.shadowBlur), 0, 60),\n` +
                  `    shadowOpacity0: clamp(num(base.shadowOpacity0, DOHYO_OVERLAY.shadowOpacity0), 0, 1),\n` +
                  `    shadowOpacity1: clamp(num(base.shadowOpacity1, DOHYO_OVERLAY.shadowOpacity1), 0, 1),\n` +
                  `  };\n` +
                  `}\n\n` +
                  `export function loadDohyoOverlay() {\n` +
                  `  try {\n` +
                  `    const version = parseInt(localStorage.getItem(DOHYO_VERSION_KEY) || "0", 10);\n` +
                  `    if (version < CURRENT_DOHYO_VERSION) {\n` +
                  `      localStorage.removeItem(DOHYO_STORAGE_KEY);\n` +
                  `      localStorage.setItem(DOHYO_VERSION_KEY, String(CURRENT_DOHYO_VERSION));\n` +
                  `      return normalizeDohyo(DOHYO_OVERLAY);\n` +
                  `    }\n` +
                  `    const raw = localStorage.getItem(DOHYO_STORAGE_KEY);\n` +
                  `    if (raw) return normalizeDohyo(JSON.parse(raw));\n` +
                  `  } catch { /* defaults */ }\n` +
                  `  return normalizeDohyo(DOHYO_OVERLAY);\n` +
                  `}\n\n` +
                  `export function applyDohyoOverlayVars(el, data) {\n` +
                  `  if (!el) return;\n` +
                  `  const d = normalizeDohyo(data);\n` +
                  `  const set = (k, v) => el.style.setProperty(k, v);\n` +
                  `  set("--dohyo-size-w", \`\${d.sizeW}%\`);\n` +
                  `  set("--dohyo-size-h", \`\${d.sizeH}%\`);\n` +
                  `  set("--dohyo-pos-x", \`\${d.posX}%\`);\n` +
                  `  set("--dohyo-pos-y", \`\${d.posY}%\`);\n` +
                  `  set("--dohyo-origin-x", \`\${d.originX}%\`);\n` +
                  `  set("--dohyo-origin-y", \`\${d.originY}%\`);\n` +
                  `  set("--dohyo-perspective", \`\${d.perspective}px\`);\n` +
                  `  set("--dohyo-rotate-x", \`\${d.rotateX}deg\`);\n` +
                  `  set("--dohyo-scale-y", String(d.scaleY));\n` +
                  `  set("--dohyo-translate-y", \`\${d.translateY}%\`);\n` +
                  `  set("--dohyo-shadow-top", \`\${d.shadowTop}%\`);\n` +
                  `  set("--dohyo-shadow-width", \`\${d.shadowWidth}%\`);\n` +
                  `  set("--dohyo-shadow-height", \`\${d.shadowHeight}%\`);\n` +
                  `  set("--dohyo-shadow-blur", \`\${d.shadowBlur}px\`);\n` +
                  `  set("--dohyo-shadow-opacity-0", String(d.shadowOpacity0));\n` +
                  `  set("--dohyo-shadow-opacity-1", String(d.shadowOpacity1));\n` +
                  `}\n\n` +
                  `export { DOHYO_OVERLAY };\n` +
                  `export default DOHYO_OVERLAY;\n`;
                const blob = new Blob([moduleSrc], { type: "text/javascript" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "dohyoOverlayData.js";
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "8px",
                background: "#146",
                color: "#aef",
                border: "1px solid #36a",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              EXPORT DOHYO (.js)
            </button>

            <button
              type="button"
              onClick={handleResetDohyo}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "8px",
                background: "#413",
                color: "#eaf",
                border: "1px solid #636",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              RESET DOHYO DEFAULTS
            </button>

            <div style={{ marginTop: 8, color: "#664", fontSize: "9px", lineHeight: 1.4 }}>
              In-game uses a baked plate. After export:{" "}
              <span style={{ color: "#8af" }}>npm run bake:dohyo</span>
            </div>

            <div style={{ marginTop: 8, textAlign: "center", color: "#444", fontSize: "9px" }}>
              ` or Esc to close · 1/2 switch tabs
            </div>
          </>
        ) : (
          <>
        <div style={{ color: "#0f0", fontWeight: "bold", marginBottom: 4, fontSize: "13px", letterSpacing: "0.5px" }}>
          CROWD + ROOF EDITOR
        </div>
        <div style={{ color: "#666", fontSize: "10px", marginBottom: 10 }}>
          {editorPositions.length} members · {tasslePositions.length} tassles · apron — auto-save
        </div>

        {apronSelected ? (
          <div style={{ lineHeight: 1.7 }}>
            <div style={{ color: "#d8a" }}>ROOF APRON</div>
            <hr style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "6px 0" }} />
            <div>x: <span style={{ color: "#ff0" }}>{Math.round(apronPosition.x * 100) / 100}</span></div>
            <div>y: <span style={{ color: "#ff0" }}>{Math.round(apronPosition.y * 100) / 100}</span></div>
            <div>width: <span style={{ color: "#ff0" }}>{Math.round(apronPosition.size * 100) / 100}</span></div>
            <div>squash: <span style={{ color: "#ff0" }}>{Math.round((apronPosition.squash ?? 1) * 100) / 100}</span></div>
            <div>flip: {apronPosition.flip ? "yes" : "no"}</div>
          </div>
        ) : selectedTassle ? (
          <div style={{ lineHeight: 1.7 }}>
            <div style={{ color: "#ff0" }}>ROOF TASSLE</div>
            <div>color: <span style={{ color: "#0f0" }}>
              {TASSLE_COLORS[selectedTassle.color]?.label || selectedTassle.color}
            </span></div>
            <hr style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "6px 0" }} />
            <div>x: <span style={{ color: "#ff0" }}>{Math.round(selectedTassle.x * 100) / 100}</span></div>
            <div>y: <span style={{ color: "#ff0" }}>{Math.round(selectedTassle.y * 100) / 100}</span></div>
            <div>size: <span style={{ color: "#ff0" }}>{Math.round(selectedTassle.size * 100) / 100}</span></div>
            <div>depth: <span style={{ color: "#0f0" }}>{selectedTassle.depth || (isFrontTassle(selectedTassle) ? "front" : "back")}</span></div>
            <div>flip: {selectedTassle.flip ? "yes" : "no"}</div>
          </div>
        ) : selectedMember ? (
          <div style={{ lineHeight: 1.7 }}>
            <div>ID: <span style={{ color: "#0f0" }}>{selectedMember.id}</span></div>
            <div>Type: {selectedMember.typeIndex}
              {selectedMember.customZIndex !== undefined && " (foreground)"}
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "6px 0" }} />
            <div>x: <span style={{ color: "#ff0" }}>
              {Math.round(selectedMember.x * 100) / 100}
            </span></div>
            <div>y (code): <span style={{ color: "#ff0" }}>
              {Math.round((selectedMember.y - selectedMember.size * (selectedMember.yOffsetRatio || 0)) * 100) / 100}
            </span></div>
            <div>size (code): <span style={{ color: "#ff0" }}>
              {Math.round((selectedMember.size / (selectedMember.sizeMultiplier || 1)) * 100) / 100}
            </span></div>
            <div>opacity: {computeCrowdOpacity()}</div>
            <div>flip: {selectedMember.flip ? "yes" : "no"}</div>
          </div>
        ) : (
          <div style={{ color: "#555", padding: "4px 0" }}>
            Click crowd, yellow tassle, or purple apron
          </div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "10px 0" }} />

        <div style={{ color: "#666", fontSize: "10px", lineHeight: 1.7 }}>
          <div style={{ color: "#aaf", marginBottom: 2 }}>Crowd:</div>
          <div>Ctrl+click map → new member</div>
          <div>Ctrl+D → duplicate · Del → delete</div>
          <div style={{ color: "#aaf", marginTop: 4, marginBottom: 2 }}>Tassles:</div>
          <div>C → color · D → front/back (still under apron)</div>
          <div>T → cycle · Alt → click through apron</div>
          <div style={{ color: "#aaf", marginTop: 4, marginBottom: 2 }}>Apron:</div>
          <div>A → select · hangs straight (no tilt)</div>
          <div>scroll = width · Shift+scroll = squash</div>
          <div style={{ color: "#aaf", marginTop: 4, marginBottom: 2 }}>All:</div>
          <div>Drag → move · Scroll / +/- → resize</div>
          <div>Arrows → nudge (Shift = fine) · F → flip</div>
        </div>

        <button
          onClick={() => {
            const data = localStorage.getItem(CROWD_STORAGE_KEY);
            if (!data) return;
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "crowd-positions.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "8px",
            background: "#164",
            color: "#afa",
            border: "1px solid #3a6",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          EXPORT CROWD JSON
        </button>

        <button
          onClick={() => {
            const data = localStorage.getItem(TASSLE_STORAGE_KEY);
            if (!data) return;
            const moduleSrc =
              `// Baked roof-tassle positions — exported from the editor\n` +
              `// DO NOT manually edit. Use the crowd editor (\` key),\n` +
              `// then EXPORT and replace this file.\n` +
              `const ROOF_TASSLE_POSITIONS = ${JSON.stringify(JSON.parse(data), null, 2)};\n\n` +
              `export default ROOF_TASSLE_POSITIONS;\n`;
            const blob = new Blob([moduleSrc], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "roofTasslePositionsData.js";
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "8px",
            background: "#146",
            color: "#aef",
            border: "1px solid #36a",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          EXPORT TASSLES (.js)
        </button>

        <button
          onClick={() => {
            const data = localStorage.getItem(APRON_STORAGE_KEY);
            if (!data) return;
            const pos = normalizeApron(JSON.parse(data));
            const moduleSrc =
              `import apronSrc from "../assets/roof-apron.png";\n\n` +
              `export const APRON_SRC = apronSrc;\n` +
              `export const APRON_STORAGE_KEY = "penguin-pow-roof-apron-position";\n` +
              `export const APRON_VERSION_KEY = "penguin-pow-roof-apron-version";\n` +
              `export const APRON_CHANGED_EVENT = "penguin-pow-apron-changed";\n` +
              `export const CURRENT_APRON_VERSION = ${CURRENT_APRON_VERSION};\n\n` +
              `// Baked roof-apron placement — exported from the crowd editor (\` key).\n` +
              `// DO NOT manually edit. Use the editor, then EXPORT and replace this object.\n` +
              `const ROOF_APRON_POSITION = ${JSON.stringify(pos, null, 2)};\n\n` +
              `export function normalizeApron(raw) {\n` +
              `  const base = { ...ROOF_APRON_POSITION, ...(raw || {}) };\n` +
              `  return {\n` +
              `    x: Number(base.x) || 50,\n` +
              `    y: Number(base.y) || 56,\n` +
              `    size: Math.max(5, Math.min(100, Number(base.size) || 58)),\n` +
              `    squash: Math.max(0.25, Math.min(1.5, Number(base.squash) || 1)),\n` +
              `    flip: !!base.flip,\n` +
              `  };\n` +
              `}\n\n` +
              `export default ROOF_APRON_POSITION;\n`;
            const blob = new Blob([moduleSrc], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "roofApronData.js";
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "8px",
            background: "#416",
            color: "#eaf",
            border: "1px solid #63a",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          EXPORT APRON (.js)
        </button>

        <button
          onClick={handleReset}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "8px",
            background: "#611",
            color: "#faa",
            border: "1px solid #833",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          RESET CROWD DEFAULTS
        </button>

        <button
          onClick={handleResetTassles}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "8px",
            background: "#531",
            color: "#fda",
            border: "1px solid #853",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          RESET TASSLE DEFAULTS
        </button>

        <button
          onClick={handleResetApron}
          style={{
            marginTop: 6,
            width: "100%",
            padding: "8px",
            background: "#413",
            color: "#eaf",
            border: "1px solid #636",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          RESET APRON DEFAULTS
        </button>

        <div style={{ marginTop: 8, textAlign: "center", color: "#444", fontSize: "9px" }}>
          ` or Esc to close · 1/2 switch tabs
        </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CrowdEditor;
