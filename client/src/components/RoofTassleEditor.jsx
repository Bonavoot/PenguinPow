import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import gameMapBg from "../assets/game-map-1.webp";
import tassleWhite from "../assets/roof-tassle.png";
import tassleGreen from "../assets/roof-tassle-green.png";
import tassleRed from "../assets/roof-tassle-red.png";
import tassleBlack from "../assets/roof-tassle-black.png";

export const TASSLE_STORAGE_KEY = "penguin-pow-roof-tassle-positions";
export const TASSLES_CHANGED_EVENT = "penguin-pow-tassles-changed";

export const TASSLE_COLORS = {
  white: { src: tassleWhite, label: "white (cream)" },
  green: { src: tassleGreen, label: "emerald green" },
  red: { src: tassleRed, label: "red" },
  black: { src: tassleBlack, label: "black" },
};

export const TASSLE_COLOR_ORDER = ["white", "green", "red", "black"];

const RoofTassleEditor = ({ positions, onClose }) => {
  const [editorPositions, setEditorPositions] = useState(
    () => positions.map((p) => ({ ...p }))
  );
  // Auto-select first tassle so it's obvious something is there
  const [selectedId, setSelectedId] = useState(
    () => (positions[0] ? positions[0].id : null)
  );
  const [saveFlash, setSaveFlash] = useState(false);
  const containerRef = useRef(null);
  const positionsRef = useRef(editorPositions);

  useEffect(() => {
    positionsRef.current = editorPositions;
  }, [editorPositions]);

  useEffect(() => {
    localStorage.setItem(TASSLE_STORAGE_KEY, JSON.stringify(editorPositions));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [editorPositions]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const nudge = useCallback((id, dx, dy) => {
    setEditorPositions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, x: m.x + dx, y: m.y + dy } : m))
    );
  }, []);

  const flipTassle = useCallback((id) => {
    setEditorPositions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, flip: !m.flip } : m))
    );
  }, []);

  const resizeTassle = useCallback((id, delta) => {
    setEditorPositions((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, size: Math.max(0.5, Math.min(20, m.size + delta)) } : m
      )
    );
  }, []);

  const cycleColor = useCallback((id) => {
    setEditorPositions((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const idx = TASSLE_COLOR_ORDER.indexOf(m.color);
        const next = TASSLE_COLOR_ORDER[(idx + 1) % TASSLE_COLOR_ORDER.length];
        return { ...m, color: next };
      })
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopImmediatePropagation();

      if (e.key === "~" || e.key === "`" || e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (selectedId === null) return;

      const step = e.shiftKey ? 0.1 : 0.5;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          nudge(selectedId, -step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          nudge(selectedId, step, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          nudge(selectedId, 0, step);
          break;
        case "ArrowDown":
          e.preventDefault();
          nudge(selectedId, 0, -step);
          break;
        case "f":
        case "F":
          e.preventDefault();
          flipTassle(selectedId);
          break;
        case "c":
        case "C":
          e.preventDefault();
          cycleColor(selectedId);
          break;
        case "=":
        case "+":
          e.preventDefault();
          resizeTassle(selectedId, 0.15);
          break;
        case "-":
        case "_":
          e.preventDefault();
          resizeTassle(selectedId, -0.15);
          break;
        default:
          break;
      }
    };

    const onKeyUp = (e) => {
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [selectedId, onClose, nudge, flipTassle, resizeTassle, cycleColor]);

  const handleMouseDown = useCallback((e, tassleId) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(tassleId);

    const container = containerRef.current;
    if (!container) return;

    const tassle = positionsRef.current?.find((m) => m.id === tassleId);
    if (!tassle) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = tassle.x;
    const startY = tassle.y;
    const rect = container.getBoundingClientRect();

    const onMove = (moveEvt) => {
      const dx = ((moveEvt.clientX - startMouseX) / rect.width) * 100;
      const dy = -((moveEvt.clientY - startMouseY) / rect.height) * 100;
      setEditorPositions((prev) =>
        prev.map((m) =>
          m.id === tassleId ? { ...m, x: startX + dx, y: startY + dy } : m
        )
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleWheel = useCallback((e, tassleId) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setEditorPositions((prev) =>
      prev.map((m) =>
        m.id === tassleId
          ? { ...m, size: Math.max(0.5, Math.min(20, m.size + delta)) }
          : m
      )
    );
    setSelectedId(tassleId);
  }, []);

  const handleReset = useCallback(() => {
    if (
      !window.confirm(
        "Reset all tassle positions to code defaults?\nThis will discard ALL editor changes."
      )
    ) {
      return;
    }
    localStorage.removeItem(TASSLE_STORAGE_KEY);
    onClose();
  }, [onClose]);

  const selected = selectedId !== null
    ? editorPositions.find((m) => m.id === selectedId)
    : null;

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
      onClick={() => setSelectedId(null)}
    >
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              color: "#0f0",
              fontFamily: "monospace",
              fontSize: "13px",
              fontWeight: "bold",
              textShadow: "0 0 8px rgba(0,255,0,0.4)",
              letterSpacing: "1px",
            }}
          >
            ROOF TASSLE EDITOR
          </span>
          <span
            style={{
              color: saveFlash ? "#0f0" : "#444",
              fontFamily: "monospace",
              fontSize: "11px",
              transition: "color 0.3s",
            }}
          >
            {saveFlash ? "saved" : "auto-save on"}
          </span>
        </div>

      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(100%, calc((100vh - 72px) * 16 / 9))",
          aspectRatio: "16 / 9",
          maxHeight: "calc(100vh - 72px)",
          overflow: "hidden",
          borderRadius: "4px",
          boxShadow: "0 0 60px rgba(0,0,0,0.9)",
          cursor: "default",
          flexShrink: 1,
        }}
        onClick={() => setSelectedId(null)}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${gameMapBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center -5%",
            backgroundRepeat: "no-repeat",
            pointerEvents: "none",
          }}
        />

        {/* Live .dohyo-overlay from App.css — CSS edits show up here */}
        <div className="dohyo-overlay" aria-hidden="true" />

        {editorPositions.map((tassle) => {
          const colorDef = TASSLE_COLORS[tassle.color] || TASSLE_COLORS.white;
          const isSelected = selectedId === tassle.id;

          return (
            <div
              key={tassle.id}
              style={{
                position: "absolute",
                left: `${tassle.x}%`,
                bottom: `${tassle.y}%`,
                width: `${tassle.size}%`,
                transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                cursor: "grab",
                zIndex: isSelected ? 10000 : 10 + Math.floor(tassle.size * 10),
                pointerEvents: "auto",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, tassle.id);
              }}
              onWheel={(e) => {
                e.stopPropagation();
                handleWheel(e, tassle.id);
              }}
            >
              <img
                src={colorDef.src}
                style={{
                  width: "100%",
                  height: "auto",
                  outline: isSelected
                    ? "3px solid #00ff00"
                    : "2px solid rgba(255,255,0,0.55)",
                  outlineOffset: "2px",
                  imageRendering: "auto",
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))",
                  background: "rgba(255,255,255,0.06)",
                }}
                draggable={false}
                alt=""
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: `translateX(-50%) ${tassle.flip ? "scaleX(-1)" : ""}`,
                  background: isSelected ? "#00ff00" : "rgba(0,0,0,0.9)",
                  color: isSelected ? "#000" : "#ff0",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  padding: "2px 6px",
                  borderRadius: "2px",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  fontWeight: "bold",
                  marginBottom: "2px",
                }}
              >
                {tassle.color}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <div
        style={{
          width: 260,
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
        <div
          style={{
            color: "#0f0",
            fontWeight: "bold",
            marginBottom: 4,
            fontSize: "13px",
            letterSpacing: "0.5px",
          }}
        >
          ROOF TASSLE EDITOR
        </div>
        <div style={{ color: "#666", fontSize: "10px", marginBottom: 10 }}>
          {editorPositions.length} tassles — changes auto-save
        </div>

        {selected ? (
          <div style={{ lineHeight: 1.7 }}>
            <div>
              id: <span style={{ color: "#0f0" }}>{selected.id}</span>
            </div>
            <div>
              color:{" "}
              <span style={{ color: "#0f0" }}>
                {TASSLE_COLORS[selected.color]?.label || selected.color}
              </span>
            </div>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid #2a2a3a",
                margin: "6px 0",
              }}
            />
            <div>
              x:{" "}
              <span style={{ color: "#ff0" }}>
                {Math.round(selected.x * 100) / 100}
              </span>
            </div>
            <div>
              y:{" "}
              <span style={{ color: "#ff0" }}>
                {Math.round(selected.y * 100) / 100}
              </span>
            </div>
            <div>
              size:{" "}
              <span style={{ color: "#ff0" }}>
                {Math.round(selected.size * 100) / 100}
              </span>
            </div>
            <div>flip: {selected.flip ? "yes" : "no"}</div>
          </div>
        ) : (
          <div style={{ color: "#555", padding: "4px 0" }}>
            Click a tassle to select
          </div>
        )}

        <hr
          style={{
            border: "none",
            borderTop: "1px solid #2a2a3a",
            margin: "10px 0",
          }}
        />

        <div style={{ color: "#666", fontSize: "10px", lineHeight: 1.7 }}>
          <div style={{ color: "#aaf", marginBottom: 2 }}>Editing:</div>
          <div>Drag → move &nbsp;|&nbsp; Scroll → resize</div>
          <div>Arrows → nudge (Shift = fine)</div>
          <div>+/− → resize &nbsp;|&nbsp; F → flip</div>
          <div>C → cycle color</div>
          <div style={{ color: "#aaf", marginTop: 8, marginBottom: 2 }}>
            Save to game:
          </div>
          <div>1. Click Export below</div>
          <div>2. Replace the file at</div>
          <div style={{ color: "#ccc" }}>
            src/components/roofTasslePositionsData.js
          </div>
        </div>

        <button
          onClick={() => {
            const data = localStorage.getItem(TASSLE_STORAGE_KEY);
            if (!data) return;
            // Ready-to-drop module — replace client/src/components/roofTasslePositionsData.js
            const moduleSrc =
              `// Baked roof-tassle positions — exported from the tassle editor\n` +
              `// DO NOT manually edit. Use the tassle editor (~ key) to make changes,\n` +
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
          EXPORT (download .js to bake in)
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
          RESET TO DEFAULTS
        </button>

        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            color: "#444",
            fontSize: "9px",
          }}
        >
          ~ / ` / Esc to close
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RoofTassleEditor;
