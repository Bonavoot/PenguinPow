import PropTypes from "prop-types";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled, { keyframes, css } from "styled-components";

import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import { BOUT_SECONDS, CLOCK_URGENT_AT } from "../config/boutClock";
import { getPowerUpTypeColor } from "../config/powerUpConfig";
import {
  C,
  FONT_CLOCK,
  FONT_DISPLAY,
  FONT_KANJI,
  FONT_RENDER,
  FONT_UI,
  FONT_WEIGHT,
  HUD,
  TEXT_SHADOW_UI,
  TRACK,
} from "./menuTheme";
import BalanceGauge from "./BalanceGauge";

/*
 * Pumo Pumo HUD — "cream chrome" broadcast band.
 *
 * One structural color (washi cream), always OPAQUE, always wrapped in a
 * dark keyline so the silhouette holds over a packed crowd. Fills touch
 * the stroke directly — no inset track, no inner radius, no gloss. The
 * only saturated color on the band is the fill itself: jade stamina, ice
 * posture, vermillion alarm. Gold is demoted to three accents — rank
 * type, won rounds, and the push-war lead ring.
 *
 * The disc capping each bar's outer end and the center round medallion
 * share a diameter, so the band reads as one continuous run of hardware
 * from screen edge to screen edge rather than five floating widgets.
 *
 * Stamina is the hero. Posture is a segmented secondary meter
 * (ice → gold → vermillion) — composure for grabs.
 */

// ============================================
// CHROME TOKENS
// ============================================

const CHROME = HUD.chrome;
const CHROME_DIM = HUD.chromeDim;
const KEYLINE = HUD.keyline;
const WELL = HUD.well;
const STROKE = HUD.stroke;
const ALARM = C.vermillionBright;

/* Shared vertical rhythm. STAMINA_MIDLINE_TOP / CLOCK_MIDLINE_TOP are
 * derived from these, so the match clock stays locked to the gauge
 * stack at every viewport size — change a value here, never in two places. */
const HUD_PAD_TOP = "clamp(12px, 1.7cqh, 20px)";
/* Tracks NAME_SIZE's unit (cqw, not cqh) at a fixed ~1.29x ratio, so the
 * row is always taller than the shikona at every viewport. If this used
 * cqh it would fall below the type on wide-short windows and NameBlock's
 * overflow:hidden would clip the glyphs. */
const NAME_SIZE = "clamp(14px, 1.95cqw, 24px)";
const NAME_ROW_H = "clamp(18px, 2.5cqw, 31px)";
const NAME_GAP = "clamp(4px, 0.6cqh, 8px)";
/* Horizontal gutter between items in the name row. BarRowSpacer has to
 * subtract it — see the comment there. */
const NAME_ROW_GAP = "clamp(5px, 0.6cqw, 10px)";
/* Text margin inside the stamina track. The shikona above the bar, the
 * in-bar labels, and the rank plaque below all share it, so the wing has
 * one typographic column from top to bottom.
 *
 * Tightened once the slot was detached: it had been widened purely so
 * the shikona would clear a slot that overhung the bar's start, and with
 * a real gutter there that job is done by the gutter. It only has to be
 * a text margin now. */
const BAR_TEXT_INSET = "clamp(6px, 0.85cqw, 12px)";
/* Footprint reserved for the rank, independent of what is in it today.
 * Per-rank badge art is coming and will be larger than a text chip; the
 * lane is sized for that now so nothing below has to move later. */
const RANK_ROW_H = "clamp(17px, 1.7cqw, 24px)";
const BAR_H = "clamp(22px, 4cqh, 40px)";

/* Slot stands apart from the bar with a real gutter. It briefly bit into
 * the bar's outer end so the two would read as one assembly, but a slot
 * fused to the bar reads as part of the meter — as if the icon were the
 * bar's endcap — and it left the shikona nowhere clean to start. Overhung
 * top and bottom, separated by a gutter, it is plainly its own object
 * sitting alongside. */
const SLOT = "clamp(30px, 3.9cqw, 46px)";
const SLOT_GAP = "clamp(5px, 0.62cqw, 9px)";
/* Horizontal room consumed before the stamina bar's border begins. */
const RAIL_LEAD = `calc(${SLOT} + ${SLOT_GAP})`;

// ============================================
// ANIMATIONS
// ============================================

/* Sweeping brass shine across the balance fill */
const iceShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
`;

/* Pulsing glow overlay during stamina regeneration */
const regenPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
`;

/* Bright green flash for parry stamina refund — punchy and unmissable */
const parryRefundFlash = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 20px rgba(74, 255, 160, 0.9), 0 0 16px rgba(74, 255, 160, 0.7);
  }
  30% {
    opacity: 0.9;
    box-shadow: inset 0 0 14px rgba(74, 255, 160, 0.6), 0 0 10px rgba(74, 255, 160, 0.4);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(74, 255, 160, 0), 0 0 0px rgba(74, 255, 160, 0);
  }
`;

/* Subtle danger pulse — modulates the frame border opacity gently when
 * stamina is critical. Was a multi-layer red glow halo for the old
 * chiseled gold-ring frame; with the minimalist hairline border, the
 * border color (vermillionBright at $danger) is the alarm signal,
 * and this pulse just breathes the brightness so the bar doesn't sit
 * dead at the danger threshold. Same brightness/saturation approach
 * the gassed pulse uses, slightly punchier amplitude since $danger
 * fires at higher stamina than $gassed. */
const dangerFramePulse = keyframes`
  0%, 100% { filter: brightness(1)    saturate(1); }
  50%      { filter: brightness(1.18) saturate(1.2); }
`;

/* Blinking warning light on the stroke — cream, vermillion, cream.
 *
 * A statically vermillion border was the first attempt and it failed for
 * a real reason: at the same value as the fill it erased the bar's
 * silhouette, and two nearly identical reds touching read as a smear
 * instead of an alarm. Dropping it entirely lost the alert.
 *
 * Alternating is what fixes it. It is the SAME vermillion, but it can
 * never sit merged with the fill for more than half a cycle, and the
 * cream half restores the edge — so the bar keeps its shape while the
 * blink does the shouting. The plateaus are long and the crossfade
 * between them short, so it reads as a lamp switching rather than a
 * colour breathing.
 *
 * Always run on the SAME duration as the brightness pulse beside it.
 * On different periods the two drift and the bar looks chaotic instead
 * of alarmed. */
const dangerBorderFlash = keyframes`
  0%,  42%  { border-color: ${CHROME}; }
  54%, 96%  { border-color: ${ALARM}; }
  100%      { border-color: ${CHROME}; }
`;

/* Quick pulse alarm — strobes the red wash dim → bright → dim on a
 * fast cadence, like an actual warning indicator light blinking. Uses
 * brightness + saturation modulation so the underlying red stays
 * solid (the lane never fades to transparent) but its luminance
 * pulses dramatically.
 *
 * Replaces the previous slow opacity breath. That recipe animated
 * the overlay's alpha from 0.6 → 0.92, which during the dim phase
 * let the empty stamina bar bleed through underneath. Reading "the
 * red overlay is fading away" works against the alarm intent — the
 * overlay isn't going anywhere, the wrestler is still gassed.
 *
 * Brightness ramps 0.78 (dim drained crimson) ↔ 1.42 (vibrant alarm
 * vermillion) with a coordinated saturation lift at the peak so the
 * red actually feels hot at the apex rather than just lighter. The
 * combination reads as a single strobing surface rather than a
 * surface that's fading in and out. */
const gassedAlarmPulse = keyframes`
  0%, 100% { filter: brightness(0.72) saturate(0.92); }
  50%      { filter: brightness(1.02) saturate(1); }
`;

/* Subtle vermillion frame intensity pulse when gassed.
 *
 * Replaces the previous multi-layer red glow halo (4 stacked box-shadows
 * fanning red light up to 48px out from the bar). That was loud but
 * read as "the bar is leaking red gas" rather than "the wrestler is in
 * danger". The new approach colors the FRAME ITSELF vermillion (handled
 * directly in BarFrame's box-shadow ramp), and this keyframe just
 * gently breathes the intensity of that vermillion ring — slow heartbeat
 * cadence, narrow alpha range, no outer glow blooming.
 *
 * The dramatic alarm signal is the COLOR SHIFT of the hardware (gold →
 * vermillion). The pulse is just life on top of that shift. */
const gassedFramePulse = keyframes`
  0%, 100% { filter: brightness(1) saturate(1); }
  50%      { filter: brightness(1.12) saturate(1.15); }
`;

/* Green-mint burst when recovering from gassed state — "second wind" */
const recoveryBurst = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 30px rgba(225, 255, 241, 0.96), 0 0 24px rgba(75, 231, 158, 0.84);
  }
  25% {
    opacity: 0.9;
    box-shadow: inset 0 0 20px rgba(225, 255, 241, 0.62), 0 0 16px rgba(75, 231, 158, 0.5);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(225, 255, 241, 0), 0 0 0px rgba(75, 231, 158, 0);
  }
`;

const recoveryTextPop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
  35% {
    transform: translate(-50%, -50%) scale(0.95);
  }
  50% {
    transform: translate(-50%, -50%) scale(1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.05);
  }
`;

/* Impact strike — a thin sharp vertical hairline at the trailing edge of
 * the stamina fill. Replaces the previous radial-blob ImpactSpark which
 * (a) lagged behind the bar's width transition because it was positioned
 * by data-value while the bar animated, and (b) read as a soft AI-style
 * white smudge instead of a designed mark. The new strike is mounted as
 * a CHILD of BarFill, pinned to the parent's trailing edge — so it
 * tracks the bar's animated width pixel-perfect with no transition
 * mismatch. Single quick squeeze + fade, no blur, no mix-blend-mode. */
const impactStrike = keyframes`
  0% {
    opacity: 0.95;
    transform: scaleY(1);
  }
  100% {
    opacity: 0;
    transform: scaleY(0.6);
  }
`;

/* One-shot frame shake on big stamina drops */
const frameShake = keyframes`
  0%, 100% { transform: translate(0, 0); }
  15%      { transform: translate(-1.5px, 0.5px); }
  30%      { transform: translate(1.5px, -0.5px); }
  45%      { transform: translate(-1px, -0.5px); }
  60%      { transform: translate(1px, 0.5px); }
  80%      { transform: translate(-0.5px, 0); }
