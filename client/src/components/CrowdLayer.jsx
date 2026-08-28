import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import styled from "styled-components";
import crowdBoyIdle1 from "../assets/crowd-boy-idle-1-graded.png";
import crowdBoyIdle2 from "../assets/crowd-boy-idle-2-graded.png";
import crowdBoyIdle3 from "../assets/crowd-boy-idle-3-graded.png";
import crowdBoyCheering1 from "../assets/crowd-boy-cheering-1-graded.png";
import crowdBoyCheering2 from "../assets/crowd-boy-cheering-2-graded.png";
import crowdBoyCheering3 from "../assets/crowd-boy-cheering-3-graded.png";
import crowdGirlIdle1 from "../assets/crowd-girl-idle-1-graded.png";
import crowdGirlCheering1 from "../assets/crowd-girl-cheering-1-graded.png";
import crowdGeishaIdle1 from "../assets/crowd-geisha-idle-1-graded.png";
import crowdGeishaCheering1 from "../assets/crowd-geisha-cheering-1-graded.png";
import crowdSalarymanIdle1 from "../assets/crowd-salaryman-idle-1-graded.png";
import crowdSalarymanCheering1 from "../assets/crowd-salaryman-cheering-1-graded.png";
import crowdSalarymanIdle2 from "../assets/crowd-salaryman-idle-2-graded.png";
import crowdSalarymanCheering2 from "../assets/crow-salaryman-cheering-2-graded.png";
import crowdOldmanIdle1 from "../assets/crowd-oldman-idle-1-graded.png";
import crowdOldmanCheering1 from "../assets/crowd-oldman-cheering-1-graded.png";
import crowdOyakata from "../assets/crowd-oyakata.png";
import crowdOyakataFront from "../assets/crowd-oyakata-front.png";
import crowdOyakataBack from "../assets/crowd-oyakata-back.png";
import crowdSideIdle1 from "../assets/crowd-side-idle-1-graded.png";
import crowdSideCheering1 from "../assets/crowd-side-cheering-1-graded.png";
import crowdSideIdle2 from "../assets/crowd-side-idle-2-graded.png";
import crowdSideCheering2 from "../assets/crowd-side-cheering-2-graded.png";
import crowdBoySideIdle1 from "../assets/crowd-boy-side-idle-1-graded.png";
import crowdBoySideCheering1 from "../assets/crowd-boy-side-cheering-1-graded.png";
import crowdGeishaSideIdle1 from "../assets/crowd-geisha-side-idle-1-graded.png";
import crowdGeishaSideCheering1 from "../assets/crowd-geisha-side-cheering-1-graded.png";
import crowdGirlSideIdle1 from "../assets/crowd-girl-side-idle-1-graded.png";
import crowdGirlSideCheering1 from "../assets/crowd-girl-side-cheering-1-graded.png";
import crowdSalarymanSideIdle1 from "../assets/crowd-salaryman-side-idle-1-graded.png";
import crowdSalarymanSideCheering1 from "../assets/crowd-salaryman-side-cheering-1-graded.png";
import crowdSalarymanSideIdle2 from "../assets/crowd-salaryman-side-idle-2-graded.png";
import crowdSalarymanSideCheering2 from "../assets/crowd-salaryman-side-cheering-2-graded.png";
import CROWD_POSITIONS from "./crowdPositionsData";
import winnerSound from "../sounds/winner-sound.ogg";
import { playBuffer, preloadSound } from "../utils/audioEngine";
import { bashoCrowdFill } from "../config/bashoConfig";
import {
  drawCrowdStand,
  preloadCrowdImageUrls,
  sizeCrowdCanvas,
  CROWD_CANVAS_SCALE,
  whenCrowdImagesReady,
} from "./crowdStandCanvas";

// Editor (+ dohyo-style.webp) only loads when opened — keeps ~6MB style out of
// the default player graph.
const CrowdEditor = lazy(() => import("./CrowdEditor"));

preloadSound(winnerSound);

// Stands live on one canvas (see crowdStandCanvas.js). This host is just a
// slot between the map (z:-1) and the dohyo (z:1). Depth wash is painted
// onto the canvas (source-atop). arena-lighting owns house falloff.
const CrowdContainer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  contain: layout style paint;
`;

const CrowdStandCanvasEl = styled.canvas`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const ForegroundCrowdContainer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4; /* Above dohyo (1), ice-reflection-clip (2), roof tassles (3) */
  contain: layout style paint;
