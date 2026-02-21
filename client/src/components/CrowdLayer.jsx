import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import crowdBoyIdle1 from "../assets/crowd-boy-idle-1.png";
import crowdBoyIdle2 from "../assets/crowd-boy-idle-2.png";
import crowdBoyIdle3 from "../assets/crowd-boy-idle-3.png";
import crowdBoyCheering1 from "../assets/crowd-boy-cheering-1.png";
import crowdBoyCheering2 from "../assets/crowd-boy-cheering-2.png";
import crowdBoyCheering3 from "../assets/crowd-boy-cheering-3.png";
import crowdGirlIdle1 from "../assets/crowd-girl-idle-1.png";
import crowdGirlCheering1 from "../assets/crowd-girl-cheering-1.png";
import crowdGeishaIdle1 from "../assets/crowd-geisha-idle-1.png";
import crowdGeishaCheering1 from "../assets/crowd-geisha-cheering-1.png";
import crowdSalarymanIdle1 from "../assets/crowd-salaryman-idle-1.png";
import crowdSalarymanCheering1 from "../assets/crowd-salaryman-cheering-1.png";
import crowdSalarymanIdle2 from "../assets/crowd-salaryman-idle-2.png";
import crowdSalarymanCheering2 from "../assets/crow-salaryman-cheering-2.png";
import crowdOldmanIdle1 from "../assets/crowd-oldman-idle-1.png";
import crowdOldmanCheering1 from "../assets/crowd-oldman-cheering-1.png";
import crowdOyakata from "../assets/crowd-oyakata.png";
import crowdOyakataFront from "../assets/crowd-oyakata-front.png";
import crowdOyakataBack from "../assets/crowd-oyakata-back.png";
import crowdSideIdle1 from "../assets/crowd-side-idle-1.png";
import crowdSideCheering1 from "../assets/crowd-side-cheering-1.png";
import crowdSideIdle2 from "../assets/crowd-side-idle-2.png";
import crowdSideCheering2 from "../assets/crowd-side-cheering-2.png";
import crowdBoySideIdle1 from "../assets/crowd-boy-side-idle-1.png";
import crowdBoySideCheering1 from "../assets/crowd-boy-side-cheering-1.png";
import crowdGeishaSideIdle1 from "../assets/crowd-geisha-side-idle-1.png";
import crowdGeishaSideCheering1 from "../assets/crowd-geisha-side-cheering-1.png";
import crowdGirlSideIdle1 from "../assets/crowd-girl-side-idle-1.png";
import crowdGirlSideCheering1 from "../assets/crowd-girl-side-cheering-1.png";
import crowdSalarymanSideIdle1 from "../assets/crowd-salaryman-side-idle-1.png";
import crowdSalarymanSideCheering1 from "../assets/crowd-salaryman-side-cheering-1.png";
import crowdSalarymanSideIdle2 from "../assets/crowd-salaryman-side-idle-2.png";
import crowdSalarymanSideCheering2 from "../assets/crowd-salaryman-side-cheering-2.png";
import CrowdEditor from "./CrowdEditor";
import CROWD_POSITIONS from "./crowdPositionsData";
import winnerSound from "../sounds/winner-sound.wav";
import { playBuffer, preloadSound } from "../utils/audioEngine";
import { getGlobalVolume } from "./Settings";

preloadSound(winnerSound);

// Preload crowd images to prevent jank during first render
const preloadImage = (src) => {
  const img = new Image();
  img.src = src;
};

