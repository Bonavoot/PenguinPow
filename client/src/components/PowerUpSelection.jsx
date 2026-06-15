import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import { C } from "./menuTheme";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import flapIcon from "../assets/flap-icon.png";

/*
 * PowerUpSelection — three picks on a darkened dohyo, no panel.
 *
 * THE REWRITE (vs. the previous "lacquered sumi-ink board" pass):
 *   The previous pass put the three power-up cards INSIDE a
 *   surrounding dark sumi panel — title strip, vermillion top
 *   rule, washi-fibre grain background, bordered timer row at
 *   the bottom. That was chrome around chrome: the panel was
 *   just a frame for cards that were already their own
 *   discrete surfaces. Two layers of "this is a UI" doing the
 *   work of one.
 *
 *   The cards are the actual interactive objects. The frame
 *   wasn't earning its space. So the frame is gone — the
 *   surrounding panel, the title, the diamond divider, the
 *   bordered timer row, all of it. What's left is what
 *   roguelikes ("pick a boon" in Hades, card rewards in Slay
 *   the Spire, item picks in Risk of Rain 2) figured out a
 *   long time ago: dim the world to a spotlight, put the
 *   picks ON the world as physical objects, let the player
 *   reach into the picks instead of into a window full of UI.
 *
 * SHAPE:
 *   - Arena dims to a flat ~55% black scrim. No vignette
 *     gradient, no radial spotlight, no warm haze. Hades
 *     and Slay the Spire both use flat dim — it's the
 *     single most powerful "the picks are the screen now"
 *     move and over-engineering it kills the effect.
 *   - Three cream washi cards sit centered on the dimmed
 *     dohyo, in a horizontal row, casting hard drop shadows
 *     onto the arena floor (so they read as physical objects
 *     resting on the dohyo, not as UI floating in front of
 *     it). The cards retain their two-zone composition
 *     (power-color header band with icon, cream body with
 *     name + description + usage chip) — that structure is
 *     what makes them read as cards rather than amorphous
 *     pickups, and the cream body is where description text
 *     lives so legibility never depends on stencil tricks.
 *   - No title. No "SELECT POWER" headline, no "CHOOSE YOUR
 *     SUMO EDGE" subtitle. The three cards + a floating
 *     timer already say "pick one before time runs out". A
 *     headline above three obviously-pickable cards is the
 *     same kind of redundant chrome the panel was — it's
 *     telling you what the screen is when the screen has
 *     already shown you what it is.
 *   - Free-floating timer at the bottom of the screen, in
 *     the same broadcast-SFX stencil text vocabulary
 *     PowerUpReveal uses (cream Bungee with sumi stroke +
 *     halo). Vermillion when ≤5s — single discrete color
 *     swap, no infinite pulse loop.
 *
 * FEEL — fun to press:
 *   The hover and press states are tuned for arcade weight,
 *   not boardroom polish. A card on hover lifts -12px and
 *   scales to 1.025 with a soft outer halo in its power
 *   color — it physically rises to meet the cursor. Press
 *   compresses it back to -6px / 1.005 in 80ms (snap, then
 *   release). Locking a pick lifts it further to -16px /
 *   1.035 with a thicker halo, and the other two cards
 *   simultaneously retreat — opacity drops to 0.22, color
 *   desaturates to 30%, scale shrinks to 0.97. The picked
 *   card is alone on the spotlight; the unpicked cards
 *   dissolve back into the dim arena.
 *
 *   No rotation on hover (the user explicitly disliked
 *   crooked-on-hover in the previous PowerUpReveal pass —
 *   the principle carries over). No infinite shimmer on
 *   the cards. No pulse on the selected state. Each beat
 *   of the interaction is a single state change.
 *
 * COLOR BUDGET:
 *   Cream cards + sumi text + the five functional power-type
 *   colors (cyan / red / blue / orange / purple) on each
 *   card's header band and hover halo + one vermillion
 *   urgent-timer color. No gold trim, no dark brown anywhere
 *   on the screen.
 */

// ============================================
// ANIMATIONS
// ============================================

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/*
 * Cards "deal in" from below. Slide up + fade, no rotation,
 * no overshoot. Each card lands ~80ms after the previous one
 * so the row reads as three cards being placed in sequence
 * onto the dohyo, not as one synchronized UI element appearing.
 */
const cardDealIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(28px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const timerFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// ============================================
// OVERLAY + STAGE
// ============================================

const PowerUpSelectionOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
  opacity: 0;
  animation: ${overlayFadeIn} 0.22s ease-out forwards;

  /*
   * The single move that compensates for losing the panel —
   * dim the arena harder so the cards POP as the only bright
   * thing on screen. Flat black at 55%; no radial gradient,
   * no warm wash, no backdrop-filter (the menu theme rules
   * forbid backdrop-filter explicitly).
   */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
  }
`;

const PowerUpSelectionStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(22px, 3.4cqh, 36px);
  padding: clamp(24px, 4vh, 48px) clamp(20px, 4vw, 40px);
  pointer-events: none;
`;

// ============================================
// CARDS
// ============================================

const CardsContainer = styled.div`
  display: flex;
  gap: clamp(14px, 1.9cqw, 24px);
  justify-content: center;
  align-items: stretch;
  flex-wrap: nowrap;
  pointer-events: auto;
  /* Padding-top reserves room for the hover-lift translateY
     so cards rising on hover don't get clipped by an
     ancestor's overflow boundary or look like they're
     punching through the layout above. */
  padding-top: clamp(14px, 2cqh, 22px);
`;

/*
 * Power-type colors. Each card gets a main fill (the header
 * band), a deep variant (the bottom-edge bevel), and a glow
 * color (the hover halo). The five colors are the same
 * functional gameplay set the player learns once during
 * selection and re-encounters in the PowerUpReveal underline
 * and the in-game power-up chip.
 */
const TYPE_COLORS = {
  speed: {
    main: "#00d2ff",
    deep: "#005f80",
    glow: "rgba(0, 210, 255, 0.45)",
  },
  power: {
    main: "#ff4444",
    deep: "#7a1c1c",
    glow: "rgba(255, 68, 68, 0.45)",
  },
  snowball: {
    main: "#74b9ff",
    deep: "#2a4a78",
    glow: "rgba(116, 185, 255, 0.45)",
  },
  pumo_army: {
    main: "#ffaa44",
    deep: "#8a5418",
    glow: "rgba(255, 170, 68, 0.45)",
  },
  thick_blubber: {
    main: "#aa77ff",
    deep: "#4a2c8a",
    glow: "rgba(170, 119, 255, 0.45)",
  },
  flap: {
    main: "#34e0c0",
    deep: "#15705f",
    glow: "rgba(52, 224, 192, 0.45)",
  },
};
const FALLBACK_TYPE = {
  main: C.gold,
  deep: C.goldDeep,
  glow: "rgba(232, 197, 71, 0.45)",
};

const getTypeColor = (type) => TYPE_COLORS[type] || FALLBACK_TYPE;

/*
 * Power card — printed program / trading card.
 *
 * This is the v3 pass on the card surface. v1 was a square-ish
 * "button with a colored header chip"; it read as functional UI,
 * not as a collectable object. v2 made the header taller but kept
 * the square aspect — same problem, slightly bigger.
 *
 * v3 (this pass) commits to actually being a card:
 *   - PORTRAIT 5:7 aspect ratio. The single move that shifts the
 *     read from "two-zone button" to "card you'd pick up off a
 *     table". Every printed card game (Pokemon, MTG, Hearthstone,
 *     Slay the Spire, Hades boons) lives in a portrait aspect for
 *     exactly this reason.
 *   - DOUBLE-BORDERED FRAME. The 2px sumi border is the cardstock
 *     edge. A 1px faint inner frame inset 4px (via ::after pseudo)
 *     is the printed-frame-on-paper detail. Without that inner
 *     line cards look like web UI cards; with it they look like
 *     printed objects. This is the move people don't notice
 *     consciously but feel viscerally.
 *   - DOMINANT ART PANEL. The colored header is now ~52% of card
 *     height (was ~33%) with a substantially larger icon. The
 *     icon IS the card; the info zone supports it.
 *   - SHARP CORNERS. No border-radius. Rounded corners read as
 *     app-UI; sharp corners read as printed program / banzuke
 *     entry / fighting-game-poster — the family the rest of this
 *     game lives in.
 *
 * Interaction states (preserved from v2 — they were tuned right):
 *   REST    : translateY(0) scale(1), neutral warm shadow
 *   HOVER   : translateY(-12px) scale(1.025), power-color border,
 *             soft outer halo. Card rises to meet the cursor.
 *   PRESS   : translateY(-6px) scale(1.005), 80ms snap.
 *   PICKED  : translateY(-16px) scale(1.035), thicker halo.
 *             The chosen card is alone on the spotlight.
 *   LOCKED  : opacity 0.22 + saturate(0.3) + scale(0.97). The
 *             unpicked cards retreat into the dim arena.
 */
