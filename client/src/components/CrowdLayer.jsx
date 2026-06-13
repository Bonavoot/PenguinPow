import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import styled, { keyframes } from "styled-components";
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
import CrowdEditor from "./CrowdEditor";
import CROWD_POSITIONS from "./crowdPositionsData";
import winnerSound from "../sounds/winner-sound.ogg";
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

// Container for the entire crowd layer. Per-sprite broadcast-style grading lives in
// `computeCrowdLightingFilter` (Y-based: ringside warmer/brighter, upper deck cooler/darker).
// ::before: subtle warm floor bounce toward the ring. ::after: soft corner vignette.
const CrowdContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0; /* Between game map background (-1) and dohyo overlay (1) */
  contain: layout style paint;
  /* No blur on the container itself — the depth-of-field lives on the banded
     child planes (CrowdDofPlane) so the back wall defocuses progressively
     HARDER than ringside. A single uniform blur read as "poor vision"; a
     smooth near→far ramp reads as an intentional shallow-DoF lens (sharp
     subject, soft background). ::before/::after (floor bounce + vignette)
     still overlay every plane. */

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      0deg,
      rgba(255, 232, 200, 0.14) 0%,
      rgba(255, 240, 215, 0.05) 22%,
      transparent 48%
    );
    pointer-events: none;
    z-index: -1;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    /* Crowd-internal vignette — softened. This is one of THREE stacked
       vignettes (screen-space .game-container::after + .arena-lighting edge +
       this one); together they were over-darkening the periphery into a void
       and flattening depth. Pulled back so the crowd recedes without dying —
       the cinematic frame darkening is owned by the screen-space vignette. */
    background: radial-gradient(
      ellipse 84% 74% at 50% 56%,
      rgba(0, 0, 0, 0) 34%,
      rgba(10, 14, 30, 0.11) 78%,
      rgba(6, 10, 26, 0.24) 100%
    );
    pointer-events: none;
    z-index: 9999;
  }
`;

// ── Depth-of-field: tier-aware blur ramp ─────────────────────────────────
// The stand is TWO physical tiers, so a single linear near→far smear ignored
// the real geometry (and read as "smeared"/headache-y rather than softly out
// of focus). `member.y` is CSS bottom %:
//
//   y≈89  ┌─────────────────────────┐  ← back wall (farthest, softest)
//         │   UPPER DECK (rising)    │
//   y≈65  └─────────────────────────┘
//   y≈62        · gap: no seats ·         ← divider wall / walkway
//   y≈60  ┌─────────────────────────┐
//         │   GROUND FLOOR (bowl)    │
//   y≈30  └─────────────────────────┘  ← ring-side front rows (nearest, sharp)
//
// Each tier gets its OWN gentle near→far ramp, so the defocus tracks the
// seating instead of crossing the empty divider as if it were continuous. The
// upper deck starts a hair softer than the ground floor ends, keeping the
// monotonic "farther = softer" read across the gap.
//
// Raw CSS px here are multiplied ON SCREEN by camera × display zoom (~2–2.6×),
// so keep them small. These are reduced ~30–55% from the old single ramp
// ([0.9 … 1.8]): the ground-floor bowl (closest to the action) is now nearly
// crisp so readability/eye-comfort wins, while the upper deck stays clearly
// soft to keep focus on the fighters and hide the repeating sprite pattern.
const GROUND_FLOOR_NEAR_Y = 30; // front ring-side bowl rows (sharpest)
const GROUND_FLOOR_FAR_Y = 60;  // back of the lower bowl (just below the divide)
const UPPER_DECK_NEAR_Y = 64;   // first rising-deck row above the divide
const UPPER_DECK_FAR_Y = 90;    // nosebleeds against the back wall (softest)

const GROUND_FLOOR_BLUR = [0.4, 0.75]; // near → far across the lower bowl
const UPPER_DECK_BLUR = [0.95, 1.3];   // near → far across the rising deck

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Continuous desired blur (CSS px) for a given row, piecewise by tier.
const depthBlur = (y) => {
  if (y <= GROUND_FLOOR_FAR_Y) {
    const t = clamp01((y - GROUND_FLOOR_NEAR_Y) / (GROUND_FLOOR_FAR_Y - GROUND_FLOOR_NEAR_Y));
    return lerp(GROUND_FLOOR_BLUR[0], GROUND_FLOOR_BLUR[1], t);
  }
  const t = clamp01((y - UPPER_DECK_NEAR_Y) / (UPPER_DECK_FAR_Y - UPPER_DECK_NEAR_Y));
  return lerp(UPPER_DECK_BLUR[0], UPPER_DECK_BLUR[1], t);
};

// Quantize the continuous ramp into a few discrete planes so we pay for only a
// handful of blur passes (one per distinct level) instead of one per member.
// Smaller step = smoother gradient but more GPU during camera zooms.
const DOF_BLUR_STEP = 0.2;
const quantizeBlur = (b) => Math.round(b / DOF_BLUR_STEP) * DOF_BLUR_STEP;

// The forward-facing oyakata (the master seated dead-center behind the gyoji,
// CROWD_TYPES index 9) is a focal character, not anonymous crowd. His row would
// otherwise blur him at ~0.6px; pin him sharper so his face reads clearly.
// Set to 0 for fully crisp, or nudge up for a hair of atmospheric softness.
const OYAKATA_FRONT_TYPE_INDEX = 9;
const OYAKATA_FRONT_BLUR = 0.2;

// Each plane is ONE blur pass over its (already color-graded) child sprites, so
// total cost stays ~flat regardless of the 400+ members. `filter` makes each
// plane a stacking context; we paint far → near so nearer rows stay in front.
const CrowdDofPlane = styled.div.attrs((props) => ({
  style: { filter: `blur(${props.$blur}px)` },
}))`
  position: absolute;
  inset: 0;
  pointer-events: none;
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
`;

// Broadcast camera-flashes: on a KO the stands erupt with phone/camera shutters
// firing off in a scattered flurry. Each flash is anchored to a REAL crowd
// member (see generation below) so they always pop on a spectator, never in
// empty space (the center stairs, aisles, etc.). Snappy burst — instant attack,
// then a quick bloom-and-fade. Rendered in a NON-blurred layer above the DoF'd
// crowd so they read as crisp specular sparks.
const flashPop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.45);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.5);
  }
`;

const FlashLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Above the crowd (z0) + foreground crowd (z2) + dohyo (z1), below the
     players (z98+) — the flashes live up in the stands. */
  z-index: 3;
  overflow: hidden;
`;

const Flash = styled.div`
  position: absolute;
  aspect-ratio: 1; /* width supplied per-flash (scales with member size) */
  border-radius: 50%;
  /* Hot white core → tight bright falloff → soft blue-white halo. */
  background: radial-gradient(
    circle,
    #ffffff 0%,
    rgba(255, 255, 255, 0.95) 16%,
    rgba(216, 234, 255, 0.5) 40%,
    rgba(200, 224, 255, 0) 72%
  );
  transform: translate(-50%, -50%);
  will-change: transform, opacity;
  animation-name: ${flashPop};
  animation-timing-function: ease-out;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
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
    filter: props.$filter,
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

// Crowd sprites stay fully opaque. A size-based alpha (old min 0.74) on top of broadcast
// grading made small / back rows look washed and blurry; depth is scale + lighting, not alpha.
const computeCrowdOpacity = () => 1;

// Runtime filter only for non-cheering special members (oyakata) whose src never
// changes, so the compositor-layer cost is a one-time static expense.
const OYAKATA_FILTER = "brightness(0.45) saturate(0.62) contrast(0.90)";

// `member.y` is CSS bottom % — low values sit near the ring (TV key/fill reads brighter
// and slightly warmer), high values are upper deck (less light, cooler shadow).
const CROWD_ROW_Y_NEAR = 6;
const CROWD_ROW_Y_FAR = 90;

const rowDepthT = (y) => {
  const t = (y - CROWD_ROW_Y_NEAR) / (CROWD_ROW_Y_FAR - CROWD_ROW_Y_NEAR);
  return Math.min(1, Math.max(0, t));
};