// Preload all crowd sprites at module load time
const preloadCrowdImages = () => {
  // Idle sprites
  preloadImage(crowdBoyIdle1);
  preloadImage(crowdBoyIdle2);
  preloadImage(crowdBoyIdle3);
  preloadImage(crowdGirlIdle1);
  preloadImage(crowdGeishaIdle1);
  preloadImage(crowdSalarymanIdle1);
  preloadImage(crowdSalarymanIdle2);
  preloadImage(crowdOldmanIdle1);
  preloadImage(crowdOyakata);
  preloadImage(crowdOyakataFront);
  preloadImage(crowdOyakataBack);
  preloadImage(crowdSideIdle1);
  preloadImage(crowdSideIdle2);
  preloadImage(crowdBoySideIdle1);
  preloadImage(crowdGeishaSideIdle1);
  preloadImage(crowdGirlSideIdle1);
  preloadImage(crowdSalarymanSideIdle1);
  preloadImage(crowdSalarymanSideIdle2);
  
  // Cheering sprites
  preloadImage(crowdBoyCheering1);
  preloadImage(crowdBoyCheering2);
  preloadImage(crowdBoyCheering3);
  preloadImage(crowdGirlCheering1);
  preloadImage(crowdGeishaCheering1);
  preloadImage(crowdSalarymanCheering1);
  preloadImage(crowdSalarymanCheering2);
  preloadImage(crowdOldmanCheering1);
  preloadImage(crowdSideCheering1);
  preloadImage(crowdSideCheering2);
  preloadImage(crowdBoySideCheering1);
  preloadImage(crowdGeishaSideCheering1);
  preloadImage(crowdGirlSideCheering1);
  preloadImage(crowdSalarymanSideCheering1);
  preloadImage(crowdSalarymanSideCheering2);
};

// Execute preload immediately when module loads
preloadCrowdImages();

// Container for the entire crowd layer
const CrowdContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0; /* Between game map background (-1) and dohyo overlay (1) */
  contain: layout style paint; /* Performance: isolate rendering from rest of page */
  filter: saturate(0.82) brightness(0.78) contrast(0.95);
  
  /* Simple shadow overlay - keeps background from competing with fighters */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.22);
    pointer-events: none;
    z-index: 9999;
  }
`;

// Container for foreground crowd members that appear above the dohyo
const ForegroundCrowdContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2; /* Above dohyo overlay (1) */
  contain: layout style paint;
  filter: saturate(0.88) brightness(0.82) contrast(0.98);
`;

// Subtle idle sway + breathing animation - pivots from bottom so upper body moves
// Uses scaleY for breathing (stretches from bottom, legs stay planted)
const idleSway = `
  @keyframes crowdSway {
    0%, 100% {
      transform: translateX(-50%) scaleY(1) rotate(0deg);
    }
    25% {
      transform: translateX(-50%) scaleY(1.012) rotate(0.4deg);
    }
    50% {
      transform: translateX(-50%) scaleY(1.018) rotate(0deg);
    }
    75% {
      transform: translateX(-50%) scaleY(1.012) rotate(-0.4deg);
    }
  }
  
  @keyframes crowdSwayFlipped {
    0%, 100% {
      transform: translateX(-50%) scaleX(-1) scaleY(1) rotate(0deg);
    }
    25% {
      transform: translateX(-50%) scaleX(-1) scaleY(1.012) rotate(-0.4deg);
    }
    50% {
      transform: translateX(-50%) scaleX(-1) scaleY(1.018) rotate(0deg);
    }
    75% {
      transform: translateX(-50%) scaleX(-1) scaleY(1.012) rotate(0.4deg);
    }
  }

`;

// Inject keyframes once
const StyleInjector = styled.div`
  ${idleSway}
`;

// Individual crowd member sprite - uses attrs for dynamic styles to avoid 200+ generated classes
const CrowdMember = styled.img.attrs((props) => ({
  style: {
    width: `${props.$size}%`,
    left: `${props.$x}%`,
    bottom: `${props.$y}%`,
    transform: `translateX(-50%) ${props.$flip ? "scaleX(-1)" : ""}`,
    opacity: props.$opacity ?? 1,
    zIndex: props.$customZIndex !== undefined ? props.$customZIndex : Math.floor(100 - props.$y),
    filter: `${props.$applyDarkFilter
      ? "brightness(0.58) saturate(0.75) contrast(0.95)"
      : "saturate(1.02) brightness(0.98)"}${props.$blur > 0 ? ` blur(${props.$blur}px)` : ""}`,
    animation: props.$shouldAnimate
      ? `${props.$flip ? "crowdSwayFlipped" : "crowdSway"} ${2.5 + (props.$animOffset * 0.8)}s ease-in-out infinite`
      : "none",
    animationDelay: props.$shouldAnimate ? `${props.$animOffset * -2}s` : undefined,
  },
}))`
  position: absolute;
  height: auto;
  transform-origin: center 80%;
  pointer-events: none;
  backface-visibility: hidden;
  ${(props) => props.$shouldAnimate ? "will-change: transform;" : ""}
`;