const PowerCard = styled.button`
  --type-color: ${(p) => getTypeColor(p.$type).main};
  --type-deep: ${(p) => getTypeColor(p.$type).deep};
  --type-glow: ${(p) => getTypeColor(p.$type).glow};

  position: relative;
  flex: 0 0 auto;
  width: clamp(132px, 14cqw, 168px);
  /* Portrait trading-card aspect. Previous pass used 5:7 (the
     classic Pokemon/MTG ratio) but with the brief copy on these
     cards (~2 lines of name + description) that left a lot of
     dead cream below the description before the UsageChip in
     the corner. 5:6 keeps the portrait orientation and the
     trading-card silhouette but trims the body's vertical
     space so the content sits compactly instead of floating
     against a tall empty background. Header (48% flex) shrinks
     proportionally too, so the colored art panel stays smaller
     than the cream info zone — the hierarchy is preserved,
     just at a more compact scale. */
  aspect-ratio: 5 / 6;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: ${C.cream};
  border: 2px solid rgba(60, 40, 20, 0.55);
  cursor: pointer;
  font-family: "Space Grotesk", sans-serif;
  padding: 0;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45),
    0 2px 0 rgba(60, 40, 20, 0.55);
  opacity: 0;
  animation: ${cardDealIn} 0.38s cubic-bezier(0.2, 0.7, 0.2, 1)
    forwards;
  animation-delay: ${(p) => 0.08 + p.$index * 0.08}s;
  transition: transform 0.18s cubic-bezier(0.2, 0.7, 0.2, 1),
    border-color 0.18s ease, box-shadow 0.18s ease,
    opacity 0.22s ease, filter 0.22s ease;
  will-change: transform, opacity;

  /* Printed inner frame — the 1px line inset 4px from the
     cardstock edge. Sits over the contents as pure decoration;
     pointer-events: none keeps clicks reaching the card. The
     ::after sits on z-index 3, above the header band's color
     wash (which sits at default z-index) and the body's grain
     ::before — so the printed frame reads as the topmost edge
     ornament without affecting the actual layout. */
  &::after {
    content: "";
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(60, 40, 20, 0.32);
    pointer-events: none;
    z-index: 3;
  }

  &:hover:not(:disabled) {
    transform: translateY(-12px) scale(1.025);
    border-color: var(--type-color);
    box-shadow: 0 22px 34px rgba(0, 0, 0, 0.55),
      0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 1px var(--type-color),
      0 0 32px var(--type-glow);
  }

  &:active:not(:disabled) {
    transform: translateY(-6px) scale(1.005);
    transition: transform 0.08s ease;
  }

  ${(p) =>
    p.$selected &&
    css`
      transform: translateY(-16px) scale(1.035);
      border-color: var(--type-color);
      box-shadow: 0 28px 40px rgba(0, 0, 0, 0.6),
        0 2px 0 rgba(60, 40, 20, 0.55),
        0 0 0 2px var(--type-color), 0 0 44px var(--type-glow);
    `}

  &:disabled {
    cursor: not-allowed;
    ${(p) =>
      !p.$selected &&
      css`
        opacity: 0.22;
        filter: saturate(0.3) brightness(0.88);
        transform: translateY(0) scale(0.97);
      `}
  }

  @media (max-width: 700px) {
    width: clamp(106px, 22cqw, 134px);
  }
`;

/*
 * Card art panel — ~48% of card height.
 *
 * Iteration note: the v2 pass had this at 52% with an icon
 * clamp of 56-88px. In playtest the art panel felt too
 * dominant relative to the body's text content. Pulled back
 * to 48% panel + 52-78px icon clamp here — the panel is
 * still the dominant zone but no longer dominant-feeling,
 * which gives the centered title+desc cluster below room to
 * breathe rather than crowding against the inner frame.
 *
 * Sizing is via `flex: 0 0 48%` so the panel always takes a
 * fixed portion of card height regardless of body content
 * length. Fixed proportions are what separate a trading-card
 * layout from a UI-card layout.
 *
 * Flat power-type color fill (no 135deg gradient — that's
 * the canonical AI app-icon look). The 2px deep-color
 * bottom-edge bevel + the 1px highlight on top sell the
 * "stamped panel" feel without needing a separate divider. */
