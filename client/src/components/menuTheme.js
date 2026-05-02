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

  // Pumo ice blue — pulled from the character's mawashi belt.
  // This is the canonical secondary palette across ALL menu surfaces
  // (replaces the older Aizome indigo). Use these for panel bodies,
  // secondary buttons, hover states, structure borders, etc.
  ice: "#7ecbf0",
  iceBright: "#a8e0ff",
  iceDeep: "#1c4e6e",            // rgb(28, 78, 110)  — dark ice for panel/button backgrounds
  iceMid: "#3682aa",             // rgb(54, 130, 170) — mid ice for hover backgrounds
  iceGlow: "rgba(126, 203, 240, 0.45)",

  // Live / accept green — "GO" CTAs (Join, Ready-to-fight, live status).
  // Tuned to match the existing live-status pulse dot (#4ade80) so the
  // join button visually rhymes with "live / online" signals.
  success: "#4ade80",
  successBright: "#86efac",
  successDeep: "#16a34a",
  successGlow: "rgba(74, 222, 128, 0.55)",

  // ──────────────────────────────────────────────────────────────────
  // DEPRECATED: Aizome indigo. Kept for backward compatibility only.
  // All new code should use the ice* tokens above. Existing usages
  // are being migrated. Do not introduce new C.indigo* references.
  // ──────────────────────────────────────────────────────────────────
  indigo: "#1f2a4d",
  indigoBright: "#3a4a85",
  indigoGlow: "rgba(94, 122, 200, 0.45)",
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
