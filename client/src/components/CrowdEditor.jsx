import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import gameMapBg from "../assets/game-map-1.png";
import dohyoBg from "../assets/dohyo.png";

const CROWD_STORAGE_KEY = "penguin-pow-crowd-positions";

const OPACITY_MIN = 0.74;
const OPACITY_MAX = 1.0;
const SIZE_MIN = 2.0;
const SIZE_MAX = 8.0;
const computeOpacityFromSize = (size) => {
  const t = Math.min(1, Math.max(0, (size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)));
  return Math.round((OPACITY_MIN + t * (OPACITY_MAX - OPACITY_MIN)) * 100) / 100;
};

const CrowdEditor = ({ positions, crowdTypes, onClose }) => {
  const [editorPositions, setEditorPositions] = useState(
    () => positions.map(p => ({ ...p }))
  );
  const [selectedId, setSelectedId] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const containerRef = useRef(null);
  const positionsRef = useRef(editorPositions);

  useEffect(() => {
    positionsRef.current = editorPositions;
  }, [editorPositions]);

  // Auto-save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(editorPositions));
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 400);
    return () => clearTimeout(t);
  }, [editorPositions]);

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
    setTimeout(() => setSelectedId(newId), 0);
  }, [crowdTypes, pickRandomType, autoSizeForY]);

  const duplicateSelected = useCallback(() => {
    const source = positionsRef.current?.find(m => m.id === selectedId);
    if (!source) return;
    const maxId = positionsRef.current.reduce((max, m) => Math.max(max, m.id), 0);
    const newId = maxId + 1;
    setEditorPositions(prev => [...prev, { ...source, id: newId, x: source.x + 2 }]);
    setSelectedId(newId);
  }, [selectedId]);

  const deleteSelected = useCallback(() => {
    if (selectedId === null) return;
    setEditorPositions(prev => prev.filter(m => m.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Capture ALL keyboard input so game doesn't receive it
  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopImmediatePropagation();

      if (e.key === "`" || e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl+D = duplicate selected
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (selectedId === null) return;

      const step = e.shiftKey ? 0.1 : 0.5;
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); nudge(selectedId, -step, 0); break;
        case "ArrowRight": e.preventDefault(); nudge(selectedId, step, 0); break;
        case "ArrowUp":    e.preventDefault(); nudge(selectedId, 0, step); break;
        case "ArrowDown":  e.preventDefault(); nudge(selectedId, 0, -step); break;
        case "f": case "F": e.preventDefault(); flipMember(selectedId); break;
        case "=": case "+": e.preventDefault(); resizeMember(selectedId, 0.1); break;
        case "-": case "_": e.preventDefault(); resizeMember(selectedId, -0.1); break;
        case "Delete": case "Backspace": e.preventDefault(); deleteSelected(); break;
        default: break;
      }
    };

    const onKeyUp = (e) => { e.stopImmediatePropagation(); };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [selectedId, onClose, duplicateSelected, deleteSelected]);

  const nudge = useCallback((id, dx, dy) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, x: m.x + dx, y: m.y + dy } : m
    ));
  }, []);

  const flipMember = useCallback((id) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, flip: !m.flip } : m
    ));
  }, []);

  const resizeMember = useCallback((id, delta) => {
    setEditorPositions(prev => prev.map(m =>
      m.id === id ? { ...m, size: Math.max(0.3, m.size + delta) } : m
    ));
  }, []);

  const handleMouseDown = useCallback((e, memberId) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(memberId);

    const container = containerRef.current;
    if (!container) return;

    const member = positionsRef.current?.find(m => m.id === memberId);
    if (!member) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startMemberX = member.x;
    const startMemberY = member.y;
    const rect = container.getBoundingClientRect();

    const onMove = (moveEvt) => {
      const dx = ((moveEvt.clientX - startMouseX) / rect.width) * 100;
      const dy = -((moveEvt.clientY - startMouseY) / rect.height) * 100;
      setEditorPositions(prev => prev.map(m =>
        m.id === memberId ? { ...m, x: startMemberX + dx, y: startMemberY + dy } : m
      ));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleWheel = useCallback((e, memberId) => {
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setEditorPositions(prev => prev.map(m =>
      m.id === memberId ? { ...m, size: Math.max(0.3, m.size + delta) } : m
    ));
    setSelectedId(memberId);
  }, []);

  // Ctrl+click on map background = add new member at that position
  const handleMapClick = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedId(null);
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

  const selectedMember = selectedId !== null
    ? editorPositions.find(m => m.id === selectedId)
    : null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#0a0a14",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        userSelect: "none",
      }}
      onClick={() => setSelectedId(null)}
    >
      {/* Title bar */}
      <div style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        zIndex: 10,
      }}>
        <span style={{
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: "13px",
          fontWeight: "bold",
          textShadow: "0 0 8px rgba(0,255,0,0.4)",
          letterSpacing: "1px",
        }}>
          CROWD EDITOR
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

      {/* Map container (16:9) */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "82cqw",
          height: "calc(82cqw * 9 / 16)",
          maxHeight: "88cqh",
          maxWidth: "calc(88cqh * 16 / 9)",
          overflow: "hidden",
          borderRadius: "4px",
          boxShadow: "0 0 60px rgba(0,0,0,0.9)",
          cursor: "crosshair",
        }}
        onClick={handleMapClick}
      >
        {/* Map background */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${gameMapBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center -5%",
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
        }} />

        {/* Dohyo overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${dohyoBg})`,
          backgroundSize: "85% 90%",
          backgroundPosition: "50% 25%",
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
          zIndex: 1,
          transformOrigin: "50% 10%",
          transform: "perspective(700px) rotateX(5deg) scaleY(0.86) translateY(10%)",
          opacity: 0.9,
        }} />

        {/* Crowd members */}
        {editorPositions.filter(m => !m._hidden).map(member => {
          const crowdType = crowdTypes[member.typeIndex];
          if (!crowdType) return null;
          const isSelected = selectedId === member.id;

          return (
            <div
              key={member.id}
              style={{
                position: "absolute",
                left: `${member.x}%`,
                bottom: `${member.y}%`,
                width: `${member.size}%`,
                transform: `translateX(-50%) ${member.flip ? "scaleX(-1)" : ""}`,
                cursor: "grab",
                zIndex: isSelected ? 10000 : Math.floor(100 - member.y) + 2,
                pointerEvents: "auto",
                opacity: computeOpacityFromSize(member.size),
              }}
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, member.id); }}
              onWheel={(e) => handleWheel(e, member.id)}
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
              {/* ID label */}
              <div style={{
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
              }}>
                {member.id}
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Panel */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 16,
          background: "rgba(8, 8, 24, 0.95)",
          color: "#ccc",
          padding: "14px 16px",
          borderRadius: "8px",
          fontFamily: "monospace",
          fontSize: "12px",
          minWidth: "220px",
          border: "1px solid #2a2a3a",
          pointerEvents: "auto",
          zIndex: 10,
          backdropFilter: "blur(8px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: "#0f0", fontWeight: "bold", marginBottom: 4, fontSize: "13px", letterSpacing: "0.5px" }}>
          CROWD EDITOR
        </div>
        <div style={{ color: "#666", fontSize: "10px", marginBottom: 10 }}>
          {editorPositions.length} members — changes auto-save
        </div>

        {selectedMember ? (
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
            <div>opacity: {computeOpacityFromSize(selectedMember.size)}</div>
            <div>flip: {selectedMember.flip ? "yes" : "no"}</div>
          </div>
        ) : (
          <div style={{ color: "#555", padding: "4px 0" }}>Click a member to select</div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "10px 0" }} />

        <div style={{ color: "#666", fontSize: "10px", lineHeight: 1.7 }}>
          <div style={{ color: "#aaf", marginBottom: 2 }}>Adding:</div>
          <div>Ctrl+click map → new member</div>
          <div>Ctrl+D → duplicate selected</div>
          <div>Del → delete selected</div>
          <div style={{ color: "#aaf", marginTop: 4, marginBottom: 2 }}>Editing:</div>
          <div>Drag → move &nbsp;|&nbsp; Scroll → resize</div>
          <div>Arrows → nudge (Shift = fine)</div>
          <div>F → flip &nbsp;|&nbsp; +/- → resize</div>
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
          EXPORT POSITIONS (download JSON)
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

        <div style={{ marginTop: 8, textAlign: "center", color: "#444", fontSize: "9px" }}>
          ` or Esc to close
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CrowdEditor;