// Compute opacity from member size for depth fade effect.
// Bigger members (closer) are more opaque, smaller ones (farther) fade out.
const OPACITY_MIN = 0.74;
const OPACITY_MAX = 1.0;
const SIZE_MIN = 2.0;
const SIZE_MAX = 8.0;
const computeOpacityFromSize = (size) => {
  const t = Math.min(1, Math.max(0, (size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)));
  return Math.round((OPACITY_MIN + t * (OPACITY_MAX - OPACITY_MIN)) * 100) / 100;
};

const BLUR_Y_START = 50;
const BLUR_Y_MAX = 90;
const BLUR_PX_MAX = 2.2;
const computeBlurFromY = (y) => {
  if (y <= BLUR_Y_START) return 0;
  const t = Math.min(1, (y - BLUR_Y_START) / (BLUR_Y_MAX - BLUR_Y_START));
  return Math.round(BLUR_PX_MAX * t * t * 100) / 100;
};

// Crowd member types - easily expandable for future additions
// sizeMultiplier adjusts for different image dimensions to keep them uniform
// yOffsetRatio adjusts vertical position as a ratio of size (scales with distance)
// weight controls how frequently this type appears (higher = more common)
const CROWD_TYPES = [
  { idle: crowdBoyIdle1, cheering: crowdBoyCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdBoyIdle2, cheering: crowdBoyCheering2, sizeMultiplier: 1, yOffsetRatio: 0, weight: 1 },
  { idle: crowdBoyIdle3, cheering: crowdBoyCheering3, sizeMultiplier: 1, yOffsetRatio: 0, weight: 2 },
  { idle: crowdGirlIdle1, cheering: crowdGirlCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 3 },
  { idle: crowdGeishaIdle1, cheering: crowdGeishaCheering1, sizeMultiplier: 1, yOffsetRatio: 0, weight: 1 },
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
const CURRENT_CROWD_VERSION = 7;

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
        { typeIndex: 14, flip: false, x: 27 },
        { typeIndex: 14, flip: true,  x: 32 },
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
      localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
    }

    return parsed;
  } catch (_) {
    localStorage.setItem(CROWD_VERSION_KEY, String(CURRENT_CROWD_VERSION));
    return generateCrowdPositions();
  }
};