`;

const CrowdMember = styled.img.attrs((props) => ({
  style: {
    width: `${props.$size}%`,
    left: `${props.$x}%`,
    bottom: `${props.$y}%`,
    transform: `translateX(-50%) ${props.$flip ? "scaleX(-1)" : ""}`,
    zIndex:
      props.$customZIndex !== undefined
        ? props.$customZIndex
        : Math.floor(100 - props.$y),
    filter: props.$filter,
  },
}))`
  position: absolute;
  height: auto;
  transform-origin: center 80%;
  pointer-events: none;
  backface-visibility: hidden;
`;

const OYAKATA_FILTER = "brightness(0.52) saturate(0.72) contrast(0.94)";

// Crowd member types - easily expandable for future additions
// sizeMultiplier adjusts for different image dimensions to keep them uniform
// yOffsetRatio adjusts vertical position as a ratio of size (scales with distance)
// weight controls how frequently this type appears (higher = more common)
// Red beanie (1) and yellow striped beanie (2) retired from the random pool —
// assets stay loaded so the editor / old saves can remap off them cleanly.
const RETIRED_CROWD_TYPE_INDICES = new Set([1, 2]);

const CROWD_TYPES = [
  { idle: crowdBoyIdle1, cheering: crowdBoyCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdBoyIdle2, cheering: crowdBoyCheering2, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 }, // retired: red hat
  { idle: crowdBoyIdle3, cheering: crowdBoyCheering3, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 }, // retired: yellow hat
  { idle: crowdGirlIdle1, cheering: crowdGirlCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdGeishaIdle1, cheering: crowdGeishaCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0.08 },
  { idle: crowdSalarymanIdle1, cheering: crowdSalarymanCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdSalarymanIdle2, cheering: crowdSalarymanCheering2, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdOldmanIdle1, cheering: crowdOldmanCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 1.5 },
  { idle: crowdOyakata, cheering: crowdOyakata, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },
  { idle: crowdOyakataFront, cheering: crowdOyakataFront, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },
  { idle: crowdOyakataBack, cheering: crowdOyakataBack, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },
  { idle: crowdSideIdle1, cheering: crowdSideCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },
  { idle: crowdSideIdle2, cheering: crowdSideCheering2, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },
  { idle: crowdBoySideIdle1, cheering: crowdBoySideCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },       // index 13
  { idle: crowdGeishaSideIdle1, cheering: crowdGeishaSideCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },  // index 14
  { idle: crowdGirlSideIdle1, cheering: crowdGirlSideCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 },     // index 15
  { idle: crowdSalarymanSideIdle1, cheering: crowdSalarymanSideCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 }, // index 16
  { idle: crowdSalarymanSideIdle2, cheering: crowdSalarymanSideCheering2, sizeMultiplier: 1, yOffsetRatio: 0, weight: 0 }, // index 17
];

const CROWD_SPRITE_URLS = [
  ...new Set(CROWD_TYPES.flatMap((t) => [t.idle, t.cheering])),
];
preloadCrowdImageUrls(CROWD_SPRITE_URLS);

const generateCrowdPositions = () => {
  return CROWD_POSITIONS.map(m => ({
    ...m,
    opacity: 1,
    yOffsetRatio: 0,
    sizeMultiplier: 1,
  }));
};


const CROWD_STORAGE_KEY = "penguin-pow-crowd-positions";
const CROWD_VERSION_KEY = "penguin-pow-crowd-version";
const CURRENT_CROWD_VERSION = 10;

// Side-profile seats (plus the two ringside oyakata). Art is drawn facing one
// way; CSS `flip` mirrors it. Keep everyone looking toward the ring center.
const SIDE_CROWD_TYPE_INDICES = new Set([8, 11, 12, 13, 14, 15, 16, 17]);
/** Side types whose PNG faces right; all other side types face left. */
const SIDE_CROWD_NATIVE_RIGHT = new Set([8, 12, 15, 16]);

/** `flip` so a side spectator at `x` looks toward the dohyo (x=50). */
const sideCrowdFlipTowardRing = (typeIndex, x) => {
  const nativeRight = SIDE_CROWD_NATIVE_RIGHT.has(typeIndex);
  const onLeft = x < 50;
  return nativeRight !== onLeft;
};

const correctSideCrowdFacing = (positions) =>
  positions.map((m) => {
    if (!SIDE_CROWD_TYPE_INDICES.has(m.typeIndex)) return m;
    const flip = sideCrowdFlipTowardRing(m.typeIndex, m.x);
    return m.flip === flip ? m : { ...m, flip };
  });

const loadCrowdPositions = () => {
  const saved = localStorage.getItem(CROWD_STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
    return generateCrowdPositions();
  }

  try {
    let parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
      return generateCrowdPositions();
    }

    const version = parseInt(localStorage.getItem(CROWD_VERSION_KEY) || "1", 10);

    if (version < 2) {
      // Migration v1→v2: scale up top stadium members by 1.3x
      // Only affects original generated members (not editor-added ones)
      const defaults = generateCrowdPositions();
      const originalIds = new Set(defaults.map(m => m.id));
      const TOP_STADIUM_Y_THRESHOLD = 58;
      const SCALE = 1.3;

      parsed = parsed.map(m => {
        if (originalIds.has(m.id) && m.y >= TOP_STADIUM_Y_THRESHOLD) {
          return { ...m, size: Math.round(m.size * SCALE * 100) / 100 };
        }
        return m;
      });

      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "2");
    }

    if (version < 3) {
      parsed = parsed.map(m => m.id === 594 ? { ...m, opacity: 1 } : m);
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "3");
    }

    if (version < 4) {
      // Migration v3→v4: sprites were trimmed so yOffsetRatio is now 0 for all types.
      // Remove the old Y offset that was baked into each member's position.
      parsed = parsed.map(m => {
        const oldYOR = m.yOffsetRatio || 0;
        if (oldYOR === 0) return { ...m, yOffsetRatio: 0 };
        const oldYOffset = m.size * oldYOR;
        return { ...m, y: m.y - oldYOffset, yOffsetRatio: 0 };
      });
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "4");
    }

    if (version < 5) {
      // Migration v4→v5: sprites trimmed + sizeMultiplier normalized to 1.
      // Convert each member's size back to raw size (remove old multiplier).
      parsed = parsed.map(m => {
        const oldMult = m.sizeMultiplier || 1;
        if (oldMult === 1) return { ...m, sizeMultiplier: 1 };
        return { ...m, size: m.size / oldMult, sizeMultiplier: 1 };
      });
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "5");
    }

    if (version < 6) {
      parsed = parsed.map(m => ({ ...m, opacity: 1 }));
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "6");
    }

    if (version < 7) {
      // Migration v6→v7: append new side-angle crowd members (12 total: 6 types × 2 flips)
      const maxId = parsed.reduce((max, m) => Math.max(max, m.id), 0);
      const newSideSize = 10.37;
      const newSideMembers = [
        { typeIndex: 13, flip: false, x: 15 },
        { typeIndex: 13, flip: true,  x: 20 },
        { typeIndex: 15, flip: false, x: 27 },
        { typeIndex: 15, flip: true,  x: 32 },
        { typeIndex: 15, flip: false, x: 39 },
        { typeIndex: 15, flip: true,  x: 44 },
        { typeIndex: 16, flip: false, x: 51 },
        { typeIndex: 16, flip: true,  x: 56 },
        { typeIndex: 17, flip: false, x: 63 },
        { typeIndex: 17, flip: true,  x: 68 },
        { typeIndex: 12, flip: false, x: 75 },
        { typeIndex: 12, flip: true,  x: 80 },
      ];
      newSideMembers.forEach((m, i) => {
        parsed.push({
          id: maxId + 1 + i,
          x: m.x,
          y: 30,
          size: newSideSize,
          typeIndex: m.typeIndex,
          flip: m.flip,
          opacity: 1,
          yOffsetRatio: 0,
          sizeMultiplier: 1,
        });
      });
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "7");
    }

    if (version < 8) {
      // Migration v7→v8: fixed side-geisha seats (typeIndex 14) always showed
      // regardless of geisha weight. Remap them to other side types.
      const sideAlternates = [13, 15, 16, 17, 12];
      parsed = parsed.map((m) => {
        if (m.typeIndex !== 14) return m;
        const alt = sideAlternates[((m.id * 7) >>> 0) % sideAlternates.length];
        return { ...m, typeIndex: alt };
      });
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "8");
    }

    if (version < 9) {
      // Migration v8→v9: a couple right-side seats had flip=false on
      // right-facing art, so they looked away from the ring.
      parsed = correctSideCrowdFacing(parsed);
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, "9");
    }

    if (version < 10) {
      // Migration v9→v10: opening the crowd editor during a BASHO match used
      // to auto-save the fill-thinned seat list over the full house. If the
      // stored set is far smaller than the baked layout, restore defaults.
      const defaults = generateCrowdPositions();
      if (parsed.length < defaults.length * 0.7) {
        parsed = defaults.map((m) => ({ ...m }));
      }
      localStorage.setItem(CROWD_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
    }

    return correctSideCrowdFacing(parsed);
  } catch (_) {
    localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
    return generateCrowdPositions();
  }
};

// Spatial neighborhood for anti-clumping (CSS % coords). Same type is avoided
// among seats that sit roughly beside / in the adjacent row.
const CROWD_NEIGHBOR_X = 5.5;
const CROWD_NEIGHBOR_Y = 6.5;

const FULL_CROWD_WEIGHT = () => CROWD_TYPES.reduce((sum, t) => sum + t.weight, 0);

const rollCrowdTypeFromFullPool = () => {
  let roll = Math.random() * FULL_CROWD_WEIGHT();
  for (let i = 0; i < CROWD_TYPES.length; i++) {
    roll -= CROWD_TYPES[i].weight;
    if (roll <= 0) return i;
  }
  return 0;
};

// Soft anti-clump: keep base rarity intact. Hard-excluding neighbors was
// inflating rare types (geisha) whenever common neighbors filled the ring.
const pickWeightedCrowdType = (excludeTypes) => {
  const attempts = 10;
  for (let n = 0; n < attempts; n++) {
    const pick = rollCrowdTypeFromFullPool();
    if (!excludeTypes.has(pick) || n === attempts - 1) return pick;
  }
  return 0;
};

// Re-roll typeIndex for regular crowd members (weight > 0) each session.
// Special characters like oyakata (weight === 0) keep their assigned type.
// Retired hat variants are always remapped even though their weight is 0.
// Preserves the visual size/position by swapping type multipliers.
// Assigns row-wise (bottom→top, left→right) and skips types already used by
// nearby seats so the same sprite doesn't tile in clumps.
const randomizeCrowdTypes = (positions) => {
  const resultById = new Map();
  const assigned = []; // { id, x, y, typeIndex } for neighbor queries

  const assignable = [];
  positions.forEach((m) => {
    const currentType = CROWD_TYPES[m.typeIndex];
    const isRetired = RETIRED_CROWD_TYPE_INDICES.has(m.typeIndex);
    if (!isRetired && (!currentType || currentType.weight === 0)) {
      resultById.set(m.id, m);
      return;
    }
    assignable.push(m);
  });

  assignable.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  for (const m of assignable) {
    const currentType = CROWD_TYPES[m.typeIndex];
    const exclude = new Set();
    for (const n of assigned) {
      if (
        Math.abs(n.x - m.x) <= CROWD_NEIGHBOR_X &&
        Math.abs(n.y - m.y) <= CROWD_NEIGHBOR_Y
      ) {
        exclude.add(n.typeIndex);
      }
    }

    const newTypeIndex = pickWeightedCrowdType(exclude);
    const newType = CROWD_TYPES[newTypeIndex];
    const oldMult = m.sizeMultiplier || currentType?.sizeMultiplier || 1;
    const oldYOR = m.yOffsetRatio || currentType?.yOffsetRatio || 0;
    const newMult = newType.sizeMultiplier || 1;
    const newYOR = newType.yOffsetRatio || 0;

    const rawSize = m.size / oldMult;
    const rawY = m.y - m.size * oldYOR;
    const newSize = rawSize * newMult;
    const newY = rawY + newSize * newYOR;

    const next = {
      ...m,
      typeIndex: newTypeIndex,
      size: newSize,
      y: newY,
      sizeMultiplier: newMult,
      yOffsetRatio: newYOR,
      flip: Math.random() > 0.5,
    };
    resultById.set(m.id, next);
    assigned.push({ id: m.id, x: next.x, y: next.y, typeIndex: newTypeIndex });
  }

  return positions.map((m) => resultById.get(m.id) || m);
};

// Thin the stands for early BASHO ranks. VIP / fixed seats (weight === 0) stay;
// regular seats keep/drop via a stable hash of id so the house looks consistent
// for a given fill factor across remounts within the same session.
const applyCrowdFill = (positions, fill) => {
  if (fill == null || fill >= 1) return positions;
  const threshold = Math.max(0, Math.min(1, fill)) * 1000;
  return positions.filter((m) => {
    const t = CROWD_TYPES[m.typeIndex];
    if (!t || t.weight === 0) return true;
    const hash = ((m.id * 2654435761) >>> 0) % 1000;
    return hash < threshold;
  });
};

const buildCrowd = (bashoRank = null) => {
  const fill = bashoRank ? bashoCrowdFill(bashoRank) : 1;
  // Re-assert ringward facing after load/randomize — side seats are weight-0
  // so types stick, but editor / old saves can still store a bad flip.
  return correctSideCrowdFacing(
    applyCrowdFill(randomizeCrowdTypes(loadCrowdPositions()), fill)
  );
};

const CHEER_DURATION_MS = 3500;
const CHEER_VOLUME = { light: 0.003, medium: 0.006, heavy: 0.01 };
const CHEER_PITCH = { light: 1.0, medium: 1.0, heavy: 1.12 };
const CHEER_COOLDOWN_MS = 2000;
const CHEER_STAGGER_MS = { light: 500, medium: 400, heavy: 250 };
const CHEER_WINDDOWN_MS = 1000;
const CHEER_TICK_MS = 100;
const CHEER_TOGGLE_MIN = 200;
const CHEER_TOGGLE_MAX = 600;

const CrowdLayer = ({ crowdEvent = null, bashoRank = null }) => {
  const [crowdPositions, setCrowdPositions] = useState(() => buildCrowd(bashoRank));
  const bashoRankKey = bashoRank
    ? `${bashoRank.division}:${bashoRank.number ?? ""}:${bashoRank.title ?? ""}`
    : null;
  const bashoRankKeyRef = useRef(bashoRankKey);

  useEffect(() => {
    if (bashoRankKeyRef.current === bashoRankKey) return;
    bashoRankKeyRef.current = bashoRankKey;
    setCrowdPositions(buildCrowd(bashoRank));
  }, [bashoRankKey, bashoRank]);

  const normalCrowd = useMemo(
    () => crowdPositions.filter((m) => m.customZIndex === undefined),
    [crowdPositions],
  );
  const foregroundCrowd = useMemo(
    () => crowdPositions.filter((m) => m.customZIndex !== undefined),
    [crowdPositions],
  );

  const standCanvasRef = useRef(null);
  const standCtxRef = useRef(null);
  const containerRef = useRef(null);
  const cheeringIdsRef = useRef(new Set());
  const imagesReadyRef = useRef(false);
  const drawRafRef = useRef(0);
  const normalCrowdRef = useRef(normalCrowd);
  normalCrowdRef.current = normalCrowd;

  const paintStand = useCallback(() => {
    const canvas = standCanvasRef.current;
    const ctx = standCtxRef.current;
    const host = containerRef.current;
    if (!canvas || !ctx || !host || !imagesReadyRef.current) return;
    const cssW = host.clientWidth || 1280;
    const cssH = host.clientHeight || 720;
    sizeCrowdCanvas(canvas, cssW, cssH, CROWD_CANVAS_SCALE);
    drawCrowdStand(ctx, {
      members: normalCrowdRef.current,
      types: CROWD_TYPES,
      cheeringIds: cheeringIdsRef.current,
      cssW,
      cssH,
    });
  }, []);

  const schedulePaint = useCallback(() => {
    if (drawRafRef.current) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0;
      paintStand();
    });
  }, [paintStand]);

  useEffect(() => {
    const canvas = standCanvasRef.current;
    if (!canvas) return;
    standCtxRef.current = canvas.getContext("2d", { alpha: true });
    let cancelled = false;
    whenCrowdImagesReady(CROWD_SPRITE_URLS).then(() => {
      if (cancelled) return;
      imagesReadyRef.current = true;
      paintStand();
    });
    return () => {
      cancelled = true;
    };
  }, [paintStand]);

  useEffect(() => {
    schedulePaint();
  }, [normalCrowd, schedulePaint]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => schedulePaint());
    ro.observe(host);
    return () => ro.disconnect();
  }, [schedulePaint]);

  const [editorMode, setEditorMode] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "`") {
        e.preventDefault();
        setEditorMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorMode(false);
    setCrowdPositions(buildCrowd(bashoRank));
  }, [bashoRank]);

  const lastCheerTimeRef = useRef(0);
  const cheerStartRef = useRef(0);
  const memberParamsRef = useRef(new Map());
  const cheerTickIntervalRef = useRef(null);
  const cheerTimeoutRef = useRef(null);
  const crowdPositionsRef = useRef(crowdPositions);
  crowdPositionsRef.current = crowdPositions;
  const isCheeringRef = useRef(false);

  const resetAllSpritesToIdle = () => {
    cheeringIdsRef.current.clear();
    memberParamsRef.current.forEach((p) => {
      p.showingCheering = false;
    });
    schedulePaint();
  };

  useEffect(() => {
    return () => {
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!crowdEvent) return;

    if (crowdEvent.type === "reset") {
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
      if (isCheeringRef.current) resetAllSpritesToIdle();
      isCheeringRef.current = false;
      return;
    }

    if (crowdEvent.type === "cheer") {
      const now = Date.now();
      if (crowdEvent.intensity !== "heavy" && now - lastCheerTimeRef.current < CHEER_COOLDOWN_MS) return;
      lastCheerTimeRef.current = now;

      const volume = CHEER_VOLUME[crowdEvent.intensity] || 0.003;

      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);

      const stagger = CHEER_STAGGER_MS[crowdEvent.intensity] || 500;
      const windDownStart = CHEER_DURATION_MS - CHEER_WINDDOWN_MS;

      const params = new Map();
      crowdPositionsRef.current.forEach((member) => {
        const crowdType = CROWD_TYPES[member.typeIndex];
        if (crowdType.idle === crowdType.cheering) return;
        params.set(member.id, {
          startDelay: Math.random() * stagger,
          togglePeriod: CHEER_TOGGLE_MIN + Math.random() * (CHEER_TOGGLE_MAX - CHEER_TOGGLE_MIN),
          windDownAt: windDownStart + Math.random() * CHEER_WINDDOWN_MS,
          showingCheering: false,
        });
      });
      memberParamsRef.current = params;
      cheerStartRef.current = performance.now();
      isCheeringRef.current = true;

      cheerTickIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - cheerStartRef.current;
        let dirty = false;
        memberParamsRef.current.forEach((p, memberId) => {
          let shouldCheer = false;
          if (elapsed >= p.startDelay && elapsed <= p.windDownAt) {
            const memberElapsed = elapsed - p.startDelay;
            const cyclePos = Math.floor(memberElapsed / p.togglePeriod);
            shouldCheer = cyclePos % 2 === 0;
          }
          if (shouldCheer === p.showingCheering) return;
          p.showingCheering = shouldCheer;
          if (shouldCheer) cheeringIdsRef.current.add(memberId);
          else cheeringIdsRef.current.delete(memberId);
          dirty = true;
        });
        if (dirty) schedulePaint();
      }, CHEER_TICK_MS);

      cheerTimeoutRef.current = setTimeout(() => {
        clearInterval(cheerTickIntervalRef.current);
        resetAllSpritesToIdle();
        isCheeringRef.current = false;
      }, CHEER_DURATION_MS);

      const pitch = CHEER_PITCH[crowdEvent.intensity] || 1.0;
      if (!crowdEvent.skipCheerSfx) {
        playBuffer(winnerSound, volume, CHEER_DURATION_MS, pitch);
      }
    }
  }, [crowdEvent, schedulePaint]);

  return (
    <>
      <CrowdContainer className="crowd-stand-host" ref={containerRef}>
        <CrowdStandCanvasEl ref={standCanvasRef} aria-hidden="true" />
      </CrowdContainer>
      {foregroundCrowd.length > 0 && (
        <ForegroundCrowdContainer className="crowd-fg-host">
          {foregroundCrowd.map((member) => {
            const crowdType = CROWD_TYPES[member.typeIndex];
            const needsFilter =
              crowdType.idle === crowdType.cheering && member.applyDarkFilter;
            return (
              <CrowdMember
                key={member.id}
                src={crowdType.idle}
                $x={member.x}
                $y={member.y}
                $size={member.size}
                $flip={member.flip}
                $filter={needsFilter ? OYAKATA_FILTER : "brightness(0.82)"}
                $customZIndex={member.customZIndex}
                alt=""
                draggable={false}
              />
            );
          })}
        </ForegroundCrowdContainer>
      )}
      {editorMode && (
        <Suspense fallback={null}>
          <CrowdEditor
            positions={loadCrowdPositions()}
            crowdTypes={CROWD_TYPES}
            onClose={handleEditorClose}
          />
        </Suspense>
      )}
    </>
  );
};

export default CrowdLayer;