`;

/* Slow horizontal drift on the gassed slash overlay — keeps the strain
 * pattern alive without being twitchy.
 *
 * IMPORTANT — implementation note. This used to animate
 * `background-position-x` on the gradient itself, which had two
 * problems on the gassed lane:
 *
 *   1) Layer thrash. The parent (GassedBackdrop) is already animating
 *      a `filter` (gassedAlarmPulse, 0.78s) and the BarFrame above
 *      that is animating ANOTHER `filter` (gassedFramePulse, 1.6s).
 *      Both filters force composited layers. Animating background-
 *      position on a descendant of those layers forces a full repaint
 *      of the filtered surface every frame, which the compositor
 *      then re-rasterizes with the active filter. The result on
 *      lower-end machines and even on capable ones is a frame-rate-
 *      coupled wobble — the slashes appear to micro-stutter or
 *      "glitch" in time with the strobe.
 *
 *   2) Subpixel resampling. background-position interpolation feeds
 *      a fractional offset into the gradient, which the renderer
 *      re-samples on each paint. The resampled bands subtly shift
 *      between adjacent paints and read as flicker on the thin
 *      (3px) slash strokes.
 *
 * Switched to `transform: translate3d` on a widened ::before. The
 * gradient itself never moves relative to the ::before — the
 * RASTERIZED ::before layer is shifted by the compositor, which is
 * (a) GPU-accelerated, (b) does not repaint, (c) does not re-sample
 * the gradient, and (d) does not collide with the parent's filter
 * compositing. Loop math is identical: -22px ≈ one full X-period of
 * the -55deg / 18px-axis stripe pattern, so the visible window at
 * translateX(-22px) matches translateX(0) and the loop is seamless. */
const gassedSlashDrift = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-22px, 0, 0); }
`;

/* Hanko stamp impression for the GASSED text plate — single landing.
 * Quick scale-down from oversized + tiny rotation settle, like a real
 * vermillion seal being pressed onto paper. After the stamp lands it
 * sits still — no infinite pulse, no droop. The stamp IS the alarm. */
const gassedStamp = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.6) rotate(-6deg);
  }
  60% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.92) rotate(-2deg);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(-3deg);
  }
`;

/* Go-stone place ripple — single radial ring expanding outward */
const stonePlaceRipple = keyframes`
  0% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(0.6);
  }
  60% {
    opacity: 0.4;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.4);
  }
`;

// Shared vertical rhythm between HUD strips (stamina ↔ balance, name row ↔ stamina).
const gaugeStripGap = "clamp(8px, 1cqh, 14px)";

// ============================================
// MAIN HUD SHELL
// ============================================

const HudShell = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 clamp(6px, 1cqw, 14px) clamp(7px, 1.2cqh, 12px);
  padding-top: ${HUD_PAD_TOP};
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  filter: ${(p) =>
    p.$matchOver
      ? "saturate(0.84) brightness(0.86) contrast(0.97)"
      : "none"};
  /* No transform shift on matchOver. Previous pass added a 2px
     translateY downshift as a "stepped back" cue, but combined
     with the dimming below it produced a visible un-gradient'd
     strip at the very top of the screen — the gradient appeared
     to detach from the screen edge. The opacity + filter desat
     alone are enough to communicate the match-over state, and
     the gradient stays flush with the top edge where it belongs. */
  transition:
    opacity 260ms ease,
    filter 260ms ease;

  /* Scrim lives on #game-hud-info::before — behind this whole tree —
   * so it cannot paint over chrome. Shell stays transparent. */
  background: none;
`;

// ============================================
// PLAYER WING  (one per side)
// ============================================

const PlayerWing = styled.div`
  flex: 0 1 48%;
  max-width: min(560px, 45%);
  display: flex;
  flex-direction: column;
  gap: 0;
  /* Above the center wing rail so bar frames cover wing tips that
   * reach under the borders — wings read as coming OUT of the bars,
   * never painted on top of them. */
  position: relative;
  z-index: 2;
  transition: opacity 240ms ease, filter 240ms ease;
  opacity: ${(p) => (p.$matchOver ? 0.93 : 1)};
  filter: ${(p) => (p.$matchOver ? "brightness(0.94)" : "none")};
`;

// ============================================
// NAME BANNER  —  sumo shikona-style plate
// ============================================

/* Fixed height (not min-height) so STAMINA_MIDLINE_TOP's arithmetic is
 * exact — the match clock is positioned off that sum. */
const NameBanner = styled.div`
  display: flex;
  /* Bottom-aligned, not centered. The row is taller than the type so the
   * shikona can never be clipped, but centering left it floating in that
   * slack; sitting it on the row's floor puts the name a few px closer to
   * the bar it labels, and drops the score marks onto the same line. */
  align-items: flex-end;
  width: 100%;
  gap: ${NAME_ROW_GAP};
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  background: none;
  height: ${NAME_ROW_H};
  box-sizing: border-box;
  padding: 0;
  position: relative;
  margin-bottom: ${NAME_GAP};
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: ${(p) => (p.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
  overflow: hidden;
`;

/*
 * Shikona type — starts at the HUD clamp, then FitFighterName measures
 * and writes an exact px size so the full name always fits (same approach
 * as PreMatchScreen — never ellipsis / clip).
 *
 * Sized up ~35% from the previous clamp. The shikona is the only element
 * on the band allowed to be big; everything else sits around 9-11px. A
 * wide gap between the largest and second-largest type is most of what
 * separates a designed HUD from a row of same-size labels — and the
 * extra mass above the bar is what anchors the band to the top edge, so
 * the bar can sit where it does without looking like it floated up there.
 */
const FighterName = styled.div`
  width: 100%;
  min-width: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: ${NAME_SIZE};
  /* Brighter than the chrome, and contoured like the clock.
   *
   * At plain C.cream the shikona was the exact same colour as a 2px
   * border, so the biggest thing on the band never claimed the top of the
   * hierarchy — hue is spoken for by the fills, which leaves value.
   *
   * The stroke is in em, not px: FitFighterName rewrites font-size inline
   * to fit long shikona, and a fixed px contour would turn chunky on a
   * name that shrank to 12px. In em it thins with the type. */
  color: ${HUD.heroType};
  ${FONT_RENDER}
  -webkit-text-stroke: 0.07em rgba(4, 6, 12, 0.95);
  paint-order: stroke fill;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-align: ${(p) => (p.$isRight ? "right" : "left")};
`;

const NAME_MIN_PX = 9;

/** Shrink font (then scaleX as a last resort) so the full name stays visible. */
function FitFighterName({ children, isRight = false }) {
  const ref = useRef(null);
  const side = isRight ? "right" : "left";

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.fontSize = "";
    el.style.transform = "";
    el.style.letterSpacing = "";

    const avail = el.clientWidth;
    if (avail <= 0) return;

    const maxPx = parseFloat(getComputedStyle(el).fontSize);
    if (!maxPx) return;

    let natural = el.scrollWidth;
    if (natural <= avail + 1) return;

    let next = maxPx * (avail / natural);
    if (next < NAME_MIN_PX) {
      el.style.fontSize = `${NAME_MIN_PX}px`;
      el.style.letterSpacing = "0.04em";
      natural = el.scrollWidth;
      if (natural > avail + 1) {
        const sx = avail / natural;
        el.style.transform = `scaleX(${sx})`;
        el.style.transformOrigin =
          side === "right" ? "right center" : "left center";
      }
      return;
    }

    el.style.fontSize = `${next}px`;
    if (next < maxPx * 0.72) el.style.letterSpacing = "0.04em";

    // Second pass — letter-spacing / subpixel can still overhang.
    if (el.scrollWidth > avail + 1) {
      next = Math.max(NAME_MIN_PX, next * (avail / el.scrollWidth));
      el.style.fontSize = `${next}px`;
      if (el.scrollWidth > avail + 1) {
        const sx = avail / el.scrollWidth;
        el.style.transform = `scaleX(${sx})`;
        el.style.transformOrigin =
          side === "right" ? "right center" : "left center";
      }
    }
  }, [children, side]);

  useLayoutEffect(() => {
    fit();
    const el = ref.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    let cancelled = false;
    const onFonts = () => {
      if (!cancelled) fit();
    };
    document.fonts?.ready?.then(onFonts);
    window.addEventListener("resize", fit);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return (
    <FighterName
      ref={ref}
      $isRight={isRight}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </FighterName>
  );
}

FitFighterName.propTypes = {
  children: PropTypes.node,
  isRight: PropTypes.bool,
};

// ============================================
// RANK PLAQUE — sumo banzuke-style ranking plate
// ============================================

/* Banzuke plaque — placeholder for the per-rank badge art.
 *
 * Fills the rank lane rather than hugging its text, and carries a
 * min-width, so a short rank and a long one occupy the same footprint
 * and the eventual artwork has a reserved shape to land in. Flat ink,
 * cream hairline, gold type — quiet, because it is the lowest and least
 * urgent thing on the wing. */
const RankPlaque = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  height: 100%;
  min-width: clamp(64px, 7.5cqw, 108px);
  padding: 0 clamp(6px, 0.8cqw, 11px);
  background: rgba(9, 12, 20, 0.94);
  border: ${HUD.strokeThin} solid ${CHROME};
  box-shadow: 0 0 0 1px ${KEYLINE};
`;

const RankText = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(8px, 0.92cqw, 11px);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  /* Cancel the trailing track so the label stays optically centered. */
  text-indent: 0.1em;
  line-height: 1;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_UI};
  white-space: nowrap;
`;

// ============================================
// STAMINA BAR  — THE HERO OF THE HUD
// ============================================

const shoveWinPulse = keyframes`
  0%, 100% { filter: brightness(1) saturate(1); }
  50% { filter: brightness(1.12) saturate(1.15); }
`;

const ShoveLeadTag = styled.div`
  position: absolute;
  top: 50%;
  ${(p) => (p.$isRight ? "left: 6px;" : "right: 6px;")}
  transform: translateY(-50%);
  z-index: 4;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(7px, 0.78cqw, 9px);
  letter-spacing: ${TRACK.meta};
  line-height: 1;
  pointer-events: none;
  user-select: none;
  color: ${(p) =>
    p.$lead > 0
      ? "rgba(255, 236, 170, 0.95)"
      : p.$lead < 0
        ? "rgba(255, 170, 150, 0.92)"
        : "rgba(210, 220, 230, 0.88)"};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_UI};
`;

/* Stamina bar frame — opaque cream stroke over a dark keyline.
 *
 * The previous frame was a 1.5px gold hairline at 38% alpha with L-shaped
 * corner brackets. Two problems, both fatal at HUD scale: a translucent
 * structural color sitting over a crowd of penguins literally changes hue
 * along its own length, and the brackets were ornament competing with the
 * one thing the frame has to do, which is describe a hard edge.
 *
 * Now: opaque cream, hard corners, and a 1px near-black keyline ringing
 * the outside so the cream survives whichever stage is behind it.
 *
 * Danger and gassed don't set a static stroke color — they BLINK it, via
 * dangerBorderFlash below. A stroke parked on vermillion is the same
 * value as the fill behind it and erases the bar's silhouette; blinking
 * the same vermillion against cream keeps the alert and the edge both.
 * Gold for a winning push war is the only state that holds the stroke at
 * a fixed color, because nothing else on the bar is gold. */
const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 0;
  border: ${STROKE} solid ${(p) =>
    p.$shoveLead > 0
      ? C.gold
      : p.$shoveLead < 0
        ? CHROME_DIM
        : CHROME};
  box-shadow:
    0 0 0 1px ${KEYLINE},
    0 clamp(1px, 0.12cqw, 3px) clamp(5px, 0.5cqw, 10px) rgba(0, 0, 0, 0.55);
  opacity: ${(p) => (p.$matchOver ? 0.95 : 1)};
  transition: border-color 240ms ease, opacity 220ms ease;
  overflow: visible;

  ${(p) => {
    const gassedDur = p.$matchOver ? "2.4s" : "1.6s";
    const dangerDur = p.$matchOver ? "1.15s" : "0.7s";
    const gassedAlarm = css`${gassedFramePulse} ${gassedDur} ease-in-out infinite, ${dangerBorderFlash} ${gassedDur} linear infinite`;
    const dangerAlarm = css`${dangerFramePulse} ${dangerDur} ease-in-out infinite, ${dangerBorderFlash} ${dangerDur} linear infinite`;
    if (p.$shake && p.$gassed) {
      return css`animation: ${frameShake} 0.32s ease-out, ${gassedAlarm};`;
    }
    if (p.$shake && p.$danger) {
      return css`animation: ${frameShake} 0.32s ease-out, ${dangerAlarm};`;
    }
    if (p.$shake) {
      return css`animation: ${frameShake} 0.32s ease-out;`;
    }
    if (p.$gassed) {
      return css`animation: ${gassedAlarm};`;
    }
    if (p.$danger) {
      return css`animation: ${dangerAlarm};`;
    }
    if (p.$shoveLead > 0 && !p.$matchOver) {
      return css`animation: ${shoveWinPulse} 0.9s ease-in-out infinite;`;
    }
    return "";
  }}
`;

/* Dark well the fill sits directly against — flat, no jade tint, no
 * directional gradient. Anything painted here shows through as a muddy
 * mid-tone between the cream stroke and the fill.
 *
 * The 1px ink border is the INNER half of the keyline pair. Every actor,
 * prop and crowd member in this game is drawn with a black contour, so
 * cream with ink on both sides is the chrome speaking the same language
 * as the art instead of floating on top of it. It also stops the jade
 * from touching the cream directly — two bright values sharing an
 * antialiased edge shimmer — and it keeps the fill visually separate
 * from the frame during the danger blink, when the stroke and the fill
 * are briefly the same red. Not the old 2px moat: that had its own
 * radius and read as a gap with the fill dropped into it. At exactly 1px
 * this is a drawn line, not a space. */
const BarTrack = styled.div`
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: ${BAR_H};
  border: 1px solid ${KEYLINE};
  border-radius: 0;
  overflow: hidden;
  background: ${WELL};
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.55);
`;

/* Quarter dividers — dark keylines cutting the full height of the bar,
 * painted OVER the fill (they used to sit under it at z-index 1, where
 * the fill hid them exactly when you needed them).
 *
 * Dark rather than cream because the stamina bar is usually mostly full:
 * the divider has to contrast with the jade, not with the empty well. */
const StaTickMark = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${(p) => p.$pct}%;
  transform: translateX(-50%);
  width: 1.5px;
  z-index: 4;
  pointer-events: none;
  background: rgba(5, 8, 14, 0.55);
`;

