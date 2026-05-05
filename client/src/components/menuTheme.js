/*
 * Shared design tokens for the Pumo Pumo "Aizome Banzuke" menu UI.
 * Used by MainMenu, Rooms, Lobby, Customize, etc. so the
 * palette and spacing stay consistent across all menu surfaces.
 */

import { keyframes } from "styled-components";

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

/*
 * Body font stack. We use Space Grotesk instead of a generic geometric
 * sans (Inter / Outfit / Poppins / DM Sans) because those have become
 * the AI-default body face — clean, neutral, and instantly readable as
 * "this was generated." Space Grotesk has just enough humanist warmth
 * (the slight flare on stems, the rounded `g`) to read as a deliberate
 * design choice without sacrificing the broadcast/data legibility we
 * need for stat plates, tickers, and meta type.
 *
 * Display face stays "Bungee" everywhere — that's the brand.
 * Kanji accents stay "Noto Serif JP" / "Noto Sans JP".
 */
export const FONT_BODY = `"Space Grotesk", "Inter", system-ui, sans-serif`;
export const FONT_DISPLAY = `"Bungee", cursive`;
export const FONT_KANJI = `"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;

// ============================================
// COLOR TOKENS
// ============================================

export const C = {
  // ════════════════════════════════════════════════════════════════════
  // SUMI-INK PALETTE — DEPRECATED FOR MENU SURFACES.
  // ════════════════════════════════════════════════════════════════════
  // These dark slate tokens are RETAINED ONLY for the in-game HUD
  // (UiPlayerInfo) and the PreMatchScreen, which sit over the live
  // arena and still need dark-on-dark chrome. All new menu/lobby/
  // customize/rooms surfaces use the SNOW palette below — a light icy
  // Hokkaido-winter scheme that reads as "penguin in fresh snow"
  // instead of the navy SaaS-dashboard look the dark theme had drifted
  // into.
  //
  // History of these values:
  //   v1: rgb(7, 10, 20) etc.  — too navy. Whole app read as
  //       SaaS teal-on-navy because the BASE token was navy.
  //   v2: rgb(10, 9, 12) etc.  — overcorrected. Slight warm lean
  //       made every chrome surface read as faintly red.
  //   v3: rgb(10, 13, 18) — slate-leaning cool. Used through the
  //       last design pass on all menu screens.
  //   v4 (current): menu screens migrated to a SNOW palette;
  //       these dark ink tokens stay only for in-game HUD chrome.
  // ─────────────────────────────────────────────────────────────────
  ink: "#0a0d12",                          // rgb(10, 13, 18) — slate near-black
  inkSoft: "#141821",                      // rgb(20, 24, 33) — slate elevated dark
  inkPanel: "rgba(12, 15, 21, 0.78)",      // slate panel mid-fill
  inkPanelStrong: "rgba(11, 13, 18, 0.92)",// slate panel strong-fill

  // ════════════════════════════════════════════════════════════════════
  // SNOW PALETTE — primary surface set for all menu screens.
  // ════════════════════════════════════════════════════════════════════
  // Light, slightly cool off-whites pulled from real snow: not pure
  // #FFFFFF (which would read as a stock medical / SaaS interface),
  // but tinted ~5-8 toward blue so the whole UI sits in the same
  // Hokkaido winter as Pumo. Borders are crisp solid colors (no
  // semi-transparent "glass edges"), shadows are short and cool, and
  // panels fill with FLAT colors rather than the multi-stop gradients
  // that made the dark theme read as templated AI chrome.
  //
  // Picking guide:
  //   snow / snowSoft  — page-level backgrounds
  //   snowPanel        — primary card / panel surface
  //   snowPanelDeep    — secondary inset surface (one step darker)
  //   snowFrost        — large washes / overlays
  //   snowBorder       — clean 1px borders on snow
  //   snowBorderSoft   — low-emphasis dividers on snow
  //   snowShadow       — subtle cool drop shadow
  //   snowShadowStrong — for elevated cards (modals, primary panels)
  // ─────────────────────────────────────────────────────────────────
  snow: "#eaf1f7",          // rgb(234, 241, 247) — page surface, pale icy off-white
  snowSoft: "#f3f7fb",      // rgb(243, 247, 251) — lighter highlight surface
  snowPanel: "#ffffff",     // pure white — primary card surface
  snowPanelDeep: "#dde9f1", // rgb(221, 233, 241) — secondary cooler surface
  snowFrost: "#cbdbe7",     // rgb(203, 219, 231) — colder ice tint for header bands
  snowBorder: "#b3c7d6",    // rgb(179, 199, 214) — solid 1px border on snow
  snowBorderSoft: "rgba(30, 60, 90, 0.12)", // hairline divider on snow
  snowShadow: "rgba(35, 70, 110, 0.10)",     // subtle ambient
  snowShadowStrong: "rgba(25, 55, 95, 0.20)",// elevated card lift

  // ════════════════════════════════════════════════════════════════════
  // SUMI ANCHOR PALETTE — dark structural chrome.
  // ════════════════════════════════════════════════════════════════════
  // Used to break up the all-white snow stack. Without these, the menu
  // reads as a stack of identical white plaques on a white page — no
  // visual anchor for the eye, no clear hierarchy between "chrome" and
  // "content". Real game UIs always have at least one dark structural
  // band (HUD, ticker, header strip) that frames the bright surfaces.
  //
  // These are deliberately NOT:
  //   - navy        ( reads as SaaS dashboard )
  //   - pure black  ( reads as printer-toner / harsh, no character )
  //   - grey        ( reads as Material spec / anonymous chrome )
  //   - warm brown  ( introduces a third hue — the UI was meant to
  //                   stay a two-color story: snow + dark )
  //
  // Instead these are a very dark NEAR-NEUTRAL charcoal with the
  // faintest cool lean, just enough to sit in the same hue family
  // as the snow palette without registering as a separate color.
  // The eye reads them as "the darkest version of our cool palette",
  // not as a new tone introduced into the chrome.
  //
  // History of these values:
  //   v1: #1c1916 — warm sumi-ink lean. Looked like real Japanese
  //       inkstone in isolation, but on the menu it read as a third
  //       distinct color (white + black + brown), which broke the
  //       two-tone story.
  //   v2 (current): pulled to a slightly cool charcoal so the hue
  //       belongs to the snow family.
  //
  //   sumi         — anchor chrome (bottom HUD bar, banzuke header).
  //                  The "frame" of the screen.
  //   sumiSoft     — one step lighter, for elevation / divider bands
  //                  inside sumi panels (StatusBlock on top of HUD).
  //   sumiBorder   — hairline 1px highlight at the top of sumi chrome
  //                  (makes the dark plate feel "pressed" not painted).
  //                  Cool-tinted so it matches the snow border family.
  //   sumiShadow   — short ambient shadow under sumi chrome on snow.
  // ─────────────────────────────────────────────────────────────────
  sumi: "#171a20",          // rgb(23, 26, 32)  — cool charcoal near-black
  sumiSoft: "#22262d",      // rgb(34, 38, 45)  — elevated charcoal
  sumiBorder: "rgba(234, 241, 247, 0.10)", // snow hairline (matches snowBorderSoft family)
  sumiShadow: "rgba(15, 20, 30, 0.35)",

  // ════════════════════════════════════════════════════════════════════
  // INK TEXT — dark text colors for use on snow surfaces.
  // ════════════════════════════════════════════════════════════════════
  // Counterpart to C.cream / C.creamMute (which target dark surfaces).
  // Slate-leaning navy so headings read as confident "sumi ink on
  // washi" without going pure black (which looks printer-toner harsh
  // against the slightly-tinted snow surfaces).
  //
  //   inkText        — primary headings (Bungee titles, key labels)
  //   inkTextStrong  — strongest emphasis (rare; logo lockups)
  //   inkTextSoft    — body / secondary copy
  //   inkTextMute    — meta labels, captions, helper text
  //   inkTextFaint   — disabled state
  // ─────────────────────────────────────────────────────────────────
  inkText: "#0f1d2e",            // rgb(15, 29, 46)
  inkTextStrong: "#06101c",      // rgb(6, 16, 28)
  inkTextSoft: "#34465e",        // rgb(52, 70, 94)
  inkTextMute: "#5b6e87",        // rgb(91, 110, 135)
  inkTextFaint: "rgba(15, 29, 46, 0.32)",

  // Vermillion — primary CTA, hanko, torii red
  vermillion: "#d83b27",
  vermillionBright: "#ee5141",
  vermillionDeep: "#8a1f12",
  vermillionGlow: "rgba(238, 81, 65, 0.55)",

  // Washi cream — primary text on DARK surfaces (in-game HUD, prematch).
  // For menu surfaces, use the inkText* tokens above.
  cream: "#f5ecd9",
  creamWarm: "#e8dcc8",
  creamMute: "rgba(245, 236, 217, 0.65)",
  creamFaint: "rgba(245, 236, 217, 0.12)",

  // Gold leaf — premium accents (use sparingly)
  gold: "#e8c547",
  goldDeep: "#b8860b",

  // Pumo ice blue — pulled from the character's mawashi belt.
  // Canonical secondary across ALL surfaces. On the SNOW palette
  // these are used for: hover-state borders, the sash divider on
  // top of cards, the small accent rules on snow panels.
  ice: "#7ecbf0",
  iceBright: "#a8e0ff",
  iceDeep: "#1c4e6e",            // rgb(28, 78, 110)  — dark ice
  iceMid: "#3682aa",             // rgb(54, 130, 170) — mid ice
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
  // All new code should use the ice* tokens above.
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

/*
 * Role-specific entrance motions. Added to break out of the "every
 * panel fades up the same way" pattern that made the UI feel templated.
 * Pick the animation that matches what the element actually IS:
 *
 *   - broadcastSlideDown : top-of-frame chrome that drops in from the
 *                          letterbox bar (broadcast bars, live chips)
 *   - clipRevealUp       : bottom-of-frame chrome that comes in from
 *                          its own bottom edge (lower-third, footers)
 *   - clipRevealLeft /
 *     clipRevealRight    : side panels that come in from their outer
 *                          edge (wrestler vignettes, side cards)
 *   - stampImpression    : a stamp/seal landing — quick scale-in from
 *                          oversized + small rotation settle. Used for
 *                          things that should READ as a stamp, not a
 *                          floating UI element.
 *
 * IMPLEMENTATION NOTE: these were originally written as `clip-path`
 * reveals, which look great in isolation but tank performance on
 * any screen that's animating them over live content (PreMatchScreen
 * was choking — clip-path forces CPU rasterization every frame and
 * bypasses the compositor). They've been rewritten to use only the
 * two compositor-cheap properties: `transform` and `opacity`. The
 * directional character is preserved (drop down from above, slide
 * in from sides, slide up from below) and elements that animate
 * with these should also set `will-change: transform, opacity` so
 * the browser pre-promotes them to their own layer.
 *
 * The names are kept (`clipRevealUp`, etc.) because callers across
 * MainMenu, Lobby, and PreMatchScreen reference them; only the
 * implementation moved to a faster path.
 */

/* Top-center chrome dropping down. The translate(-50%, ...) preserves
 * the horizontal centering that callers apply via base styles. */
export const broadcastSlideDown = keyframes`
  from { opacity: 0; transform: translate(-50%, -28px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
`;

/* Top-right chrome dropping down. No centering needed — caller
 * positions via right: anchors. */
export const broadcastSlideDownRight = keyframes`
  from { opacity: 0; transform: translateY(-28px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* Bottom-of-frame chrome coming up. Slightly larger travel than
 * fadeUp's 10px so it still reads as a deliberate "bottom-anchored
 * insertion" rather than a generic fade. */
export const clipRevealUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* Side panels sliding in from outer edges. Travel is wider than
 * slideInLeft/Right so the directional intent is visible without
 * needing a clip wipe. */
export const clipRevealLeft = keyframes`
  from { opacity: 0; transform: translateX(-36px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const clipRevealRight = keyframes`
  from { opacity: 0; transform: translateX(36px); }
  to   { opacity: 1; transform: translateX(0); }
`;

/*
 * Stamp impression — the hanko stamp landing on the page. Starts
 * oversized + slightly rotated, snaps down with a small overshoot
 * settle, then lands. Reads as ink-on-paper, NOT a floating UI card.
 */
export const stampImpression = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-50%) rotate(-12deg) scale(1.6);
  }
  55% {
    opacity: 1;
    transform: translateX(-50%) rotate(0deg) scale(0.94);
  }
  78% {
    transform: translateX(-50%) rotate(-2deg) scale(1.04);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) rotate(-2deg) scale(1);
  }
`;

export const arrowNudge = keyframes`
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(4px); }
`;

export const livePulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6); }
  60%      { opacity: 0.85; box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
`;