// Broadcast-style crowd grade: ringside pops; nosebleeds fall off without one flat wash.
//
// IMPORTANT: this filter is intentionally *gentle* on the sprites themselves —
// crushing contrast, blurring, or hammering saturation here destroys the clean
// line work of the hand-graded sprites and turns faces into pale blobs. The
// heavy "push the crowd back" lifting is done by overlays (the CrowdContainer
// ::after vignette and the .game-container::after screen-space vignette in
// App.css), not by filter-mutilating each sprite. Keep this pass conservative.
const computeCrowdLightingFilter = (y, { foreground = false } = {}) => {
  const t = rowDepthT(y);
  const ringside = 1 - t;
  // Brightness gradient — back rows sit dimmer than ringside. Lifted out of the
  // old 0.61 floor: the sprites are ALSO baked at brightness(0.76), so the old
  // runtime floor compounded to ~0.46 and read as a muddy void. This keeps the
  // crowd reading as people in moody light, not a brown smear.
  const brightness = 0.72 + ringside * 0.26;       // 0.72 (far) → 0.98 (near)
  // Saturation gradient. Ringside pops, back-row clothing stays a touch calmer.
  // Kept VIBRANT on purpose — the background is colorful by design and a low
  // floor here produces the hated "faded bright" (washed pastel) look. NEVER
  // drop below ~0.9 net or skin tones go grey.
  const saturate = 0.96 + ringside * 0.2;           // 0.96 → 1.16
  // The crowd sprites were baked at contrast(0.95) — i.e. DE-contrasted, which
  // is exactly what produced the "faded" look. Add the punch back at runtime so
  // net contrast lands slightly above neutral (≈0.95 × 1.14 ≈ 1.08) and faces
  // regain definition. Kept FLAT across depth (no far-row taper): lowering
  // contrast on bright colors reads as washed-out "faded bright", which we
  // explicitly want to avoid. Depth/recession comes from DoF blur + vignette,
  // not from crushing the tone curve flat.
  const contrast = 1.14;
  // Slight ringside warmth (TV stage-light tint).
  const sepia = ringside * 0.045;
  const hueRotate = ringside * -5.5;

  const parts = [
    `brightness(${brightness.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    `contrast(${contrast.toFixed(2)})`,
  ];
  if (sepia >= 0.01) {
    parts.push(`sepia(${sepia.toFixed(3)})`, `hue-rotate(${hueRotate.toFixed(1)}deg)`);
  }
  let s = parts.join(" ");
  // Foreground (closest-to-camera) crowd: a touch dimmer so the side-aisle
  // figures don't compete with the fighters. Kept light enough that they
  // still read as "people watching", not silhouettes.
  if (foreground) s = `${s} brightness(0.85)`;
  return s;
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
  // Bucket the normal crowd by quantized tier-aware blur for a smooth DoF
  // falloff that follows the two-tier seating (ground bowl + rising deck).
  const crowdBands = useMemo(() => {
    const map = new Map();
    normalCrowd.forEach((m) => {
      const blur =
        m.typeIndex === OYAKATA_FRONT_TYPE_INDEX
          ? OYAKATA_FRONT_BLUR
          : quantizeBlur(depthBlur(m.y));
      if (!map.has(blur)) map.set(blur, []);
      map.get(blur).push(m);
    });
    // Far (more blur) first → near (less blur) last so nearer rows paint on top.
    return [...map.entries()]
      .map(([blur, members]) => ({ blur, members }))
      .sort((a, b) => b.blur - a.blur);
  }, [normalCrowd]);

  // Active camera-flash sparks (populated on a KO, auto-cleared after the burst).
  const [flashes, setFlashes] = useState([]);
  const flashClearRef = useRef(null);

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

  const lastCheerTimeRef = useRef(0);
  const cheerStartRef = useRef(0);
  const memberParamsRef = useRef(new Map());
  const cheerTickIntervalRef = useRef(null);
  const cheerTimeoutRef = useRef(null);
  const crowdPositionsRef = useRef(crowdPositions);
  crowdPositionsRef.current = crowdPositions;
  const isCheeringRef = useRef(false);
  const memberImgRefsMap = useRef(new Map());
  const memberRefCallbacks = useRef(new Map());

  const getMemberRef = useCallback((memberId) => {
    if (!memberRefCallbacks.current.has(memberId)) {
      memberRefCallbacks.current.set(memberId, (el) => {
        if (el) {
          memberImgRefsMap.current.set(memberId, el);
        } else {
          memberImgRefsMap.current.delete(memberId);
        }
      });
    }
    return memberRefCallbacks.current.get(memberId);
  }, []);

  const resetAllSpritesToIdle = () => {
    memberParamsRef.current.forEach((params, memberId) => {
      const imgEl = memberImgRefsMap.current.get(memberId);
      if (imgEl) imgEl.src = params.idleSprite;
    });
  };

  useEffect(() => {
    return () => {
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
      clearTimeout(flashClearRef.current);
    };
  }, []);

  useEffect(() => {
    if (!crowdEvent) return;

    if (crowdEvent.type === "reset") {
      clearInterval(cheerTickIntervalRef.current);
      clearTimeout(cheerTimeoutRef.current);
      clearTimeout(flashClearRef.current);
      setFlashes([]);
      if (isCheeringRef.current) resetAllSpritesToIdle();
      isCheeringRef.current = false;
      return;
    }

    if (crowdEvent.type === "cheer") {
      const now = Date.now();
      if (crowdEvent.intensity !== "heavy" && now - lastCheerTimeRef.current < CHEER_COOLDOWN_MS) return;
      lastCheerTimeRef.current = now;

      const volume = CHEER_VOLUME[crowdEvent.intensity] || 0.003;

      // A KO (heavy cheer) sets off a flurry of camera flashes in the stands.
      // Anchor each one to an actual crowd member so they fire from spectators,
      // never from empty space (the center stairs / aisles on the map art).
      if (crowdEvent.intensity === "heavy") {
        const pool = crowdPositionsRef.current.filter(
          (m) => m.customZIndex === undefined
        );
        if (pool.length > 0) {
          const newFlashes = Array.from({ length: 20 }, (_, i) => {
            const m = pool[Math.floor(Math.random() * pool.length)];
            // Scale the spark to the member (near rows bigger, back rows tiny),
            // with a little variance so they don't look stamped.
            const w =
              Math.min(0.8, Math.max(0.34, m.size * 0.085)) *
              (0.85 + Math.random() * 0.3);
            return {
              id: `${now}-${i}`,
              x: m.x,
              // Lift to roughly the upper body / where a raised phone would be.
              y: m.y + m.size * 0.8,
              w,
              delay: Math.random() * 1800, // ms — scattered over ~2s
              dur: 150 + Math.random() * 110, // ms — quick shutter pop
            };
          });
          setFlashes(newFlashes);
          clearTimeout(flashClearRef.current);
          flashClearRef.current = setTimeout(() => setFlashes([]), 2700);
        }
      }

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
          idleSprite: crowdType.idle,
          cheeringSprite: crowdType.cheering,
          showingCheering: false,
        });
      });
      memberParamsRef.current = params;
      cheerStartRef.current = performance.now();
      isCheeringRef.current = true;

      cheerTickIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - cheerStartRef.current;
        memberParamsRef.current.forEach((p, memberId) => {
          let shouldCheer = false;
          if (elapsed >= p.startDelay && elapsed <= p.windDownAt) {
            const memberElapsed = elapsed - p.startDelay;
            const cyclePos = Math.floor(memberElapsed / p.togglePeriod);
            shouldCheer = (cyclePos % 2 === 0);
          }
          if (shouldCheer === p.showingCheering) return;
          p.showingCheering = shouldCheer;
          const imgEl = memberImgRefsMap.current.get(memberId);
          if (imgEl) imgEl.src = shouldCheer ? p.cheeringSprite : p.idleSprite;
        });
      }, CHEER_TICK_MS);

      cheerTimeoutRef.current = setTimeout(() => {
        clearInterval(cheerTickIntervalRef.current);
        resetAllSpritesToIdle();
        isCheeringRef.current = false;
      }, CHEER_DURATION_MS);

      const pitch = CHEER_PITCH[crowdEvent.intensity] || 1.0;
      playBuffer(winnerSound, volume * getGlobalVolume(), CHEER_DURATION_MS, pitch);
    }
  }, [crowdEvent]);

  const renderCrowdMembers = (members, { darken = false } = {}) => {
    return members.map((member) => {
      const crowdType = CROWD_TYPES[member.typeIndex];
      const animOffset = ((member.id * 7) % 10) / 10;
      const shouldAnimate = member.y < 55;
      const needsFilter = crowdType.idle === crowdType.cheering && member.applyDarkFilter;

      let filter = "none";
      if (needsFilter) filter = OYAKATA_FILTER;
      else if (darken) filter = computeCrowdLightingFilter(member.y, { foreground: true });
      else filter = computeCrowdLightingFilter(member.y);

      return (
        <CrowdMember
          key={member.id}
          ref={getMemberRef(member.id)}
          src={crowdType.idle}
          $x={member.x}
          $y={member.y}
          $size={member.size}
          $flip={member.flip}
          $opacity={computeCrowdOpacity()}
          $filter={filter}
          $animOffset={animOffset}
          $shouldAnimate={shouldAnimate}
          $customZIndex={member.customZIndex}
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
        {/* Already sorted far → near; paint each as one blur plane. */}
        {crowdBands.map((b) => (
          <CrowdDofPlane key={b.blur} $blur={b.blur}>
            {renderCrowdMembers(b.members)}
          </CrowdDofPlane>
        ))}
      </CrowdContainer>
      {foregroundCrowd.length > 0 && (
        <ForegroundCrowdContainer>
          {renderCrowdMembers(foregroundCrowd, { darken: true })}
        </ForegroundCrowdContainer>
      )}
      {flashes.length > 0 && (
        <FlashLayer>
          {flashes.map((f) => (
            <Flash
              key={f.id}
              style={{
                left: `${f.x}%`,
                bottom: `${f.y}%`,
                width: `${f.w}cqw`,
                animationDelay: `${f.delay}ms`,
                animationDuration: `${f.dur}ms`,
              }}
            />
          ))}
        </FlashLayer>
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