/* Jade stamina fill — flush to the stroke, flat, one hue ramp.
 *
 * This is the change that stops the bar looking cheap. It used to be
 * inset 2px on all four sides with its own 2px radius nested inside the
 * frame's 4px radius, which read as a green pill dropped into a tray:
 * the dark moat between stroke and fill was a mid-tone wedged between
 * the two strongest values on the band, killing the contrast of both,
 * and when the bar drained you couldn't tell the gutter from the empty
 * track. Now the fill IS the shape — inset 0, radius 0, so at full
 * stamina the well is completely invisible.
 *
 * Everything decorative is gone with it: the mint lip highlight, the
 * travelling sheen, the outer glow, the idle wobble, and the danger
 * opacity flash (which faded the fill to 55% and read as the bar
 * disappearing rather than as an alarm). Danger is carried by the hue
 * ramp plus the frame's vermillion stroke. */
const BarFill = styled.div.attrs((p) => ({
  style: {
    width: `${p.$stamina}%`,
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 0;
  transition: width 0.3s ease;
  z-index: 2;
  overflow: hidden;

  background: ${(p) =>
    p.$danger
      ? p.$isRight
        ? "linear-gradient(90deg, #8f1515 0%, #c41e1e 45%, #e23a3a 100%)"
        : "linear-gradient(90deg, #e23a3a 0%, #c41e1e 55%, #8f1515 100%)"
      : p.$isRight
        ? `linear-gradient(90deg, ${C.stamMid} 0%, ${C.stam} 45%, ${C.stamBright} 100%)`
        : `linear-gradient(90deg, ${C.stamBright} 0%, ${C.stam} 55%, ${C.stamMid} 100%)`};
`;

/* Impact strike — crisp 2px cream hairline pinned to the trailing edge
 * of the BarFill. Mounts as a CHILD of BarFill so it follows the bar's
 * animated width transition without lag — by construction, the strike
 * sits exactly where the fill currently ends, no matter what frame of
 * the 0.3s width transition we're in.
 *
 * Replaces the previous ImpactSpark which (a) used a radial-gradient
 * blob with blur + screen-blend (the AI-tell rendering pattern), and
 * (b) was positioned by stamina value while the bar's width transitioned,
 * so the spark snapped to the FINAL position while the bar was still
 * draining — visible misalignment for ~300ms.
 *
 * No blur, no mix-blend-mode, no radial gradient. Just a deliberate
 * thin stroke that fades in 0.18s. Subtle by design.
 *
 * Position: anchored to the trailing edge of the fill, which is the
 * OPPOSITE side from where BarFill is positioned (BarFill anchored on
 * left → trailing edge on right; anchored on right → trailing on left). */
const ImpactStrike = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "right: 0;" : "left: 0;")}
  width: 2px;
  background: rgba(245, 236, 217, 0.95);
  box-shadow:
    0 0 3px rgba(245, 236, 217, 0.7),
    0 0 1px rgba(245, 236, 217, 0.95);
  z-index: 5;
  pointer-events: none;
  transform-origin: center;
  animation: ${impactStrike} 0.18s ease-out forwards;
`;

/* Ghost bar — matte trailing damage indicator.
 *
 * Dialed back from the previous smoked-glass treatment (radial highlight +
 * vertical sheen + diagonal sweep + dual box-shadow + double pseudo-element
 * highlights) which competed with the impact spark and the fill's own
 * sheen during damage. Now it's a flat slightly-translucent matte panel
 * with one subtle top edge highlight — clear "this is where stamina was"
 * without piling on extra glass effects. */
const BarGhost = styled.div.attrs((p) => ({
  style: {
    width: `${p.$stamina}%`,
    transition: p.$catching
      ? "width 0.55s ease-out"
      : "width 0.05s linear",
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 0;
  z-index: 1;
  pointer-events: none;
  background: #8d97a8;
`;

/* Regen overlay — "catch your breath".
 *
 * Was a green wash plus scrolling chevrons plus three rising blurred
 * mist particles, layered and screen-blended. At a bar height of ~24px
 * none of that detail resolved; it just summed to a green smear with a
 * blur cost. One flat mint wash, brightest at the leading edge where
 * stamina is being added, pulsing gently. Sits over the live fill but
 * under the parry-refund flash. */
const RegenGlow = styled.div.attrs((p) => ({
  style: {
    width: `${p.$stamina}%`,
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 0;
  z-index: 3;
  pointer-events: none;
  transition: width 0.3s ease;

  background: linear-gradient(
    ${(p) => (p.$isRight ? "270deg" : "90deg")},
    rgba(52, 211, 153, 0.04) 0%,
    rgba(52, 211, 153, 0.2) 55%,
    rgba(120, 240, 190, 0.5) 100%
  );

  animation: ${regenPulse} 0.9s ease-in-out infinite;
`;

/* Instant bright green flash overlay for parry stamina refund */
const ParryRefundFlash = styled.div.attrs((p) => ({
  style: {
    width: `${p.$stamina}%`,
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 0;
  z-index: 6;
  pointer-events: none;
  transition: width 0.3s ease;
  background: rgba(74, 255, 160, 0.62);
  animation: ${parryRefundFlash} 0.5s ease-out forwards;
`;

/* Gassed overlay — designed strain marks, not blurred AI smoke.
 *
 * Previous pass was a stack of: crimson-black radial gradient base +
 * three blurred red radial-gradient "heatwave blobs" with screen-blend +
 * hairline strain marks built from repeating linear gradients. Six
 * partially-transparent red layers summed up to one mushy red blob —
 * loud but shapeless, exactly the "AI rendered an effect" pattern that
 * everything else in this codebase has been working away from.
 *
 * Replaced with two layers, both deliberate:
 *
 *   Base — a flat solid deep crimson with one quiet vertical gradient
 *          for shading. No radial gradients. Reads as "this lane is
 *          drained" instead of "this lane is on fire". The base alpha
 *          is high enough that the stamina gauge underneath disappears
 *          (which is the point — you ARE gassed; the gauge is moot).
 *
 *   Slashes — bold sumi-brush diagonal hatching across the fill, drawn
 *             with a repeating-linear-gradient at thick strokes. Slow
 *             horizontal drift via gassedSlashDrift. Reads as a hand-
 *             cancelled banzuke entry — "this wrestler is OUT" — rather
 *             than a heatwave. Sharp, designed mark instead of blurred
 *             noise. Width and angle are chunky enough that the pattern
 *             holds its shape at HUD scale.
 *
 * Slow opacity breath retained on gassedBreathe so the whole overlay
 * still lives — that pulse is the labored-breath cadence and it works.
 * Just narrowed the alpha range so it doesn't strobe. */
/* GassedOverlay is now just a positioning + clipping container.
 * The painted visuals (red wash + drifting slashes) live on
 * GassedBackdrop as a sibling of GassedText — that lets the alarm
 * pulse animation be applied via `filter` to ONLY the backdrop
 * subtree, leaving the GASSED hanko stamp solid and unaffected. If
 * the pulse is applied to the parent (as it was previously), the
 * filter cascades to every child including the stamp, which then
 * strobes along with the wash. The stamp is the alarm's identity —
 * it has to stay rock solid so the eye can read it. */
const GassedOverlay = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 0;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$matchOver ? 0.92 : 1)};
  transition: opacity 220ms ease;
`;

/* The painted backdrop — red wash + drifting sumi-brush slashes,
 * both pulsing together as the alarm strobe. The wash carries the
 * "drained / dangerous" base color; the slashes drift slowly across
 * it so the lane reads as a hand-cancelled banzuke entry rather
 * than a flat painted decal.
 *
 * The brightness/saturation pulse lives on this element via filter,
 * so it animates BOTH the gradient (the element's own background)
 * AND the slashes (the ::before pseudo-element) together — they
 * read as one cohesive backdrop that flashes dim → bright → dim.
 * The GASSED stamp is a sibling element above this in the JSX
 * tree, so the filter has no effect on it. */
const GassedBackdrop = styled.div`
  position: absolute;
  inset: 0;
  /* Base crimson lifted out of the previous near-black range
     (108,14,14 → 48,4,4) into a properly red alarm range. Still
     deep at the bottom so the lane feels "drained from below"
     rather than uniformly bright; still saturated enough at the
     top that the lane reads UNMISTAKABLY as a red warning state
     at a glance. The pulse animation modulates this base via
     filter rather than its alpha. */
  background: linear-gradient(
    180deg,
    rgba(168, 30, 26, 0.95) 0%,
    rgba(126, 18, 16, 0.96) 50%,
    rgba(82, 10, 10, 0.97) 100%
  );
  /* Quick alarm strobe — fast cadence during active play (~0.78s
     beat), notably slower during the post-round freeze so the alarm
     reads as "still gassed at end of round" rather than continuing
     to scream urgency. */
  animation: ${gassedAlarmPulse}
    ${(p) => (p.$matchOver ? "1.6s" : "0.78s")} ease-in-out infinite;

  /* Sumi-brush diagonal slashes — thick crimson-on-darker-crimson
     hatching that drifts slowly across the bar. The pattern uses
     larger strokes than typical hazard tape so it reads as
     deliberate brushwork at HUD scale instead of fine pinstripes.
     Lives as ::before of the backdrop so it inherits the alarm
     pulse along with the wash beneath it.
     
     Geometry:
     - width: calc(100% + 44px) extends the layer two X-periods past
       the right edge of the parent. The drift animates a leftward
       translateX of one X-period (22px) per cycle, so the buffer
       guarantees the right edge of the pattern never enters the
       visible viewport at any animation frame. No "torn off" edge
       visible mid-drift.
     - left: 0 anchors the layer; the buffer hangs off the right.
       Parent (GassedBackdrop, inset:0 inside BarTrack which has
       overflow: hidden) clips the overhang so it never paints past
       the bar's rounded corners.
     - will-change: transform promotes this to its own GPU layer so
       the translate is a pure composite operation. The repeating-
       gradient is rasterized once when the layer is laid out, then
       transformed each frame without ever being re-sampled. */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% + 44px);
    background-image: repeating-linear-gradient(
      -55deg,
      rgba(20, 4, 4, 0) 0px,
      rgba(20, 4, 4, 0) 9px,
      rgba(20, 4, 4, 0.55) 9px,
      rgba(20, 4, 4, 0.55) 12px,
      rgba(20, 4, 4, 0) 12px,
      rgba(20, 4, 4, 0) 18px
    );
    /* 5s per cycle of one X-period (22px). With the layer now GPU-
       composited via translate3d, the cycle is mathematically and
       visually seamless — the compositor shows the rasterized
       gradient at the new sub-pixel offset each frame without any
       re-rasterization or re-sampling. */
    animation: ${gassedSlashDrift} 5s linear infinite;
    will-change: transform;
    backface-visibility: hidden;
    pointer-events: none;
  }
`;

/* GASSED text plate — single hanko stamp landing.
 *
 * Previous pass infinitely pulsed the border + vertically drooped the
 * letters. Two infinite animations on the same plate read as "the UI is
 * malfunctioning" rather than "this wrestler is exhausted". Replaced
 * with a single stamp impression on mount: scales down from oversized,
 * tiny rotation, then sits still at -3deg (like a real vermillion seal
 * pressed onto paper). The DECISION of the stamp is the alarm.
 *
 * Vermillion fill + cream text + dark stroke, no glow halo. The kanji
 * 疲 (tsukareru, "to be exhausted/tired") sits inline before the
 * Romanized label — adds the same Edo-print character the hanko stamp
 * on the prematch screen has, anchors the design to the rest of the
 * game's aesthetic instead of looking like generic FPS damage UI. */
const GassedText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: baseline;
  gap: clamp(4px, 0.6cqw, 8px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(9px, 1.3cqh, 16px);
  color: ${C.cream};
  letter-spacing: 0.22em;
  ${FONT_RENDER}
  /* Sits ABOVE the GassedBackdrop sibling so the stamp stays
     readable while the backdrop strobes underneath it. */
  z-index: 2;
  background: ${C.vermillion};
  padding: clamp(2px, 0.3cqh, 4px) clamp(10px, 1.4cqw, 20px);
  border: 1.5px solid ${C.vermillionDeep};
  border-radius: 0;
  text-shadow: 0 1px 0 rgba(70, 18, 8, 0.6);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(245, 236, 217, 0.12);
  transform-origin: 50% 50%;
  opacity: 0;
  animation: ${gassedStamp} 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
`;

/* Inline kanji glyph inside the GASSED stamp. Rendered slightly larger
 * than the Romanized text so it carries a touch more visual weight,
 * matching the proportion the prematch hanko uses. */
const GassedKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: 1.35em;
  line-height: 1;
  color: ${C.cream};
  letter-spacing: 0;
`;

/* Gassed recovery burst — bright green-mint flash when "second wind" kicks in */
const RecoveryFlash = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 0;
  z-index: 7;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(225, 255, 241, 0.58) 0%,
    rgba(151, 245, 201, 0.8) 30%,
    rgba(75, 231, 158, 0.84) 60%,
    rgba(25, 201, 119, 0.62) 100%);
  animation: ${recoveryBurst} 0.7s ease-out forwards;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 60%;
    background: linear-gradient(
      100deg,
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.35) 45%,
      rgba(255, 255, 255, 0.55) 50%,
      rgba(255, 255, 255, 0.35) 55%,
      transparent 70%,
      transparent 100%
    );
    animation: ${iceShimmer} 0.6s ease-out forwards;
  }
`;

const RecoveryText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(7px, 1cqh, 13px);
  color: #e6fff2;
  ${FONT_RENDER}
  text-shadow:
    ${TEXT_SHADOW_UI},
    0 0 8px rgba(75, 231, 158, 0.28);
  letter-spacing: ${TRACK.meta};
  white-space: nowrap;
  z-index: 8;
  pointer-events: none;
  animation: ${recoveryTextPop} 0.8s ease-out forwards;
`;


/* "YOU" — bare in-bar type on the outer end of the local stamina track.
 *
 * Ink-outlined, because this label sits on the one background in the HUD
 * that inverts underneath it. It rides the OUTER end of the bar, which
 * is the end that empties first, so it starts life on bright jade and
 * ends it on the near-black well. White-on-mint was the hard-to-read
 * case — two light values with only a soft drop shadow between them —
 * and simply going dark would fail just as badly once the bar drains.
 *
 * A hard contour is the only treatment that survives both. `paint-order`
 * puts the stroke behind the fill so the letterforms keep their full
 * weight instead of being eaten from the outside in, and cream rather
 * than pure white keeps it in the band's palette. */
const YouLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) =>
    p.$isRight
      ? css`right: ${BAR_TEXT_INSET};`
      : css`left: ${BAR_TEXT_INSET};`}
  z-index: 6;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(9px, 1.05cqw, 13px);
  color: ${CHROME};
  letter-spacing: ${TRACK.meta};
  /* Cancel trailing tracking so the glyph cluster doesn't look right-heavy. */
  margin-inline-end: -0.08em;
  line-height: 1;
  ${FONT_RENDER}
  -webkit-text-stroke: clamp(1.4px, 0.16cqw, 2.2px) rgba(4, 6, 12, 0.95);
  paint-order: stroke fill;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  pointer-events: none;
  user-select: none;
`;

// ============================================
// POWER-UP — disc capping the bar's outer end
// ============================================

/* Invisible spacer that sets where the shikona starts.
 *
 * Not the bar's outer edge — the name lines up with the type INSIDE the
 * bar ("YOU", the push-war tag), and with the rank plaque below it. One
 * shared left margin for everything on this wing that is set in type,
 * which reads as the shikona belonging to the bar rather than being
 * parked next to the slot.
 *
 * RAIL_LEAD clears the slot and its gutter to reach the bar's border,
 * STROKE crosses it, BAR_TEXT_INSET is the track's text margin, and the
 * name row's own gutter is subtracted because the row adds one back
 * between this spacer and the name. */
const BarRowSpacer = styled.div`
  width: calc(
    ${RAIL_LEAD} + ${STROKE} + ${BAR_TEXT_INSET} - ${NAME_ROW_GAP}
  );
  flex-shrink: 0;
  min-height: 0;
`;

// ============================================
// BALANCE BAR — compact stability gauge
// ============================================

/* Vertical stack: stamina bar + balance strip — sits beside power-up slot */
const GaugeStack = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
`;

/* Balance strip — inner half of the gauge stack (toward center).
 * Outer half is the rank lane — keep these widths matched. */
const BalStripWrap = styled.div`
  width: 50%;
  align-self: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
  margin-top: ${gaugeStripGap};
`;

/* Top of the sub-bar lane: posture on the inner half, rank on the outer. */
const SUB_ROW_TOP = `calc(${BAR_H} + ${STROKE} * 2 + ${gaugeStripGap})`;

/* Rank lane — outer half of the gauge stack, opposite the posture bar.
 *
 * The rank used to ride in the name row next to the shikona, which put
 * it a few pixels from the round score AND moved it depending on mode:
 * versus has three star marks to its inside, BASHO has none, so the same
 * plaque sat in two different places depending on what you were playing.
 *
 * Out here it is pinned to one spot in every mode — the outer end of the
 * lane under the bar, the far corner of the wing, diagonally opposite
 * the score. It also fills the only genuinely dead space left on the
 * band: in versus this half of the row was empty. Height is RESERVED
 * rather than fitted, so the real per-rank badge art can drop in without
 * moving the boons below it. */
const RankAnchor = styled.div`
  position: absolute;
  top: ${SUB_ROW_TOP};
  width: 50%;
  height: ${RANK_ROW_H};
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 2;

  ${(p) =>
    p.$isRight
      ? css`
          right: 0;
          justify-content: flex-end;
          padding-right: ${BAR_TEXT_INSET};
        `
      : css`
          left: 0;
          padding-left: ${BAR_TEXT_INSET};
        `}
`;

/* BASHO boons — a CEREMONY element, not a combat one.
 *
 * These are the only thing on the band that is static for the whole run:
 * you draft them, they never change during a bout, and they are passive,
 * so you feel them rather than read them. Everything else here is live
 * state. Giving reference information permanent space in the most
 * expensive real estate in the game is what made every placement fight
 * for room — and the boons are also the only element with no upper bound
 * on its count, which is what forced them onto a tier of their own where
 * they read as stickers floating under the band.
 *
 * So they show through the walk-up, while the bout card is playing and
 * nothing is competing for attention, and fade at HAKKI-YOI. During the
 * fight the BASHO band is identical to the versus band. No cap on how
 * many you can draft, and you saw them three seconds before the tachiai.
 *
 * Still full wing width and indented to BAR_TEXT_INSET, so a long draft
 * runs along the same column as the rank, shikona and in-bar labels. */
const BoonAnchor = styled.div`
  position: absolute;
  top: calc(${SUB_ROW_TOP} + ${RANK_ROW_H} + clamp(10px, 1.4cqh, 18px));
  width: 100%;
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 2;

  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? "0" : "-4px")});
  transition: opacity 260ms ease, transform 260ms ease;

  ${(p) =>
    p.$isRight
      ? css`
          right: 0;
          justify-content: flex-end;
          padding-right: ${BAR_TEXT_INSET};
        `
      : css`
          left: 0;
          padding-left: ${BAR_TEXT_INSET};
        `}
`;

/* Row that holds the stamina bar + the power-up slot, with a gutter
 * between them. */
const BarRow = styled.div`
  display: flex;
  align-items: flex-start;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: ${SLOT_GAP};
  width: 100%;
`;

/* Activation pulse — one confident landing, no overshoot. Fires when a
 * new power-up is assigned (the render sites key the disc on the active
 * power-up name, so a change remounts it and replays this). */
const slotMountPulse = keyframes`
  0%   { transform: scale(0.94); filter: brightness(1.35); }
  100% { transform: scale(1);    filter: brightness(1); }
`;

/* Cooldown shuttle — a gold bar tracking the slot's bottom edge.
 *
 * Indeterminate on purpose: the server sends cooldown as a boolean with
 * no remaining time, so a true progress wipe isn't possible yet. If a
 * remaining-time value ever lands, replace this with a bottom-anchored
 * bar whose width is the actual percentage. */
/* Travel is expressed in the bar's OWN width so it stays inside the tile
 * without an overflow:hidden that would clip the charge pip. */
const cooldownShuttle = keyframes`
  0%   { transform: translateX(0%); }
  50%  { transform: translateX(81.8%); }
  100% { transform: translateX(0%); }
`;

/* The slot. Square again — the circle read as a portrait bezel, and this
 * is an item, not a character.
 *
 * The fix that mattered was never the shape: it was that this used
 * `align-self: stretch` inside a row whose height came from the gauge
 * stack, so it was being sized by the posture strip on the far side of
 * the column and its center landed ~9px BELOW the stamina bar's center.
 * That sag was the "positioned weird". It is now a fixed square centered
 * on the bar's midline by construction.
 *
 * Background is the power-up's own type color straight from
 * powerUpConfig — the same `main` fill over a `deep` bottom shade the
 * draft icons use — so an equipped power-up looks identical everywhere
 * it appears in the game. The cream stroke keeps it on the band. */
const PowerUpSlot = styled.div`
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
  width: ${SLOT};
  height: ${SLOT};
  align-self: flex-start;
  /* Centers on the stamina FRAME's midline (track height plus the top
   * stroke), not on the row. The overhang above and below the bar is
   * what ties the slot to it now that they no longer touch. */
  margin-top: calc(${STROKE} + (${BAR_H} / 2) - (${SLOT} / 2));
  border-radius: 0;
  overflow: visible;

  border: ${STROKE} solid ${(p) => (p.$active ? CHROME : CHROME_DIM)};
  background: ${(p) => {
    if (!p.$active) return WELL;
    // On cooldown the tile drops to the deep shade of its own hue, so
    // you still read WHICH power-up it is while it recharges.
    return p.$cooldown ? p.$color.deep : p.$color.main;
  }};
  /* Flat type color, no bottom shade. The draft icons use an inset
   * deep-shade underline, but at HUD size inside a cream stroke that
   * read as a stray rule under the tile rather than as depth.
   *
   * Ink on both sides of the cream, same as the stamina bar. */
  box-shadow:
    inset 0 0 0 1px ${KEYLINE},
    0 0 0 1px ${KEYLINE},
    0 clamp(1px, 0.12cqw, 3px) clamp(5px, 0.5cqw, 10px) rgba(0, 0, 0, 0.55);
  transition: border-color 200ms ease, background-color 200ms ease;

  /* Empty BASHO slot — one cream stroke through the tile. */
  ${(p) =>
    !p.$active &&
    p.$bashoNa &&
    css`
      &::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 78%;
        height: 1.5px;
        background: ${CHROME_DIM};
        transform: translate(-50%, -50%) rotate(-42deg);
        pointer-events: none;
      }
    `}

  ${(p) =>
    p.$cooldown &&
    css`
      &::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: 0;
        width: 55%;
        height: clamp(2px, 0.25cqw, 4px);
        background: ${C.gold};
        animation: ${cooldownShuttle} 1.5s ease-in-out infinite;
        pointer-events: none;
      }
    `}

  ${(p) =>
    p.$active &&
    css`
      animation: ${slotMountPulse} 0.35s ease-out;
    `}
`;

/* Icon fills the slot. It used to sit at roughly 40% of its tile with
 * dead padding all around, which is a large part of why the slot read as
 * an afterthought — the reference portrait fills its shape and overflows. */
const PowerUpIconFrame = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78%;
  height: 78%;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    object-fit: contain;
    position: relative;
    z-index: 1;
    /* Slight shadow so light artwork still separates from a saturated
     * type-color tile (snowball on ice blue, shatter palm on yellow). */
    filter: ${(p) =>
      p.$cooldown
        ? "brightness(0.6) grayscale(0.55) drop-shadow(0 1px 1px rgba(0,0,0,0.4))"
        : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))"};
  }
`;

/* Charge count — cream pip straddling the bottom of the ring, ink
 * numeral. Same cream-substrate logic as the round cells. */
const PowerUpChargeMark = styled.span`
  position: absolute;
  bottom: calc(-1 * clamp(5px, 0.62cqw, 8px));
  left: 50%;
  transform: translateX(-50%);
  min-width: clamp(11px, 1.35cqw, 16px);
  padding: 0 2px;
  text-align: center;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(8px, 0.95cqw, 11px);
  line-height: clamp(10px, 1.24cqw, 16px);
  color: #0a0d15;
  background: ${CHROME};
  box-shadow: 0 0 0 1px ${KEYLINE};
  ${FONT_RENDER}
  pointer-events: none;
  z-index: 5;
`;

// ============================================
// CENTER ROUND / DAY — lacquered broadcast seal
// ============================================

/* Stamina-bar midline — kept as the arithmetic base for the clock seat. */
const STAMINA_MIDLINE_TOP = `
  ${HUD_PAD_TOP} + ${NAME_ROW_H} + ${NAME_GAP} +
  ${STROKE} + (${BAR_H} * 0.5)
`;

/* Clock Y — stamina midline, then a small optical lift. Chillax's digit
 * em-box carries extra space above the caps, so a pure -50% translate
 * reads as low-biased on the hero bar; pull it up a hair. */
const CLOCK_MIDLINE_TOP = STAMINA_MIDLINE_TOP;

/* Match clock — bare numerals between the wing gauges. No ring, no rail,
 * no caption.
 *
 * The center used to hold a round/day counter, which is information you
 * need once at the top of a bout and never again; it has moved to a card
 * that plays before HANDS DOWN. The clock is the opposite — it's the one
 * thing worth a permanent seat between the bars, and the negative space
 * around it is what makes it read without a container. */
const MatchClock = styled.div`
  position: absolute;
  top: calc(${CLOCK_MIDLINE_TOP});
  left: 50%;
  /* -50% centers the box; the extra -0.08em lifts the digit ink so it
   * no longer reads low against the stamina frame. */
  transform: translate(-50%, calc(-50% - 0.08em));
  /* Above the player wings so the digits stay readable over bar tips. */
  z-index: 3;
  pointer-events: none;
  user-select: none;
  opacity: ${(p) => (p.$matchOver ? 0.7 : 1)};
  transition: opacity 260ms ease;

  /* Chillax Bold — same face as the HUD labels.
   *
   * The clock is the only permanent numeral on the band and it sits in
   * ~134px of deliberately empty space between the two wings (they cap
   * at 560px each). Separate "timer fonts" kept pulling the band into
   * industrial / futuristic territory; staying on Chillax keeps the
   * chrome one voice. Size + weight + tabular nums do the instrument job. */
  font-family: ${FONT_CLOCK};
  font-weight: ${FONT_WEIGHT.bold};
  /* Sized against the dual-gauge column: a hair taller than the stamina
   * frame alone so the numeral spans into the balance lane without
   * overshooting the band. */
  font-size: clamp(30px, 4.8cqw, 60px);
  line-height: 1;
  letter-spacing: 0.04em;
  /* Cancel trailing track so the digit cluster sits optically centered
   * in the positioned box (same trick as RankText). */
  text-indent: 0.04em;
  /* Uniform digit widths so the count doesn't jitter as it ticks. No
   * min-width needed — the element is centered on its own box by the
   * translate, so a one-digit count stays centered on its own. */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  text-align: center;
  ${FONT_RENDER}

  color: ${(p) => (p.$urgent ? C.vermillionBright : HUD.heroType)};
  /* Black contour — a hair thicker than the two-digit setting so a
   * lone 8/9 still holds a hard silhouette over crowd faces. Stroke
   * behind fill so Chillax keeps its weight. */
  -webkit-text-stroke: clamp(2.4px, 0.3cqw, 3.8px) rgba(4, 6, 12, 0.95);
  paint-order: stroke fill;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  transition: color 200ms ease, opacity 260ms ease;

  ${(p) =>
    p.$urgent &&
    css`
      animation: ${dangerFramePulse} 0.5s ease-in-out infinite;
    `}
`;

// ============================================
// WIN/LOSS ROW — stones above player bars
// ============================================

/* P2's row uses row-reverse so the FIRST go-stone (index 0, the first
 * round won) sits closest to "PLAYER 2" — matching P1, where index 0
 * also sits closest to "PLAYER 1". Without this, P2's stones fill from
 * the center of the screen outward while P1's fill from the name
 * outward, breaking the mirrored symmetry across the HUD. */
const STAR_MAX = "clamp(11px, 1.35cqw, 17px)";
const STAR_PIP = "clamp(6px, 0.72cqw, 9px)";

/* Fixed height so the row doesn't reflow when a mark grows on resolution. */
const WinLossRow = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  align-items: center;
  height: ${STAR_MAX};
  gap: clamp(4px, 0.5cqw, 7px);
  justify-content: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
`;

/* Star marks — shiroboshi / kuroboshi, the banzuke's own notation.
 *
 * A bout in sumo is recorded as a white star for a win and a black star
 * for a loss, so the score keeps the circle the rest of the band gave up
 * and the round cells become the one genuinely round thing on the HUD.
 *
 * Unplayed bouts are a small cream pip. When a round resolves the pip
 * GROWS into a full star — white for the win, ink-in-a-cream-ring for
 * the loss — which turns the score update into a real beat instead of a
 * silent recolor. The size change is a transition, not a keyframe, so it
 * plays whenever the prop flips and costs nothing while idle. */
const GoStone = styled.div`
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  border-radius: 50%;
  flex-shrink: 0;
  width: ${(p) => (p.$isEmpty ? STAR_PIP : STAR_MAX)};
  height: ${(p) => (p.$isEmpty ? STAR_PIP : STAR_MAX)};
  transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1),
    height 260ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 200ms ease;

  border: ${(p) => (p.$isEmpty || p.$isWin ? "0" : `1.5px solid ${CHROME}`)};
  background: ${(p) => {
    if (p.$isEmpty) return CHROME;
    return p.$isWin ? "#fbf8f2" : "#080a10";
  }};
  /* A white star needs the dark keyline to hold its edge; a black star
   * already has the cream ring doing that job. */
  box-shadow: 0 0 0 1px ${KEYLINE};

  /* Place ripple — only on the star that was just awarded. */
  ${(p) =>
    p.$ripple &&
    css`
      &::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 1.5px solid ${p.$isWin ? "#fbf8f2" : CHROME};
        animation: ${stonePlaceRipple} 0.7s ease-out forwards;
        pointer-events: none;
      }
    `}
`;


// ============================================
// CONSTANTS
// ============================================

const LOW_STAMINA_WARNING_THRESHOLD = 25;

const clampStamina = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const clampBalance = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, n));
};