const CardHeader = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 48%;
  background: var(--type-color);
  box-shadow: inset 0 -2px 0 var(--type-deep),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);

  img {
    width: clamp(52px, 7cqw, 78px);
    height: clamp(52px, 7cqw, 78px);
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.5));
  }

  @media (max-width: 700px) {
    img {
      width: clamp(40px, 8.5cqw, 58px);
      height: clamp(40px, 8.5cqw, 58px);
    }
  }
`;

/* Info zone — bottom ~52% of the card.
 *
 * Title + description cluster sits at the TOP of the zone with
 * the description directly beneath the title (banzuke-entry
 * stack: title, rule, description). The previous centered-cluster
 * pass left a lot of dead space above the title against the
 * hairline rule and made the description text feel low and
 * orphaned. Top-anchored cluster reads as proper card layout —
 * title and description are a unit and they belong at the top
 * of the info zone, the same way set names sit at the top of a
 * Pokemon card's text panel.
 *
 * The UsageChip is removed from the flex flow entirely and
 * absolute-positioned to the bottom-right corner of the card.
 * That decouples its placement from the cluster above and
 * matches the "classification mark in the corner" convention
 * on every real printed card — Pokemon set code, MTG expansion
 * symbol, Hearthstone rarity gem. */
const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(4px, 0.55cqh, 7px);
  padding: clamp(11px, 1.5cqh, 15px) clamp(9px, 1.1cqw, 13px)
    clamp(22px, 3cqh, 30px);
  position: relative;
  flex: 1;
  border-top: 1px solid rgba(60, 40, 20, 0.35);

  /* Washi paper texture — vertical fibers (90deg) + horizontal
     weave (0deg) at low alpha. Same recipe as the in-game
     RankPlaque so the prematch program, the HUD rank tag, and
     these selection cards are all visibly printed on the same
     paper stock. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent 2px,
        rgba(60, 40, 20, 0.055) 2px,
        rgba(60, 40, 20, 0.055) 3px
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 4px,
        rgba(60, 40, 20, 0.04) 4px,
        rgba(60, 40, 20, 0.04) 5px
      );
    pointer-events: none;
  }
`;

/* Power-up name — printed-program / banzuke entry.
 *
 * Sumi-ink Bungee on cream with a letterpress impression. The
 * text-shadow is a soft cream highlight directly below the
 * type — no offset, no color shift — which makes the letters
 * read as PRESSED INTO the paper rather than painted on top
 * of it. This is the actual visual signature of letterpress
 * printing (the technique used for banzuke programs, vintage
 * fight cards, and Edo-period printed announcements): the
 * ink-bearing plate compresses the paper, raising a tiny
 * highlight along the bottom edge of each pressed letter.
 *
 * The styling lives ON THE TYPE ITSELF instead of as a
 * separate ornament next to it. Previous passes tried a
 * vermillion offset shadow (read as a stray red blur) and
 * decorative bars (read as ornament without purpose). The
 * letterpress effect avoids both pitfalls: no new color in
 * play, no separate element, and the visual reason for the
 * highlight is real (paper depth, not arbitrary decoration).
 *
 * white-space: nowrap + tightened letter-spacing also fixes
 * "THICK BLUBBER" (the longest power name) from wrapping to a
 * second line on the narrowest card width — at the previous
 * 0.07em letter-spacing the name sat right at the overflow
 * threshold and broke the visual grid across cards. */
const PowerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.18cqw, 0.92rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.05;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255, 252, 244, 0.7);

  @media (max-width: 700px) {
    font-size: clamp(0.58rem, 1.9cqw, 0.76rem);
  }
`;

const PowerDesc = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.5rem, 0.88cqw, 0.66rem);
  color: ${C.inkTextSoft};
  text-align: center;
  line-height: 1.25;
  letter-spacing: 0.03em;
  position: relative;

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.5cqw, 0.56rem);
  }
`;