// Re-roll typeIndex for regular crowd members (weight > 0) each session.
// Special characters like oyakata (weight === 0) keep their assigned type.
// Preserves the visual size/position by swapping type multipliers.
const randomizeCrowdTypes = (positions) => {
  const totalWeight = CROWD_TYPES.reduce((sum, t) => sum + t.weight, 0);

  return positions.map(m => {
    const currentType = CROWD_TYPES[m.typeIndex];
    if (!currentType || currentType.weight === 0) return m;

    let roll = Math.random() * totalWeight;
    let newTypeIndex = 0;
    for (let i = 0; i < CROWD_TYPES.length; i++) {
      roll -= CROWD_TYPES[i].weight;
      if (roll <= 0) { newTypeIndex = i; break; }
    }

    const newType = CROWD_TYPES[newTypeIndex];
    const oldMult = m.sizeMultiplier || currentType.sizeMultiplier || 1;
    const oldYOR = m.yOffsetRatio || currentType.yOffsetRatio || 0;
    const newMult = newType.sizeMultiplier || 1;
    const newYOR = newType.yOffsetRatio || 0;

    const rawSize = m.size / oldMult;
    const rawY = m.y - m.size * oldYOR;
    const newSize = rawSize * newMult;
    const newY = rawY + newSize * newYOR;

    return {
      ...m,
      typeIndex: newTypeIndex,
      size: newSize,
      y: newY,
      sizeMultiplier: newMult,
      yOffsetRatio: newYOR,
      flip: Math.random() > 0.5,
    };
  });
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

const CrowdLayer = ({ crowdEvent = null }) => {
  const [crowdPositions, setCrowdPositions] = useState(
    () => randomizeCrowdTypes(loadCrowdPositions())
  );

  const normalCrowd = useMemo(() => crowdPositions.filter(m => m.customZIndex === undefined), [crowdPositions]);
  const foregroundCrowd = useMemo(() => crowdPositions.filter(m => m.customZIndex !== undefined), [crowdPositions]);

  // Crowd Editor Mode (dev tool) — press ` to toggle
  const [editorMode, setEditorMode] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "`") {
        e.preventDefault();
        setEditorMode(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorMode(false);
    setCrowdPositions(randomizeCrowdTypes(loadCrowdPositions()));
  }, []);

  const [isCheeringActive, setIsCheeringActive] = useState(false);
  const [, setCheerTick] = useState(0);

  const lastCheerTimeRef = useRef(0);
  const cheerStartRef = useRef(0);
  const memberParamsRef = useRef(new Map());
  const cheerTickIntervalRef = useRef(null);
  const cheerTimeoutRef = useRef(null);
  const crowdPositionsRef = useRef(crowdPositions);
  crowdPositionsRef.current = crowdPositions;

  useEffect(() => {
    return () => {
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!crowdEvent) return;

    if (crowdEvent.type === "reset") {
      setIsCheeringActive(false);
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
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
      crowdPositionsRef.current.forEach(member => {
        const crowdType = CROWD_TYPES[member.typeIndex];
        if (crowdType.idle === crowdType.cheering) return;
        params.set(member.id, {
          startDelay: Math.random() * stagger,
          togglePeriod: CHEER_TOGGLE_MIN + Math.random() * (CHEER_TOGGLE_MAX - CHEER_TOGGLE_MIN),
          windDownAt: windDownStart + Math.random() * CHEER_WINDDOWN_MS,
        });
      });
      memberParamsRef.current = params;
      cheerStartRef.current = performance.now();

      setIsCheeringActive(true);
      setCheerTick(0);

      cheerTickIntervalRef.current = setInterval(() => {
        setCheerTick(t => t + 1);
      }, CHEER_TICK_MS);

      cheerTimeoutRef.current = setTimeout(() => {
        setIsCheeringActive(false);
        clearInterval(cheerTickIntervalRef.current);
      }, CHEER_DURATION_MS);

      const pitch = CHEER_PITCH[crowdEvent.intensity] || 1.0;
      playBuffer(winnerSound, volume * getGlobalVolume(), CHEER_DURATION_MS, pitch);
    }
  }, [crowdEvent]);

  const renderCrowdMembers = (members, isForeground = false) => {
    const elapsed = isCheeringActive ? performance.now() - cheerStartRef.current : 0;

    return members.map((member) => {
      const crowdType = CROWD_TYPES[member.typeIndex];

      let src = crowdType.idle;
      if (isCheeringActive) {
        const params = memberParamsRef.current.get(member.id);
        if (params && elapsed >= params.startDelay && elapsed <= params.windDownAt) {
          const memberElapsed = elapsed - params.startDelay;
          const cyclePos = Math.floor(memberElapsed / params.togglePeriod);
          if (cyclePos % 2 === 0) src = crowdType.cheering;
        }
      }
      const animOffset = ((member.id * 7) % 10) / 10;
      const shouldAnimate = member.y < 55;
      const blur = isForeground ? 0 : computeBlurFromY(member.y);

      return (
        <CrowdMember
          key={member.id}
          src={src}
          $x={member.x}
          $y={member.y}
          $size={member.size}
          $flip={member.flip}
          $opacity={computeOpacityFromSize(member.size)}
          $blur={blur}
          $animOffset={animOffset}
          $shouldAnimate={shouldAnimate}
          $customZIndex={member.customZIndex}
          $applyDarkFilter={member.applyDarkFilter}
          alt=""
          draggable={false}
        />
      );
    });
  };

  return (
    <>
      <CrowdContainer>
        <StyleInjector />
        {renderCrowdMembers(normalCrowd)}
      </CrowdContainer>
      {foregroundCrowd.length > 0 && (
        <ForegroundCrowdContainer>
          {renderCrowdMembers(foregroundCrowd, true)}
        </ForegroundCrowdContainer>
      )}
      {editorMode && (
        <CrowdEditor
          positions={crowdPositions}
          crowdTypes={CROWD_TYPES}
          onClose={handleEditorClose}
        />
      )}
    </>
  );
};

export default CrowdLayer;
