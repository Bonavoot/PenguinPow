/*
 * Shared design tokens for the Pumo Pumo "Aizome Banzuke" menu UI.
 * Used by MainMenu, Rooms, Lobby, Customize, etc. so the
 * palette and spacing stay consistent across all menu surfaces.
 */

import { keyframes } from "styled-components";

// ============================================
// COLOR TOKENS
// ============================================

export const C = {
  // Sumi ink — deep midnight base
  ink: "#070a14",
  inkSoft: "#0d1224",
  inkPanel: "rgba(8, 11, 24, 0.78)",
  inkPanelStrong: "rgba(8, 11, 24, 0.92)",

  // Aizome indigo — secondary structure / button bodies
  indigo: "#1f2a4d",
  indigoBright: "#3a4a85",
  indigoGlow: "rgba(94, 122, 200, 0.45)",

  // Vermillion — primary CTA, hanko, torii red
  vermillion: "#d83b27",
  vermillionBright: "#ee5141",
  vermillionDeep: "#8a1f12",
  vermillionGlow: "rgba(238, 81, 65, 0.55)",

  // Washi cream — primary text on dark surfaces
  cream: "#f5ecd9",
  creamWarm: "#e8dcc8",
  creamMute: "rgba(245, 236, 217, 0.65)",
  creamFaint: "rgba(245, 236, 217, 0.12)",

  // Gold leaf — premium accents (use sparingly)
  gold: "#e8c547",
  goldDeep: "#b8860b",

  // Pumo ice blue — pulled from the character's mawashi belt
  ice: "#7ecbf0",
  iceBright: "#a8e0ff",
};

// ============================================
// SHARED ANIMATIONS
// ============================================

export const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

export const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const slideInLeft = keyframes`
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const slideInRight = keyframes`
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const arrowNudge = keyframes`
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(4px); }
`;

export const livePulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6); }
  60%      { opacity: 0.85; box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
`;