/*
 * Usage chip — a printed hanko-style tag in the card's
 * bottom-right corner.
 *
 * Previous pass was a flat-rectangle "PASSIVE" / "F TO USE"
 * button shape centered under the description text. It read
 * as a web button — the most "this is a UI" element on the
 * card, sitting on a surface that was otherwise working hard
 * to feel like a printed card.
 *
 * Now it's positioned bottom-right via flex-end + margin-top:
 * auto on the parent body, the same "card type indicator"
 * placement Pokemon (set code), MTG (expansion symbol), and
 * Hearthstone (rarity gem) all use. That position is the
 * SIGNATURE of a printed card layout — the bottom-right corner
 * is reserved for the small classification mark, never for
 * primary information.
 *
 * Visual treatment is split by usage class:
 *
 *   PASSIVE → faint sumi-on-cream. Recedes — passive abilities
 *             don't need attention, they're "ambient" effects.
 *             No background fill, just a 1px sumi line and
 *             muted ink letterforms. Reads as the equivalent
 *             of a set code: present but not loud.
 *   ACTIVE  → vermillion fill + cream text + sumi border. A
 *             real hanko ink stamp on the cardstock. The
 *             vermillion is the SAME color the GASSED hanko
 *             on the HUD uses, so the meaning across the
 *             whole game is consistent: "vermillion stamp
 *             over cream = something is HOT and needs your
 *             attention." For active power-ups the message
 *             is "press F", which is exactly the
 *             needs-attention case the vermillion vocabulary
 *             is built for. The previous pass deliberately
 *             avoided vermillion here because of the red
 *             Power Water card header; in practice the two
 *             reds don't conflict — the card header is a
 *             saturated UI red (#ff4444), the stamp is the
 *             dyed vermillion (#d83b27). They sit in
 *             different color families and read as different
 *             materials. */
const UsageChip = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.4rem, 0.66cqw, 0.5rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 2px clamp(6px, 0.8cqw, 9px);
  /* Absolute-positioned to the printed inner frame's bottom-right
     corner. The bottom offset lines it up just inside the ::after
     decorative frame (which is inset 4px), so visually the chip
     rides just inside the printed frame line rather than against
     the cardstock edge — that's the convention real trading cards
     use for the classification mark. */
  position: absolute;
  bottom: clamp(7px, 1cqh, 10px);
  right: clamp(7px, 0.9cqw, 11px);
  background: ${(p) =>
    p.$active ? C.vermillion : "transparent"};
  color: ${(p) => (p.$active ? C.cream : C.inkTextMute)};
  border: 1px solid
    ${(p) =>
      p.$active ? C.vermillionDeep : "rgba(60, 40, 20, 0.32)"};
  ${(p) =>
    p.$active &&
    css`
      box-shadow: inset 0 0 0 1px rgba(245, 236, 217, 0.18),
        0 1px 0 rgba(0, 0, 0, 0.18);
      text-shadow: 0 1px 0 rgba(70, 18, 8, 0.5);
    `}
  z-index: 4;
  white-space: nowrap;

  @media (max-width: 700px) {
    font-size: clamp(0.34rem, 1.05cqw, 0.44rem);
    letter-spacing: 0.16em;
  }
`;

// ============================================
// TIMER — free-floating broadcast-SFX stencil
// ============================================

/*
 * Stacked label + number, no border, no diamond, no row chrome.
 * Same legibility recipe as PowerUpReveal (cream Bungee with
 * sumi stencil stroke + halo) so it reads against any arena
 * content underneath without a panel behind it.
 *
 * Single-color urgency: when ≤5s, the number swaps from cream
 * to vermillion. No infinite scale pulse, no shadow-breathe
 * loop — the color swap is signal enough, and the player is
 * already looking at this number.
 */
const TimerStack = styled.div`
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(3px, 0.5cqh, 6px);
  opacity: 0;
  animation: ${timerFadeIn} 0.32s ease-out forwards;
  animation-delay: 0.32s;
`;

const TimerLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.85cqw, 0.7rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.32em;
  text-shadow: -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
    0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi},
    0 2px 0 rgba(0, 0, 0, 0.5), 0 0 6px rgba(0, 0, 0, 0.6);

  @media (max-width: 700px) {
    font-size: clamp(0.42rem, 1.4cqw, 0.6rem);
    letter-spacing: 0.24em;
  }
`;

