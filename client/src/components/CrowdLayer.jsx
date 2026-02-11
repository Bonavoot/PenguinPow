import React, { useMemo, useState, useEffect } from "react";
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
  filter: saturate(0.9) brightness(0.93) contrast(0.98);
  
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
  filter: saturate(0.95) brightness(0.96) contrast(1);
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
    filter: props.$applyDarkFilter
      ? "brightness(0.58) saturate(0.75) contrast(0.95)"
      : "saturate(1.02) brightness(0.98)",
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
  image-rendering: crisp-edges;
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-optimize-contrast;
  backface-visibility: hidden;
  ${(props) => props.$shouldAnimate ? "will-change: transform;" : ""}
`;

// Crowd member types - easily expandable for future additions
// sizeMultiplier adjusts for different image dimensions to keep them uniform
// yOffsetRatio adjusts vertical position as a ratio of size (scales with distance)
// weight controls how frequently this type appears (higher = more common)
const CROWD_TYPES = [
  { idle: crowdBoyIdle1, cheering: crowdBoyCheering1, sizeMultiplier: 1.15, yOffsetRatio: -.2, weight: 3 },
  { idle: crowdBoyIdle2, cheering: crowdBoyCheering2, sizeMultiplier: 1.1, yOffsetRatio: -0.2, weight: 1 },
  { idle: crowdBoyIdle3, cheering: crowdBoyCheering3, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 2 },
  { idle: crowdGirlIdle1, cheering: crowdGirlCheering1, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 3 },
  { idle: crowdGeishaIdle1, cheering: crowdGeishaCheering1, sizeMultiplier: .9, yOffsetRatio: 0.15, weight: 1 },
  { idle: crowdSalarymanIdle1, cheering: crowdSalarymanCheering1, sizeMultiplier: 1.05, yOffsetRatio: 0, weight: 3 },
  { idle: crowdSalarymanIdle2, cheering: crowdSalarymanCheering2, sizeMultiplier: 1.05, yOffsetRatio: 0, weight: 3 },
  { idle: crowdOldmanIdle1, cheering: crowdOldmanCheering1, sizeMultiplier: 1.1, yOffsetRatio: 0, weight: 1.5 },  // Old man
  { idle: crowdOyakata, cheering: crowdOyakata, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 0 },  // Oyakata (side seats only - weight 0 means won't appear in regular crowd)
  { idle: crowdOyakataFront, cheering: crowdOyakataFront, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 0 },  // Oyakata Front (special position only)
  { idle: crowdOyakataBack, cheering: crowdOyakataBack, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 0 },  // Oyakata Back (row 0 - closest)
  { idle: crowdSideIdle1, cheering: crowdSideCheering1, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 0 },  // Side member 1 (side seats only)
  { idle: crowdSideIdle2, cheering: crowdSideCheering2, sizeMultiplier: 1.0, yOffsetRatio: 0, weight: 0 },  // Side member 2 (side seats only)
  // Add more crowd types here later
];

/**
 * Generate crowd positions for tiered seating
 * Organized into groups for easy manual positioning
 */
const generateCrowdPositions = () => {
  const crowd = [];
  let id = 0;

  // Helper to add a single crowd member with full control
  // Parameters: x (0-100%), y (0-100%), size (% of screen), opacity (0-1), flip (true/false)
  const addMember = (x, y, size, opacity = 1, flip = null) => {
    // Weighted random selection based on weight values
    const totalWeight = CROWD_TYPES.reduce((sum, type) => sum + type.weight, 0);
    let random = Math.random() * totalWeight;
    let typeIndex = 0;
    
    for (let i = 0; i < CROWD_TYPES.length; i++) {
      random -= CROWD_TYPES[i].weight;
      if (random <= 0) {
        typeIndex = i;
        break;
      }
    }
    
    const shouldFlip = flip !== null ? flip : Math.random() > 0.5;
    const sizeMultiplier = CROWD_TYPES[typeIndex].sizeMultiplier;
    const yOffsetRatio = CROWD_TYPES[typeIndex].yOffsetRatio;
    const finalSize = size * sizeMultiplier;
    const scaledYOffset = finalSize * yOffsetRatio;  // Offset scales with size
    
    crowd.push({
      id: id++,
      x,
      y: y + scaledYOffset,  // Apply scaled Y offset to align different image heights
      size: finalSize,  // Apply size multiplier to normalize different image sizes
      typeIndex,
      flip: shouldFlip,
      opacity,
    });
  };

  // Helper to add a specific crowd type (for special characters like oyakata)
  // Parameters: x, y, size, opacity, flip, typeIndex (index in CROWD_TYPES array), customZIndex (optional), applyDarkFilter (optional)
  const addSpecificMember = (x, y, size, opacity = 1, flip = null, typeIndex, customZIndex = undefined, applyDarkFilter = false) => {
    const shouldFlip = flip !== null ? flip : Math.random() > 0.5;
    const sizeMultiplier = CROWD_TYPES[typeIndex].sizeMultiplier;
    const yOffsetRatio = CROWD_TYPES[typeIndex].yOffsetRatio;
    const finalSize = size * sizeMultiplier;
    const scaledYOffset = finalSize * yOffsetRatio;
    
    crowd.push({
      id: id++,
      x,
      y: y + scaledYOffset,
      size: finalSize,
      typeIndex,
      flip: shouldFlip,
      opacity,
      customZIndex,
      applyDarkFilter,
    });
  };

 

  // Helper to create a row with specified number of members
  const createRow = (startX, y, count, spacing, size, opacity = 1) => {
    for (let i = 0; i < count; i++) {
      addMember(startX + (i * spacing), y, size, opacity);
    }
  };

  // Helper to create a row split into 4 sections with gaps
  const createSectionedRow = (y, size, opacity = 1) => {
    // Each row has 28 members split into 4 sections (7 each)
    // Section 1: Left side (7 members)
    createRow(3, y, 7, 2.5, size, opacity);
    
    // Section 2: Left-center (7 members)
    createRow(22, y, 7, 2.5, size, opacity);
    
    // Section 3: Right-center (7 members)
    createRow(55, y, 7, 2.5, size, opacity);
    
    // Section 4: Right side (7 members)
    createRow(74, y, 7, 2.5, size, opacity);
  };

  // ============================================
  // MANUAL INDIVIDUAL POSITIONING EXAMPLES
  // ============================================
  // To manually position individual members, use:
  // addMember(x, y, size, opacity, flip)
  // Example:
  // addMember(10, 50, 2.5, 1.0, false);  // x=10%, y=50%, size=2.5%, opacity=100%, not flipped
  // addMember(15, 50, 2.5, 1.0, true);   // x=15%, y=50%, size=2.5%, opacity=100%, flipped
  
  // ============================================
  // GROUND FLOOR - 4 ROWS (Row 0 is closest, then 1, 2, 3)
  // ============================================
  
  // Ground Floor Row 0 (closest/lowest) - Oyakata Back
  const row0Y = 36;      // Lower Y = closer to viewer
  const row0Size = 11.5;  // Larger size = closer/bigger
  const row0Opacity = 1.0;
  const oyakataBackTypeIndex = 10; // Index of oyakata-back in CROWD_TYPES array
  
  // CENTER (1 member - mirrored) - Above dohyo layer with dark filter
  addSpecificMember(49.5, -25, 22, row0Opacity, true, oyakataBackTypeIndex, 2, true); // z-index 2, dark filter applied
  
  // Ground Floor Row 1 - MANUALLY POSITIONED
  // Change the Y position (48), size (3.0), and opacity (1.0) for the whole row
  // Change each X value to position each character exactly on a cushion
  const row1Y = 41;      // Adjust this to move entire row up/down
  const row1Size = 10.5;  // Adjust this to make entire row bigger/smaller
  const row1Opacity = 1.0;
  
  // OYAKATA FRONT - Next to Row 1 Section 1 (left side)
  const oyakataFrontTypeIndex = 9; // Index of oyakata-front in CROWD_TYPES array
  addSpecificMember(49.5, 38, 17, row1Opacity, false, oyakataFrontTypeIndex); // Normal crowd member
  
  // LEFT SECTION (5 members)
  addMember(0, row1Y, row1Size, row1Opacity);   // Character 1
  addMember(9, row1Y, row1Size, row1Opacity);  // Character 2
  addMember(19, row1Y, row1Size, row1Opacity);  // Character 3
  addMember(27.5, row1Y, row1Size, row1Opacity);  // Character 4
  addMember(36, row1Y, row1Size, row1Opacity);  // Character 5
  
  // --- GAP HERE ---
  
  // RIGHT SECTION (5 members)
  addMember(63, row1Y, row1Size, row1Opacity);  // Character 6
  addMember(72, row1Y, row1Size, row1Opacity);  // Character 7
  addMember(81, row1Y, row1Size, row1Opacity);  // Character 8
  addMember(90, row1Y, row1Size, row1Opacity);  // Character 9
  addMember(98.5, row1Y, row1Size, row1Opacity);  // Character 10
  
  // Ground Floor Row 2 (middle) - MANUALLY POSITIONED (2 sections of 5)
  const row2Y = 47;
  const row2Size = 10;
  const row2Opacity = 0.95;
  
  // LEFT SECTION (5 members)
  addMember(3, row2Y, row2Size, row2Opacity);   // Character 1
  addMember(12, row2Y, row2Size, row2Opacity);  // Character 2
  addMember(20.5, row2Y, row2Size, row2Opacity);  // Character 3
  addMember(28, row2Y, row2Size, row2Opacity);  // Character 4
  addMember(36, row2Y, row2Size, row2Opacity);  // Character 5
  
  // --- GAP HERE ---
  
  // RIGHT SECTION (5 members)
  addMember(62, row2Y, row2Size, row2Opacity);  // Character 6
  addMember(70.5, row2Y, row2Size, row2Opacity);  // Character 7
  addMember(78.5, row2Y, row2Size, row2Opacity);  // Character 8
  addMember(87, row2Y, row2Size, row2Opacity);  // Character 9
  addMember(96, row2Y, row2Size, row2Opacity);  // Character 10
  
  // Ground Floor Row 3 (back) - MANUALLY POSITIONED (2 sections of 5)
  const row3Y = 52;
  const row3Size = 9.5;
  const row3Opacity = 0.9;
  
  // LEFT SECTION (5 members)
  addMember(6, row3Y, row3Size, row3Opacity);   // Character 1
  addMember(14, row3Y, row3Size, row3Opacity);  // Character 2
  addMember(22.5, row3Y, row3Size, row3Opacity);  // Character 3
  addMember(29.5, row3Y, row3Size, row3Opacity);  // Character 4
  addMember(37, row3Y, row3Size, row3Opacity);  // Character 5
  
  // --- GAP HERE ---
  
  // RIGHT SECTION (5 members)
  addMember(61.5, row3Y, row3Size, row3Opacity);  // Character 6
  addMember(69, row3Y, row3Size, row3Opacity);  // Character 7
  addMember(77.5, row3Y, row3Size, row3Opacity);  // Character 8
  addMember(85, row3Y, row3Size, row3Opacity);  // Character 9
  addMember(93, row3Y, row3Size, row3Opacity);  // Character 10

  // ============================================
  // SIDE ROWS - Special oyakata characters on the sides
  // ============================================
  
  // Side Row 1 (left side) - Oyakata facing right (not flipped)
  const sideRow1Y = 22;
  const sideRow1Size = 18;
  const sideRow1Opacity = 1.0;
  const oyakataTypeIndex = 8; // Index of oyakata in CROWD_TYPES array
  
  addSpecificMember(1, sideRow1Y, sideRow1Size, sideRow1Opacity, false, oyakataTypeIndex);
  
  // Side Row 2 (right side) - Oyakata facing left (flipped)
  const sideRow2Y = 22;
  const sideRow2Size = 18;
  const sideRow2Opacity = 1.0;
  
  addSpecificMember(99, sideRow2Y, sideRow2Size, sideRow2Opacity, true, oyakataTypeIndex);
  
  // Side Members - One on each side
  const sideMember1TypeIndex = 11; // Index of crowdSideIdle1 in CROWD_TYPES array
  const sideMember2TypeIndex = 12; // Index of crowdSideIdle2 in CROWD_TYPES array
  const sideMemberY = 30;
  const sideMemberSize = 14;
  const sideMemberOpacity = 1.0;
  
  // Left side member (side-1, facing left, flipped)
  addSpecificMember(7, sideMemberY, sideMemberSize, sideMemberOpacity, true, sideMember1TypeIndex);
  
  // Right side member (side-2, facing right)
  addSpecificMember(93, sideMemberY, sideMemberSize, sideMemberOpacity, false, sideMember2TypeIndex);

  // ============================================
  // TOP STADIUM - 9 ROWS of 28 members each (4 sections of 7)
  // ============================================
  
  // Top Row 4 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow4Y = 65;
  const topRow4Size = 5.5;
  const topRow4Opacity = 0.9;
  
  //Section 1 (7 members)
  addMember(1, topRow4Y, topRow4Size, topRow4Opacity);

  // Section 2 (7 members)
  addMember(11.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(15.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(19, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(23, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(27, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(30.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(34, topRow4Y, topRow4Size, topRow4Opacity);
  
  // // ABOVE IS DONE !!!!!!!!!


  
  // Section 3 (7 members)
  addMember(65, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(68.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(72, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(76, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(79.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(83.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(87.5, topRow4Y, topRow4Size, topRow4Opacity);
  
  // Section 4 (7 members)

  addMember(98.5, topRow4Y, topRow4Size, topRow4Opacity);
  addMember(102, topRow4Y, topRow4Size, topRow4Opacity);
  
  // Top Row 5 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow5Y = 70;
  const topRow5Size = 5;
  const topRow5Opacity = 0.88;
  
  // Section 1 (7 members)
  addMember(0, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(3, topRow5Y, topRow5Size, topRow5Opacity);

  
  // Section 2 (7 members)
  addMember(12.5, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(16.3, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(20, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(24, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(27.5, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(30.8, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(34.5, topRow5Y, topRow5Size, topRow5Opacity);
  
  // Section 3 (7 members)
  addMember(64.5, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(68, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(71.5, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(75.2, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(79, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(82.8, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(86.5, topRow5Y, topRow5Size, topRow5Opacity);
  
  // Section 4 (7 members)

  addMember(96.5, topRow5Y, topRow5Size, topRow5Opacity);
  addMember(100, topRow5Y, topRow5Size, topRow5Opacity);

  //Top Row 6 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow6Y = 73.5;
  const topRow6Size = 4.5;
  const topRow6Opacity = 0.86;
  
  // Section 1 (7 members)
  addMember(1, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(5, topRow6Y, topRow6Size, topRow6Opacity);

  
  // Section 2 (7 members)
  addMember(14, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(17.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(21, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(24.8, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(28.2, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(31.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(34.8, topRow6Y, topRow6Size, topRow6Opacity);
  
  // Section 3 (7 members)
  addMember(64, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(67.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(71, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(74.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(78, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(81.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(85, topRow6Y, topRow6Size, topRow6Opacity);
  
  // Section 4 (7 members)

  addMember(94.5, topRow6Y, topRow6Size, topRow6Opacity);
  addMember(98, topRow6Y, topRow6Size, topRow6Opacity);

  //aTop Row 7 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow7Y = 77.5;
  const topRow7Size = 4;
  const topRow7Opacity = 0.84;
  
  // Section 1 (7 members)
  addMember(1, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(4, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(7, topRow7Y, topRow7Size, topRow7Opacity);

  
  // Section 2 (7 members)
  addMember(15.5, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(18.8, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(22, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(25.5, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(29, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(32.2, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(35.5, topRow7Y, topRow7Size, topRow7Opacity);
  
  // Section 3 (7 members)
  addMember(63.5, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(66.8, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(70, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(73.5, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(76.8, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(80.2, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(83.5, topRow7Y, topRow7Size, topRow7Opacity);
  
  // Section 4 (7 members)

  addMember(92, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(95.5, topRow7Y, topRow7Size, topRow7Opacity);
  addMember(99, topRow7Y, topRow7Size, topRow7Opacity);

  // Top Row 8 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow8Y = 81;
  const topRow8Size = 3.6;
  const topRow8Opacity = 0.82;
  
  // Section 1 (7 members)
  addMember(1, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(4, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(7, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(9.5, topRow8Y, topRow8Size, topRow8Opacity);

  // Section 2 (7 members)
  addMember(17, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(20, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(23.5, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(26.5, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(30, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(33, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(36, topRow8Y, topRow8Size, topRow8Opacity);
  
  // Section 3 (7 members)
  addMember(63, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(66, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(69, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(72, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(75.5, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(79, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(82.4, topRow8Y, topRow8Size, topRow8Opacity);
  
  // Section 4 (7 members)

  addMember(89.5, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(93, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(96, topRow8Y, topRow8Size, topRow8Opacity);
  addMember(99, topRow8Y, topRow8Size, topRow8Opacity);

  // Top Row 9 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow9Y = 85;
  const topRow9Size = 3;
  const topRow9Opacity = 0.80;
  
  // Section 1 (7 members)
  addMember(1, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(3.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(6, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(8.8, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(11.5, topRow9Y, topRow9Size, topRow9Opacity);
  
  // Section 2 (7 members)
  addMember(17.7, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(20, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(22.8, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(25.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(28.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(31, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(33.8, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(36.5, topRow9Y, topRow9Size, topRow9Opacity);
  
  // Section 3 (7 members)
  addMember(62.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(65.2, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(68, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(70.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(73.2, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(76, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(78.8, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(81, topRow9Y, topRow9Size, topRow9Opacity);
  
  // Section 4 (7 members)
  addMember(87.4, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(89.6, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(92, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(94.5, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(96.8, topRow9Y, topRow9Size, topRow9Opacity);
  addMember(99.2, topRow9Y, topRow9Size, topRow9Opacity);

  // Top Row 10 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow10Y = 89;
  const topRow10Size = 2.8;
  const topRow10Opacity = 0.78;
  
  // Section 1 (7 members)
  addMember(1, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(3.3, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(5.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(7.7, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(9.8, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(11.8, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(14, topRow10Y, topRow10Size, topRow10Opacity);
  
  // Section 2 (7 members)
  addMember(19.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(21.8, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(24.4, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(27, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(29.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(32, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(34.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(37, topRow10Y, topRow10Size, topRow10Opacity);

  // Section 3 (7 members)
  addMember(62, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(64.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(67.3, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(70, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(72.4, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(75, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(77.2, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(79.7, topRow10Y, topRow10Size, topRow10Opacity);
  
  // Section 4 (7 members)
  addMember(85, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(87.2, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(89.3, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(91.5, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(93.8, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(96.3, topRow10Y, topRow10Size, topRow10Opacity);
  addMember(98.7, topRow10Y, topRow10Size, topRow10Opacity);

  // Top Row 11 - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow11Y = 93;
  const topRow11Size = 2.5;
  const topRow11Opacity = 0.76;
  
  // Section 1 (7 members)
  addMember(1, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(7, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(9.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(11.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(13.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(15.5, topRow11Y, topRow11Size, topRow11Opacity);
  // Section 2 (7 members)
  addMember(21, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(23.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(25.8, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(28.2, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(30.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(32.8 , topRow11Y, topRow11Size, topRow11Opacity);
  addMember(35, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(37.5, topRow11Y, topRow11Size, topRow11Opacity);
  
  // Section 3 (7 members)
  addMember(61.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(63.8, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(66, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(68, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(70, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(72.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(74.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(76.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(78.3, topRow11Y, topRow11Size, topRow11Opacity);
  
  // Section 4 (7 members)
  addMember(83.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(85.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(87.6, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(90, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(92.3, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(94.5, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(96.8, topRow11Y, topRow11Size, topRow11Opacity);
  addMember(99, topRow11Y, topRow11Size, topRow11Opacity);

  // Top Row 12 (highest/furthest) - MANUALLY POSITIONED (28 members in 4 sections)
  const topRow12Y = 97;
  const topRow12Size = 2.3;
  const topRow12Opacity = 0.74;
  
  // Section 1 (7 members)
  addMember(1, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(3, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(7, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(9.3, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(11.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(13.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(15.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(17.8, topRow12Y, topRow12Size, topRow12Opacity);
  
  // Section 2 (7 members)
  addMember(22.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(24.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(26.8, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(29, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(31.3, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(33.7, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(35.7, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(37.9, topRow12Y, topRow12Size, topRow12Opacity);
  
  // Section 3 (7 members)
  addMember(60.9, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(63, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(65.3, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(67.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(69.7, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(72, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(74.3, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(76.5, topRow12Y, topRow12Size, topRow12Opacity);
  
  // Section 4 (7 members)
  addMember(80.8, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(83, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(85, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(87.5, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(89.8, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(92, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(94, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(96, topRow12Y, topRow12Size, topRow12Opacity);
  addMember(98, topRow12Y, topRow12Size, topRow12Opacity);

  return crowd;
};

const CrowdLayer = ({ isCheering = false }) => {
  // Memoize crowd positions so they don't regenerate on every render
  const crowdPositions = useMemo(() => generateCrowdPositions(), []);
  
  // Split crowd into normal (z-index 0) and foreground (above dohyo) members
  const normalCrowd = useMemo(() => crowdPositions.filter(m => m.customZIndex === undefined), [crowdPositions]);
  const foregroundCrowd = useMemo(() => crowdPositions.filter(m => m.customZIndex !== undefined), [crowdPositions]);
  
  // Track which crowd types are currently in "cheering" pose vs "idle" pose
  // This creates a bouncing effect where each type animates together
  const [cheeringTypes, setCheeringTypes] = useState(new Set());

  useEffect(() => {
    if (!isCheering) {
      // Clear all cheering states when not cheering
      setCheeringTypes(new Set());
      return;
    }

    // Immediately start all types in cheering pose for instant feedback
    setCheeringTypes(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));

    // Different intervals for each crowd type (in milliseconds)
    // Each type bounces at a different rate for visual variety
    const intervals = [
      300,  // crowdBoyIdle1 - fastest, most energetic
      450,  // crowdBoyIdle2
      350,  // crowdBoyIdle3
      500,  // crowdGirlIdle1
      550,  // crowdGeishaIdle1 - slower, more elegant
      400,  // crowdSalarymanIdle1
      475,  // crowdSalarymanIdle2
      525,  // crowdOldmanIdle1 - slower, older person
      0,    // crowdOyakata - no animation (same idle and cheering sprite)
      0,    // crowdOyakataFront - no animation (same idle and cheering sprite)
      0,    // crowdOyakataBack - no animation (same idle and cheering sprite)
      425,  // crowdSideIdle1 - side member with cheering animation
      450,  // crowdSideIdle2 - side member with cheering animation
    ];

    const timers = intervals.map((interval, typeIndex) => {
      return setInterval(() => {
        setCheeringTypes((prev) => {
          const next = new Set(prev);
          if (next.has(typeIndex)) {
            next.delete(typeIndex); // Switch to idle
          } else {
            next.add(typeIndex); // Switch to cheering
          }
          return next;
        });
      }, interval);
    });

    // Stop cheering animation after 3.5 seconds
    const stopCheeringTimeout = setTimeout(() => {
      setCheeringTypes(new Set()); // Clear all cheering states
      timers.forEach((timer) => clearInterval(timer)); // Stop all animation intervals
    }, 3500);

    // Cleanup all intervals and timeout when component unmounts or isCheering changes
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      clearTimeout(stopCheeringTimeout);
    };
  }, [isCheering]);

  // Helper function to render crowd members
  const renderCrowdMembers = (members) => {
    return members.map((member) => {
      const crowdType = CROWD_TYPES[member.typeIndex];
      
      // Determine image source based on:
      // 1. If not in cheering mode at all, always use idle
      // 2. If in cheering mode, check if this type is currently in "cheering" pose
      const isTypeCurrentlyCheering = cheeringTypes.has(member.typeIndex);
      const src = isCheering && isTypeCurrentlyCheering ? crowdType.cheering : crowdType.idle;
      
      // Generate a pseudo-random offset based on member id for animation staggering
      const animOffset = ((member.id * 7) % 10) / 10; // 0.0 to 0.9

      // Only animate front rows (y < 55) - back rows are too small to notice
      const shouldAnimate = member.y < 55;

      return (
        <CrowdMember
          key={member.id}
          src={src}
          $x={member.x}
          $y={member.y}
          $size={member.size}
          $flip={member.flip}
          $opacity={member.opacity}
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
          {renderCrowdMembers(foregroundCrowd)}
        </ForegroundCrowdContainer>
      )}
    </>
  );
};

export default CrowdLayer;