// ============================================
// COMPONENT
// ============================================

const UiPlayerInfo = ({
  roundHistory = [],
  roundId = 0,
  isPlayer1Local = true,
  player1RankLabel = null,
  player2RankLabel = null,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1SnowballThrowsRemaining = null,
  player1PumoArmyCooldown = false,
  player1PumoArmySpawnsRemaining = null,
  player1IsGassed = false,
  player1ParryRefund = 0,
  player1Balance = 100,
  player1BalanceGain = 0,
  player1HasDeepGrip = false,
  player1PostureBroken = false,
  player1ShoveLead = null,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2SnowballThrowsRemaining = null,
  player2PumoArmyCooldown = false,
  player2PumoArmySpawnsRemaining = null,
  player2IsGassed = false,
  player2ParryRefund = 0,
  player2Balance = 100,
  player2BalanceGain = 0,
  player2HasDeepGrip = false,
  player2PostureBroken = false,
  player2ShoveLead = null,
  matchOver = false,
  player1TopMarks = undefined,
  player2TopMarks = undefined,
  secondsRemaining = null,
  player2Name = "PLAYER 2",
  bashoPowerUpSlots = false,
  showRoundMarks = true,
  player1SubMarks = undefined,
  player2SubMarks = undefined,
  /* Sub-marks (BASHO boons) ride the pre-bout ceremony and clear at
   * HAKKI-YOI — see BoonAnchor. */
  subMarksVisible = true,
}) => {
  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);
  const b1 = clampBalance(player1Balance);
  const b2 = clampBalance(player2Balance);
  const BALANCE_DANGER_THRESHOLD = 15;
  const b1Danger = b1 < BALANCE_DANGER_THRESHOLD;
  const b2Danger = b2 < BALANCE_DANGER_THRESHOLD;

  // ── Display stamina (throttled regen for smooth bar animation) ──
  const [p1DisplayStamina, setP1DisplayStamina] = useState(s1);
  const [p2DisplayStamina, setP2DisplayStamina] = useState(s2);
  const [p1LastDecreaseAt, setP1LastDecreaseAt] = useState(0);
  const [p2LastDecreaseAt, setP2LastDecreaseAt] = useState(0);
  const MAX_INCREASE_PER_UPDATE = 15;

  // ── Ghost bar — trailing damage indicator ("white health" system) ──
  const [p1Ghost, setP1Ghost] = useState(s1);
  const [p2Ghost, setP2Ghost] = useState(s2);
  const [p1GhostCatching, setP1GhostCatching] = useState(false);
  const [p2GhostCatching, setP2GhostCatching] = useState(false);
  const p1GhostTimer = useRef(null);
  const p2GhostTimer = useRef(null);
  const p1PrevStamina = useRef(s1);
  const p2PrevStamina = useRef(s2);
  const p1LastDecreaseAtRef = useRef(0);
  const p2LastDecreaseAtRef = useRef(0);


  // ── Regen indicator (green leading-edge glow) ──
  const [p1Regen, setP1Regen] = useState(false);
  const [p2Regen, setP2Regen] = useState(false);
  const p1RegenTimer = useRef(null);
  const p2RegenTimer = useRef(null);

  // ── Parry refund flash (instant green burst) ──
  const [p1ParryFlash, setP1ParryFlash] = useState(0);
  const [p2ParryFlash, setP2ParryFlash] = useState(0);
  const p1ParryRefundPending = useRef(false);
  const p2ParryRefundPending = useRef(false);

  // ── Gassed recovery ("second wind") ──
  const [p1Recovery, setP1Recovery] = useState(0);
  const [p2Recovery, setP2Recovery] = useState(0);
  const p1WasGassed = useRef(false);
  const p2WasGassed = useRef(false);
  const p1RecoveryPending = useRef(false);
  const p2RecoveryPending = useRef(false);

  // ── Perfect-parry balance gain flash ──
  // Each truthy value (a server timestamp) drives a 700ms inner-fill +
  // outer-track pulse on the balance gauge. The state stores the
  // timestamp so it can also serve as the React key that remounts the
  // overlay components, replaying their CSS animation cleanly.
  const [p1BalGainKey, setP1BalGainKey] = useState(0);
  const [p2BalGainKey, setP2BalGainKey] = useState(0);
  const p1BalGainTimer = useRef(null);
  const p2BalGainTimer = useRef(null);
  // Posture drain flinch — fires on any real chip (slap, palm, grab, clinch
  // chunk). Remounts per bite so a barrage replays. Small continuous ticks
  // are gated so the overlay does not strobe.
  const [p1DrainKey, setP1DrainKey] = useState(0);
  const [p2DrainKey, setP2DrainKey] = useState(0);
  const [p1DrainIntensity, setP1DrainIntensity] = useState(1);
  const [p2DrainIntensity, setP2DrainIntensity] = useState(1);
  const p1DrainTimer = useRef(null);
  const p2DrainTimer = useRef(null);
  const p1PrevBalance = useRef(null);
  const p2PrevBalance = useRef(null);
  const p1DrainAt = useRef(0);
  const p2DrainAt = useRef(0);

  // ── Impact feedback (heavy hits) ──
  // Bumping the impact counter remounts the ImpactSpark via `key` so its
  // animation runs fresh on every hit. p1Shake/p2Shake are booleans toggled
  // by a side-effect chain (false → next-frame true → 340ms later false) so
  // the BarFrame's CSS shake animation restarts cleanly on each hit instead
  // of getting stuck "running" across rapid back-to-back hits.
  const [p1Impact, setP1Impact] = useState(0);
  const [p2Impact, setP2Impact] = useState(0);
  const [p1Shake, setP1Shake] = useState(false);
  const [p2Shake, setP2Shake] = useState(false);
  // p1Impact / p2Impact are bumped on each heavy hit; the bump's value is
  // used as the React `key` on <ImpactStrike> so each hit remounts the
  // component and replays the strike animation. The strike anchors itself
  // to the trailing edge of <BarFill> via CSS (right: 0 / left: 0), so
  // we no longer need to track the stamina value at the moment of impact —
  // the strike rides whatever edge the bar's width-transition is at.
  const p1ShakeTimer = useRef(null);
  const p2ShakeTimer = useRef(null);
  // Min stamina drop (in points) needed to register as a "heavy" hit. Tuned
  // low enough that meaningful damage feels punchy, high enough that idle
  // drain (e.g. crouch holds losing 1 sta) doesn't constantly spark.
  const IMPACT_DROP_THRESHOLD = 4;

  // ── Go-stone place ripple ──
  // When roundHistory grows by one, the new stone (always the last one)
  // gets a one-shot expanding ring overlay. Both wings render the same
  // history, so both stones (winner's white, loser's black) ripple in sync.
  const [rippleStoneIdx, setRippleStoneIdx] = useState(-1);
  const prevRoundCount = useRef(roundHistory.length);

  useEffect(() => {
    if (player1ParryRefund > 0) {
      setP1ParryFlash(player1ParryRefund);
      p1ParryRefundPending.current = true;
    }
  }, [player1ParryRefund]);

  useEffect(() => {
    if (player2ParryRefund > 0) {
      setP2ParryFlash(player2ParryRefund);
      p2ParryRefundPending.current = true;
    }
  }, [player2ParryRefund]);

  // Perfect-parry balance gain — bump the state to a fresh value (the
  // server timestamp) so child overlays remount and replay animation,
  // then clear after 700ms so the track's $gaining flag releases and
  // any underlying $danger pulse can resume.
  useEffect(() => {
    if (player1BalanceGain > 0) {
      setP1BalGainKey(player1BalanceGain);
      if (p1BalGainTimer.current) clearTimeout(p1BalGainTimer.current);
      p1BalGainTimer.current = setTimeout(() => setP1BalGainKey(0), 700);
    }
    return () => {
      if (p1BalGainTimer.current) clearTimeout(p1BalGainTimer.current);
    };
  }, [player1BalanceGain]);

  useEffect(() => {
    if (player2BalanceGain > 0) {
      setP2BalGainKey(player2BalanceGain);
      if (p2BalGainTimer.current) clearTimeout(p2BalGainTimer.current);
      p2BalGainTimer.current = setTimeout(() => setP2BalGainKey(0), 700);
    }
    return () => {
      if (p2BalGainTimer.current) clearTimeout(p2BalGainTimer.current);
    };
  }, [player2BalanceGain]);

  // Posture drain bite — any drop on the gauge, not a special "tip" class.
  useEffect(() => {
    const prev = p1PrevBalance.current;
    p1PrevBalance.current = b1;
    if (prev == null) return;
    const delta = prev - b1;
    if (delta < 0.75) return;
    const now = performance.now();
    const isChunk = delta >= 2.5;
    const gate = isChunk ? 150 : 380;
    if (now - p1DrainAt.current < gate) return;
    p1DrainAt.current = now;
    setP1DrainIntensity(Math.max(0.72, Math.min(1, 0.55 + delta / 20)));
    setP1DrainKey(now);
    if (p1DrainTimer.current) clearTimeout(p1DrainTimer.current);
    p1DrainTimer.current = setTimeout(() => setP1DrainKey(0), 420);
  }, [b1]);

  useEffect(() => {
    const prev = p2PrevBalance.current;
    p2PrevBalance.current = b2;
    if (prev == null) return;
    const delta = prev - b2;
    if (delta < 0.75) return;
    const now = performance.now();
    const isChunk = delta >= 2.5;
    const gate = isChunk ? 150 : 380;
    if (now - p2DrainAt.current < gate) return;
    p2DrainAt.current = now;
    setP2DrainIntensity(Math.max(0.72, Math.min(1, 0.55 + delta / 20)));
    setP2DrainKey(now);
    if (p2DrainTimer.current) clearTimeout(p2DrainTimer.current);
    p2DrainTimer.current = setTimeout(() => setP2DrainKey(0), 420);
  }, [b2]);

  // ── Post-reset throttle bypass ──
  // After a round reset, the first stamina update from the server may arrive
  // AFTER game_reset (race condition). This flag lets that first update snap
  // to the new value instead of being throttled by MAX_INCREASE_PER_UPDATE.
  const p1JustReset = useRef(false);
  const p2JustReset = useRef(false);

  // ── Round reset ──
  useEffect(() => {
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Ghost(s1);
    setP2Ghost(s2);
    setP1GhostCatching(false);
    setP2GhostCatching(false);
    setP1Regen(false);
    setP2Regen(false);
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
    p1PrevStamina.current = s1;
    p2PrevStamina.current = s2;
    p1PrevBalance.current = null;
    p2PrevBalance.current = null;
    p1DrainAt.current = 0;
    p2DrainAt.current = 0;
    setP1DrainKey(0);
    setP2DrainKey(0);
    if (p1DrainTimer.current) clearTimeout(p1DrainTimer.current);
    if (p2DrainTimer.current) clearTimeout(p2DrainTimer.current);
    p1JustReset.current = true;
    p2JustReset.current = true;
    if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    p1LastDecreaseAtRef.current = 0;
    p2LastDecreaseAtRef.current = 0;
    p1WasGassed.current = false;
    p2WasGassed.current = false;
    p1RecoveryPending.current = false;
    p2RecoveryPending.current = false;
    setP1Recovery(0);
    setP2Recovery(0);
    // Clear any in-flight shake / impact state so a new round starts clean.
    if (p1ShakeTimer.current) clearTimeout(p1ShakeTimer.current);
    if (p2ShakeTimer.current) clearTimeout(p2ShakeTimer.current);
    setP1Shake(false);
    setP2Shake(false);
  }, [roundId]);

  // ── Gassed → recovered transition detection ──
  useEffect(() => {
    if (!p1WasGassed.current && player1IsGassed) {
      setP1Ghost(0);
      setP1GhostCatching(false);
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    }
    if (p1WasGassed.current && !player1IsGassed) {
      p1RecoveryPending.current = true;
      setP1Recovery((c) => c + 1);
    }
    p1WasGassed.current = player1IsGassed;
  }, [player1IsGassed]);

  useEffect(() => {
    if (!p2WasGassed.current && player2IsGassed) {
      setP2Ghost(0);
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    }
    if (p2WasGassed.current && !player2IsGassed) {
      p2RecoveryPending.current = true;
      setP2Recovery((c) => c + 1);
    }
    p2WasGassed.current = player2IsGassed;
  }, [player2IsGassed]);

  // ── Shake retrigger on each impact ──
  // Force the CSS animation to restart on every hit by going through a
  // false → rAF(true) → setTimeout(false) cycle. The intermediate `false`
  // render is what makes the browser drop the previous animation instance
  // so the next `true` render starts a fresh one (rather than letting the
  // existing animation continue mid-cycle).
  useEffect(() => {
    if (p1Impact === 0) return undefined;
    setP1Shake(false);
    if (p1ShakeTimer.current) clearTimeout(p1ShakeTimer.current);
    const raf = requestAnimationFrame(() => setP1Shake(true));
    p1ShakeTimer.current = setTimeout(() => setP1Shake(false), 340);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [p1Impact]);

  useEffect(() => {
    if (p2Impact === 0) return undefined;
    setP2Shake(false);
    if (p2ShakeTimer.current) clearTimeout(p2ShakeTimer.current);
    const raf = requestAnimationFrame(() => setP2Shake(true));
    p2ShakeTimer.current = setTimeout(() => setP2Shake(false), 340);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [p2Impact]);

  // ── Stone ripple on round-end ──
  // Depend on length, not the array reference, so a new array prop with the
  // same content doesn't spuriously fire the ripple. When the match resets
  // (length shrinks), we just sync prevRoundCount without animating.
  useEffect(() => {
    const len = roundHistory.length;
    if (len > prevRoundCount.current) {
      setRippleStoneIdx(len - 1);
      const t = setTimeout(() => setRippleStoneIdx(-1), 800);
      prevRoundCount.current = len;
      return () => clearTimeout(t);
    }
    prevRoundCount.current = len;
    return undefined;
  }, [roundHistory.length]);

  // ── Player 1 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p1PrevStamina.current;
    p1PrevStamina.current = s1;
    let next = s1;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p1JustReset.current) {
      p1JustReset.current = false;
      if (s1 >= prev) {
        setP1DisplayStamina(s1);
        setP1Ghost(s1);
        return;
      }
    }

    if (s1 < prev) {
      // ▼ DAMAGE — stamina decreased
      const now = Date.now();
      setP1LastDecreaseAt(now);
      p1LastDecreaseAtRef.current = now;
      // Heavy-hit feedback: edge strike + frame shake on meaningful drops
      const drop = prev - s1;
      if (drop >= IMPACT_DROP_THRESHOLD) {
        setP1Impact((k) => k + 1);
      }
      // Ghost stays high (captures "where stamina was" before this drain sequence)
      setP1Ghost((g) => Math.max(g, p1DisplayStamina));
      setP1GhostCatching(false);
      // Schedule ghost catch-up after a visible delay
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      const closureS1 = s1;
      const scheduleGhostCatchUp = (delay = 700) => {
        p1GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p1LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP1GhostCatching(true);
          setP1Ghost(closureS1);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      // Clear regen state
      setP1Regen(false);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    } else if (s1 > prev) {
      // ▲ REGEN — stamina increased
      // Ghost catches up so it doesn't show false damage ahead of the fill
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      setP1GhostCatching(false);
      setP1Ghost(Math.min(s1, p1DisplayStamina));
      // Show regen glow (stays on for 500ms after last regen tick)
      setP1Regen(true);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
      p1RegenTimer.current = setTimeout(() => setP1Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p1ParryRefundPending.current && s1 > prev) {
      p1ParryRefundPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p1RecoveryPending.current && s1 > prev) {
      p1RecoveryPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Throttle regen display (prevents jarring jumps after recent damage)
    const justDecreased =
      Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      next = p1DisplayStamina;
    }
    if (next > p1DisplayStamina) {
      next = Math.min(next, p1DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP1DisplayStamina(next);

    return () => {
      if (p1GhostTimer.current) {
        clearTimeout(p1GhostTimer.current);
        p1GhostTimer.current = null;
      }
    };
  }, [s1]);

  // ── Player 2 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p2PrevStamina.current;
    p2PrevStamina.current = s2;
    let next = s2;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p2JustReset.current) {
      p2JustReset.current = false;
      if (s2 >= prev) {
        setP2DisplayStamina(s2);
        setP2Ghost(s2);
        return;
      }
    }

    if (s2 < prev) {
      // ▼ DAMAGE
      const now = Date.now();
      setP2LastDecreaseAt(now);
      p2LastDecreaseAtRef.current = now;
      const drop = prev - s2;
      if (drop >= IMPACT_DROP_THRESHOLD) {
        setP2Impact((k) => k + 1);
      }
      setP2Ghost((g) => Math.max(g, p2DisplayStamina));
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      const closureS2 = s2;
      const scheduleGhostCatchUp = (delay = 700) => {
        p2GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p2LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP2GhostCatching(true);
          setP2Ghost(closureS2);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      setP2Regen(false);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    } else if (s2 > prev) {
      // ▲ REGEN
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      setP2GhostCatching(false);
      setP2Ghost(Math.min(s2, p2DisplayStamina));
      setP2Regen(true);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
      p2RegenTimer.current = setTimeout(() => setP2Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p2ParryRefundPending.current && s2 > prev) {
      p2ParryRefundPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p2RecoveryPending.current && s2 > prev) {
      p2RecoveryPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    const justDecreased =
      Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }
    if (next > p2DisplayStamina) {
      next = Math.min(next, p2DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP2DisplayStamina(next);

    return () => {
      if (p2GhostTimer.current) {
        clearTimeout(p2GhostTimer.current);
        p2GhostTimer.current = null;
      }
    };
  }, [s2]);


  // ── Derived match state ──
  /* Server-driven: GameFighter feeds this from `bout_clock`, which only
   * fires on whole-second changes. BOUT_SECONDS is just the pre-tachiai
   * parking value. */
  const clockSeconds = Math.max(
    0,
    Math.ceil(secondsRemaining ?? BOUT_SECONDS)
  );

  const renderCenterMarks = (playerName) => {
    const marks = [];
    const maxRounds = 3;
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        const isWin = roundHistory[i] === playerName;
        // The ripple flag stays on for ~800ms after the stone is placed.
        // We pass a stable key (`r-${i}`) so the stone itself doesn't
        // remount when ripple turns off — the ::after pseudo just stops
        // rendering, leaving the stone in place.
        marks.push(
          <GoStone
            key={`r-${i}`}
            $isWin={isWin}
            $isEmpty={false}
            $ripple={i === rippleStoneIdx}
          />
        );
      } else {
        marks.push(
          <GoStone key={`e-${i}`} $isWin={false} $isEmpty={true} />
        );
      }
    }
    return marks;
  };

  const shouldShowLowStaminaWarning = (stamina) =>
    stamina < LOW_STAMINA_WARNING_THRESHOLD;

  const getPowerUpIsOnCooldown = (
    powerUpType,
    snowballCooldown,
    pumoArmyCooldown,
    pumoArmySpawnsRemaining
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return (
          pumoArmyCooldown ||
          (Number.isFinite(pumoArmySpawnsRemaining) &&
            pumoArmySpawnsRemaining <= 0)
        );
      default:
        return false;
    }
  };

  const getPowerUpIcon = (powerUpType) => {
    switch (powerUpType) {
      case "speed": return happyFeetIcon;
      case "power": return powerWaterIcon;
      case "snowball": return snowballImage;
      case "pumo_army": return pumoArmyIcon;
      case "thick_blubber": return thickBlubberIcon;
      case "flap": return flapIcon;
      case "shatter_palm": return shatterPalmIcon;
      default: return "";
    }
  };

  const renderPowerUpChargeMark = (
    activePowerUp,
    snowballRemaining,
    pumoRemaining
  ) => {
    if (activePowerUp === "snowball" && Number.isFinite(snowballRemaining)) {
      return (
        <PowerUpChargeMark aria-hidden="true">
          {Math.max(0, snowballRemaining)}
        </PowerUpChargeMark>
      );
    }
    if (activePowerUp === "pumo_army" && Number.isFinite(pumoRemaining)) {
      return (
        <PowerUpChargeMark aria-hidden="true">
          {Math.max(0, pumoRemaining)}
        </PowerUpChargeMark>
      );
    }
    return null;
  };

  const p1Danger = shouldShowLowStaminaWarning(p1DisplayStamina);
  const p2Danger = shouldShowLowStaminaWarning(p2DisplayStamina);
  // Push-war HUD: null = not in mutual shove; 0 = EVEN; ±1 = walk lead.
  const p1ShoveActive = player1ShoveLead === 0 || player1ShoveLead === 1 || player1ShoveLead === -1;
  const p2ShoveActive = player2ShoveLead === 0 || player2ShoveLead === 1 || player2ShoveLead === -1;
  const shoveTag = (lead) => (lead > 0 ? "PUSH" : lead < 0 ? "BACK" : "EVEN");

  const renderRankPlaque = (label) => (
    <RankPlaque>
      <RankText>{(label || "JONOKUCHI").toUpperCase()}</RankText>
    </RankPlaque>
  );

  /* BASHO runs one bout per day, so it has no round score to show and
   * passes showRoundMarks={false}. Rank is no longer swapped in here —
   * it lives beside the shikona in both modes. */
  const renderP1TopMarks = () => {
    if (player1TopMarks !== undefined) return player1TopMarks;
    if (!showRoundMarks) return null;
    return renderCenterMarks("player1");
  };

  const renderP2TopMarks = () => {
    if (player2TopMarks !== undefined) return player2TopMarks;
    if (!showRoundMarks) return null;
    return renderCenterMarks("player2");
  };

  return (
    <HudShell $matchOver={matchOver}>
      {/* ═══ PLAYER 1 — East (Higashi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={false}>
          <WinLossRow $isRight={false}>
            {renderP1TopMarks()}
          </WinLossRow>
          <NameBlock $isRight={false}>
            <FitFighterName>PLAYER 1</FitFighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={false}>
          <GaugeStack>
            <BarFrame
              $danger={p1Danger}
              $gassed={player1IsGassed}
              $shake={p1Shake}
              $isRight={false}
              $matchOver={matchOver}
              $shoveLead={p1ShoveActive ? player1ShoveLead : null}
              $shoveActive={p1ShoveActive}
            >
              <BarTrack $isRight={false}>
                {isPlayer1Local && <YouLabel $isRight={false}>YOU</YouLabel>}
                {p1ShoveActive && (
                  <ShoveLeadTag $isRight={false} $lead={player1ShoveLead}>
                    {shoveTag(player1ShoveLead)}
                  </ShoveLeadTag>
                )}
                <BarFill
                  $stamina={p1DisplayStamina}
                  $danger={p1Danger}
                  $isRight={false}
                >
                  {p1Impact > 0 && !player1IsGassed && (
                    <ImpactStrike
                      key={`p1-impact-${p1Impact}`}
                      $isRight={false}
                    />
                  )}
                </BarFill>
                {!player1IsGassed && (
                  <BarGhost
                    $stamina={p1Ghost}
                    $catching={p1GhostCatching}
                    $isRight={false}
                  />
                )}
                {p1Regen && !player1IsGassed && (
                  <RegenGlow
                    $stamina={p1DisplayStamina}
                    $isRight={false}
                  />
                )}
                {player1IsGassed && (
                  <GassedOverlay $matchOver={matchOver}>
                    <GassedBackdrop $matchOver={matchOver} />
                    <GassedText>
                      <GassedKanji>疲</GassedKanji>
                      GASSED
                    </GassedText>
                  </GassedOverlay>
                )}
                {p1ParryFlash > 0 && !player1IsGassed && (
                  <ParryRefundFlash
                    key={p1ParryFlash}
                    $stamina={p1DisplayStamina}
                    $isRight={false}
                  />
                )}
                {p1Recovery > 0 && (
                  <RecoveryFlash key={`r1-${p1Recovery}`}>
                    <RecoveryText>SECOND WIND</RecoveryText>
                  </RecoveryFlash>
                )}
                <StaTickMark $pct={25} />
                <StaTickMark $pct={50} />
                <StaTickMark $pct={75} />
              </BarTrack>
            </BarFrame>
            <BalStripWrap $isRight={false} $matchOver={matchOver}>
              <BalanceGauge
                balance={b1}
                isRight={false}
                danger={b1Danger}
                broken={player1PostureBroken}
                gainKey={p1BalGainKey}
                drainKey={p1DrainKey}
                drainIntensity={p1DrainIntensity}
                deepGripThreat={player2HasDeepGrip}
                deepGripHold={player1HasDeepGrip}
              />
            </BalStripWrap>
            <RankAnchor $isRight={false}>
              {renderRankPlaque(player1RankLabel)}
            </RankAnchor>
            {player1SubMarks && (
              <BoonAnchor $isRight={false} $visible={subMarksVisible}>
                {player1SubMarks}
              </BoonAnchor>
            )}
          </GaugeStack>
          <PowerUpSlot
            /* Stable across cooldown / charge-count changes; changes only
               when the assigned power-up itself changes, which remounts
               the slot and replays the one-shot activation pulse. */
            key={`p1-pu-${player1ActivePowerUp || "empty"}`}
            $isRight={false}
            $active={player1ActivePowerUp}
            $color={getPowerUpTypeColor(player1ActivePowerUp)}
            $bashoNa={bashoPowerUpSlots}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown,
              player1PumoArmySpawnsRemaining
            )}
          >
            {player1ActivePowerUp && (
              <PowerUpIconFrame
                $cooldown={getPowerUpIsOnCooldown(
                  player1ActivePowerUp,
                  player1SnowballCooldown,
                  player1PumoArmyCooldown,
                  player1PumoArmySpawnsRemaining
                )}
              >
                <img
                  src={getPowerUpIcon(player1ActivePowerUp)}
                  alt={player1ActivePowerUp}
                />
              </PowerUpIconFrame>
            )}
            {renderPowerUpChargeMark(
              player1ActivePowerUp,
              player1SnowballThrowsRemaining,
              player1PumoArmySpawnsRemaining
            )}
          </PowerUpSlot>
        </BarRow>
      </PlayerWing>

      {/* ═══ CENTER CLOCK ═══ */}
      <MatchClock
        $matchOver={matchOver}
        /* A bout that ended ON the clock parks at 0, and the match-over
         * screen sits above the band — a red 0 strobing behind the winner
         * card is the clock still shouting after the bout is decided. */
        $urgent={!matchOver && clockSeconds <= CLOCK_URGENT_AT}
        aria-label={`${clockSeconds} seconds remaining`}
      >
        {clockSeconds}
      </MatchClock>

      {/* ═══ PLAYER 2 — West (Nishi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={true}>
          <WinLossRow $isRight={true}>
            {renderP2TopMarks()}
          </WinLossRow>
          <NameBlock $isRight={true}>
            <FitFighterName isRight>
              {player2Name.toUpperCase()}
            </FitFighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={true}>
          <GaugeStack>
            <BarFrame
              $danger={p2Danger}
              $gassed={player2IsGassed}
              $shake={p2Shake}
              $isRight={true}
              $matchOver={matchOver}
              $shoveLead={p2ShoveActive ? player2ShoveLead : null}
              $shoveActive={p2ShoveActive}
            >
              <BarTrack $isRight={true}>
                {!isPlayer1Local && <YouLabel $isRight={true}>YOU</YouLabel>}
                {p2ShoveActive && (
                  <ShoveLeadTag $isRight={true} $lead={player2ShoveLead}>
                    {shoveTag(player2ShoveLead)}
                  </ShoveLeadTag>
                )}
                <BarFill
                  $stamina={p2DisplayStamina}
                  $danger={p2Danger}
                  $isRight={true}
                >
                  {p2Impact > 0 && !player2IsGassed && (
                    <ImpactStrike
                      key={`p2-impact-${p2Impact}`}
                      $isRight={true}
                    />
                  )}
                </BarFill>
                {!player2IsGassed && (
                  <BarGhost
                    $stamina={p2Ghost}
                    $catching={p2GhostCatching}
                    $isRight={true}
                  />
                )}
                {p2Regen && !player2IsGassed && (
                  <RegenGlow
                    $stamina={p2DisplayStamina}
                    $isRight={true}
                  />
                )}
                {player2IsGassed && (
                  <GassedOverlay $matchOver={matchOver}>
                    <GassedBackdrop $matchOver={matchOver} />
                    <GassedText>
                      <GassedKanji>疲</GassedKanji>
                      GASSED
                    </GassedText>
                  </GassedOverlay>
                )}
                {p2ParryFlash > 0 && !player2IsGassed && (
                  <ParryRefundFlash
                    key={p2ParryFlash}
                    $stamina={p2DisplayStamina}
                    $isRight={true}
                  />
                )}
                {p2Recovery > 0 && (
                  <RecoveryFlash key={`r2-${p2Recovery}`}>
                    <RecoveryText>SECOND WIND</RecoveryText>
                  </RecoveryFlash>
                )}
                <StaTickMark $pct={25} />
                <StaTickMark $pct={50} />
                <StaTickMark $pct={75} />
              </BarTrack>
            </BarFrame>
            <BalStripWrap $isRight={true} $matchOver={matchOver}>
              <BalanceGauge
                balance={b2}
                isRight={true}
                danger={b2Danger}
                broken={player2PostureBroken}
                gainKey={p2BalGainKey}
                drainKey={p2DrainKey}
                drainIntensity={p2DrainIntensity}
                deepGripThreat={player1HasDeepGrip}
                deepGripHold={player2HasDeepGrip}
              />
            </BalStripWrap>
            <RankAnchor $isRight={true}>
              {renderRankPlaque(player2RankLabel)}
            </RankAnchor>
            {player2SubMarks && (
              <BoonAnchor $isRight={true} $visible={subMarksVisible}>
                {player2SubMarks}
              </BoonAnchor>
            )}
          </GaugeStack>
          <PowerUpSlot
            key={`p2-pu-${player2ActivePowerUp || "empty"}`}
            $isRight={true}
            $active={player2ActivePowerUp}
            $color={getPowerUpTypeColor(player2ActivePowerUp)}
            $bashoNa={bashoPowerUpSlots}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown,
              player2PumoArmySpawnsRemaining
            )}
          >
            {player2ActivePowerUp && (
              <PowerUpIconFrame
                $cooldown={getPowerUpIsOnCooldown(
                  player2ActivePowerUp,
                  player2SnowballCooldown,
                  player2PumoArmyCooldown,
                  player2PumoArmySpawnsRemaining
                )}
              >
                <img
                  src={getPowerUpIcon(player2ActivePowerUp)}
                  alt={player2ActivePowerUp}
                />
              </PowerUpIconFrame>
            )}
            {renderPowerUpChargeMark(
              player2ActivePowerUp,
              player2SnowballThrowsRemaining,
              player2PumoArmySpawnsRemaining
            )}
          </PowerUpSlot>
        </BarRow>
      </PlayerWing>
    </HudShell>
  );
};

UiPlayerInfo.propTypes = {
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  isPlayer1Local: PropTypes.bool,
  player1RankLabel: PropTypes.string,
  player2RankLabel: PropTypes.string,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1SnowballThrowsRemaining: PropTypes.number,
  player1PumoArmyCooldown: PropTypes.bool,
  player1PumoArmySpawnsRemaining: PropTypes.number,
  player1IsGassed: PropTypes.bool,
  player1ParryRefund: PropTypes.number,
  player1Balance: PropTypes.number,
  player1BalanceGain: PropTypes.number,
  player1HasDeepGrip: PropTypes.bool,
  player1PostureBroken: PropTypes.bool,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2SnowballThrowsRemaining: PropTypes.number,
  player2PumoArmyCooldown: PropTypes.bool,
  player2PumoArmySpawnsRemaining: PropTypes.number,
  player2IsGassed: PropTypes.bool,
  player2ParryRefund: PropTypes.number,
  player2Balance: PropTypes.number,
  player2BalanceGain: PropTypes.number,
  player2HasDeepGrip: PropTypes.bool,
  player2PostureBroken: PropTypes.bool,
  player1ShoveLead: PropTypes.number,
  player2ShoveLead: PropTypes.number,
  matchOver: PropTypes.bool,
  player1TopMarks: PropTypes.node,
  player2TopMarks: PropTypes.node,
  secondsRemaining: PropTypes.number,
  player2Name: PropTypes.string,
  bashoPowerUpSlots: PropTypes.bool,
  showRoundMarks: PropTypes.bool,
  player1SubMarks: PropTypes.node,
  player2SubMarks: PropTypes.node,
  subMarksVisible: PropTypes.bool,
};

export default React.memo(UiPlayerInfo);