const TimerNumber = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(1.4rem, 2.6cqw, 2.1rem);
  color: ${(p) => (p.$urgent ? C.vermillionBright : C.cream)};
  letter-spacing: 0.04em;
  line-height: 1;
  transition: color 0.2s ease;
  text-shadow: -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
    0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
    -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
    -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
    0 3px 0 rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 0, 0, 0.7);

  small {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    font-size: 0.42em;
    margin-left: 5px;
    letter-spacing: 0.2em;
    color: ${(p) => (p.$urgent ? C.vermillionDeep : C.creamMute)};
    text-shadow: -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
      0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi};
  }

  @media (max-width: 700px) {
    font-size: clamp(1.05rem, 3.4cqw, 1.6rem);
  }
`;

// ============================================
// COMPONENT
// ============================================

const PowerUpSelection = ({
  roomId,
  playerId,
  onSelectionComplete,
  onSelectionStateChange,
}) => {
  const { socket } = useContext(SocketContext);
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Speed & dash",
        icon: happyFeetIcon,
        active: false,
      },
      power: {
        name: "Power Water",
        description: "+20% knockback",
        icon: powerWaterIcon,
        active: false,
      },
      snowball: {
        name: "Snowball",
        description: "Max 5 throws",
        icon: snowballImage,
        active: true,
      },
      pumo_army: {
        name: "Pumo Army",
        description: "3 clone waves",
        icon: pumoArmyIcon,
        active: true,
      },
      thick_blubber: {
        name: "Thick Blubber",
        description: "Block 1 hit",
        icon: thickBlubberIcon,
        active: false,
      },
      flap: {
        name: "Flap",
        description: "Take flight",
        icon: flapIcon,
        active: true,
        usageLabel: "Space",
      },
    }),
    []
  );

  const isUrgent = timeLeft <= 5;

  const countdownIntervalRef = useRef(null);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdownTimer = useCallback(() => {
    clearCountdownInterval();
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdownInterval]);

  useEffect(() => {
    const handlePowerUpSelectionStart = (data) => {
      // If the countdown is already running (duplicate event from
      // request_power_up_selection_state), just update power-ups without
      // restarting the timer — keeps the client in sync with the server.
      if (countdownIntervalRef.current) {
        setAvailablePowerUps(data.availablePowerUps || []);
        return;
      }
      setIsVisible(true);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);
      startCountdownTimer();
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionComplete = () => {
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    const handleGameReset = () => {
      setIsVisible(false);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
    socket,
  ]);

  useEffect(() => {
    const requestPowerUpState = () => {
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]);

  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return;
      playPowerUpSelectionPressSound();
      setSelectedPowerUp(powerUpType);
      socket.emit("power_up_selected", {
        roomId,
        playerId,
        powerUpType,
      });
    },
    [selectedPowerUp, socket, roomId, playerId]
  );

  if (!isVisible) return null;

  const hudEl = document.getElementById("game-hud");
  if (!hudEl) return null;

  return createPortal(
    <PowerUpSelectionOverlay>
      <PowerUpSelectionStage>
        <CardsContainer>
          {availablePowerUps.map((type, index) => {
            const info = powerUpInfo[type];
            if (!info) return null;
            const isSelected = selectedPowerUp === type;
            const isLocked = selectedPowerUp && !isSelected;

            return (
              <PowerCard
                key={type}
                $type={type}
                $selected={isSelected}
                $index={index}
                onClick={() => handlePowerUpSelect(type)}
                onMouseEnter={playPowerUpSelectionHoverSound}
                disabled={isLocked}
                type="button"
              >
                <CardHeader>
                  <img src={info.icon} alt={info.name} />
                </CardHeader>
                <CardBody>
                  <PowerName>{info.name}</PowerName>
                  <PowerDesc>{info.description}</PowerDesc>
                  <UsageChip $active={info.active}>
                    {info.active ? info.usageLabel || "F To Use" : "Passive"}
                  </UsageChip>
                </CardBody>
              </PowerCard>
            );
          })}
        </CardsContainer>

        <TimerStack>
          <TimerLabel>Lock In</TimerLabel>
          <TimerNumber $urgent={isUrgent}>
            {timeLeft > 0 ? timeLeft : 0}
            <small>S</small>
          </TimerNumber>
        </TimerStack>
      </PowerUpSelectionStage>
    </PowerUpSelectionOverlay>,
    hudEl
  );
};

PowerUpSelection.propTypes = {
  roomId: PropTypes.string.isRequired,
  playerId: PropTypes.string.isRequired,
  onSelectionComplete: PropTypes.func,
  onSelectionStateChange: PropTypes.func,
};

export default PowerUpSelection;
