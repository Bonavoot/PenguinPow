import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { FONT_DISPLAY, FONT_KANJI, FONT_BODY, FONT_UI, FONT_WEIGHT, TRACK, C, TEXT_SHADOW_UI } from "./menuTheme";
import daySound from "../sounds/day-sound.ogg";
import { playBuffer } from "../utils/audioEngine";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import { AI_ARCHETYPES } from "../config/bashoConfig";

/**
 * DayCard — the cinematic black "DAY X" interstitial shown between BASHO
 * bouts (spec §5.8). As of the Phase 7 rework it is also where the player
 * DRAFTS this bout's power-up before stepping onto the dohyo.
 *
 * Layout: a TWO-COLUMN stage — run framing on the left (your record under
 * DAY; opponent name, then one meta row of rank / style / record), draft
 * + Begin/Withdraw on the right, split by a thin broadcast divider.
 * The stage never wraps to a single column; it keeps a fixed design size
 * and scales uniformly to fill as much of the viewport as possible —
 * never scrolling.
 *
 * Presentation is tuned to sit in the same premium printed-broadcast world
 * as PreMatchScreen: a lit near-black stage (warm top glow + cool floor
 * pool), a soft edge vignette, and a film-grain wash on top. The opponent's
 * face is deliberately NOT shown here — that reveal is saved for the
 * PreMatchScreen after Begin Bout.
 *
 * The draft cards are lifted verbatim from PowerUpSelection (the cream washi
 * trading-card surface: colored art panel, letterpress name, usage hanko) so
 * the between-bout draft and the PvP/VS-CPU selection read as the same object.
 *
 * Single-player BASHO presentation only; never touches PvP / VS CPU.
 */

// ── DRAFT POOL DISPLAY (mirrors PowerUpSelection.powerUpInfo, minus Flap) ────
const DRAFT_INFO = {
  speed: {
    name: "Happy Feet",
    description: "Speed & dash",
    icon: happyFeetIcon,
    active: false,
  },
  power: {
    name: "Power Water",
    description: "+5% knockback",
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
    description: "Grab absorbs 1 hit",
    icon: thickBlubberIcon,
    active: false,
  },
};

// Power-type colors — identical set to PowerUpSelection's TYPE_COLORS.
const TYPE_COLORS = {
  speed: { main: "#00d2ff", deep: "#005f80", glow: "rgba(0, 210, 255, 0.45)" },
  power: { main: "#ff4444", deep: "#7a1c1c", glow: "rgba(255, 68, 68, 0.45)" },
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
    main: "#ff5087",
    deep: "#a01f4a",
    glow: "rgba(255, 110, 165, 0.45)",
  },
};
const FALLBACK_TYPE = {
  main: C.gold,
  deep: C.goldDeep,
  glow: "rgba(232, 197, 71, 0.45)",
};
const getTypeColor = (type) => TYPE_COLORS[type] || FALLBACK_TYPE;

// ── ANIMATIONS ──────────────────────────────────────────────────────────────
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const dayKanjiIn = keyframes`
  0%   { opacity: 0; transform: scale(1.18); letter-spacing: 0.4em; }
  100% { opacity: 1; transform: scale(1); letter-spacing: 0.12em; }
`;

const watermarkIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -46%) scale(1.14); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const cardDealIn = keyframes`
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── SHELL ─────────────────────────────────────────────────────────────────
// Lit near-black stage: a warm gold pool spilling from the top and a cool
// ice pool rising from the floor turn the flat black into a framed studio
// space. Kept low-alpha so the surface still reads as "black", just alive.
const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 12000;
  overflow: hidden;
  background:
    radial-gradient(
      130% 100% at 50% -8%,
      rgba(232, 197, 71, 0.1) 0%,
      rgba(0, 0, 0, 0) 46%
    ),
    radial-gradient(
      120% 82% at 50% 116%,
      rgba(28, 78, 110, 0.16) 0%,
      rgba(0, 0, 0, 0) 54%
    ),
    #050505;
  color: ${C.cream};
  font-family: ${FONT_BODY};
  user-select: none;
`;

// Soft edge falloff — the single biggest "premium broadcast" cue: frame the
// composition with a gentle darkening at the corners instead of an evenly
// lit flat plane. Sits above the stage; pointer-events off.
const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background: radial-gradient(
    ellipse 118% 100% at 50% 46%,
    transparent 54%,
    rgba(5, 4, 8, 0.5) 100%
  );
`;

// Film grain — the same warm crosshatch wash used on PreMatchScreen so both
// interstitials read as the same film stock rather than a fresh GPU render.
const Grain = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
  opacity: 0.22;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.05) 0,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(60, 40, 20, 0.04) 0,
      transparent 1px,
      transparent 4px
    );
`;

const StageScaler = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const Stage = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  // Top-align both columns so Honbasho and Draft share a baseline —
  // centering made the shorter draft stack float mid-page.
  align-items: flex-start;
  justify-content: center;
  gap: 2.8rem;
  padding: 2.4rem 3rem;
  box-sizing: border-box;
  transform-origin: center center;
  will-change: transform;
`;

// Thin broadcast divider between the two halves — a vertical light-rule that
// fades top and bottom. Anchors the composition as one dossier.
const ColumnDivider = styled.div`
  flex: 0 0 auto;
  align-self: stretch;
  width: 1px;
  margin: 0.6rem 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(245, 236, 217, 0.16) 16%,
    rgba(245, 236, 217, 0.16) 84%,
    transparent 100%
  );
  animation: ${fadeIn} 0.6s ease both 0.3s;
`;

// ── LEFT: RUN FRAMING ───────────────────────────────────────────────────────
const InfoCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  min-width: 0;
  max-width: 460px;
`;

const Kicker = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: 0.72rem;
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.creamMute};
  animation: ${fadeUp} 0.5s ease both;
`;

const KickerRule = styled.span`
  width: 34px;
  height: 1px;
  background: ${C.creamFaint};
`;

// Run-progress track — one pip per bout, so the player reads "how deep am I
// in this run" at a glance. Replaces the old "DAY X OF Y" text (the pips say
// it). Past days are dim cream, the current day is a glowing gold node.
const ProgressTrack = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(3px, 0.5vw, 5px);
  height: 12px;
  animation: ${fadeUp} 0.5s ease both 0.06s;
`;

const ProgressPip = styled.span`
  width: ${(p) => (p.$current ? "10px" : "7px")};
  height: ${(p) => (p.$current ? "10px" : "7px")};
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) =>
    p.$current ? C.gold : p.$done ? "rgba(245, 236, 217, 0.55)" : "transparent"};
  border: 1px solid
    ${(p) =>
      p.$current
        ? C.gold
        : p.$done
          ? "rgba(245, 236, 217, 0.5)"
          : "rgba(245, 236, 217, 0.22)"};
  box-shadow: ${(p) =>
    p.$current ? "0 0 10px rgba(232, 197, 71, 0.6)" : "none"};
  transition: all 0.25s ease;
`;

// Hero day block — a big faint kanji watermark sits behind an engraved-metal
// "DAY X"; the small gold ordinal (第X日目) rides above as an eyebrow.
const DayHero = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0 0.25rem;
`;

const HeroKanjiBg = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: 9.5rem;
  line-height: 1;
  color: rgba(245, 236, 217, 0.05);
  pointer-events: none;
  user-select: none;
  z-index: 0;
  white-space: nowrap;
  animation: ${watermarkIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const DayKanji = styled.div`
  position: relative;
  z-index: 1;
  font-family: ${FONT_KANJI};
  font-size: 1.5rem;
  font-weight: 700;
  color: ${C.gold};
  letter-spacing: 0.12em;
  text-shadow: ${TEXT_SHADOW_UI}, 0 0 8px rgba(232, 197, 71, 0.22);
  animation: ${dayKanjiIn} 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const DayNumber = styled.div`
  position: relative;
  z-index: 1;
  font-family: ${FONT_DISPLAY};
  font-size: 5.2rem;
  line-height: 0.88;
  letter-spacing: 0.01em;
  background: linear-gradient(180deg, #fffaf0 0%, ${C.cream} 52%, #cbb98f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.5))
    drop-shadow(0 10px 24px rgba(0, 0, 0, 0.55));
  animation: ${fadeUp} 0.6s ease both 0.08s;
`;

// Player basho record under the day — keeps "you" above the section rule
// and the whole opponent block below it.
const PlayerRecord = styled.div`
  position: relative;
  z-index: 1;
  margin-top: 0.25rem;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: 1.35rem;
  line-height: 1;
  letter-spacing: ${TRACK.none};
  color: ${C.cream};
  animation: ${fadeUp} 0.6s ease both 0.16s;
`;

const SectionRule = styled.span`
  width: clamp(120px, 62%, 300px);
  height: 1px;
  margin: 0.35rem 0 0.15rem;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(245, 236, 217, 0.22) 28%,
    rgba(245, 236, 217, 0.22) 72%,
    transparent
  );
  animation: ${fadeIn} 0.6s ease both 0.22s;
`;

// Opponent nameplate. Hierarchy: section break → eyebrow → name → meta.
// Eyebrow sits closer to the name than the name sits to the meta row.
const Versus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  width: 100%;
  max-width: 100%;
  margin-top: 0.25rem;
  animation: ${fadeUp} 0.6s ease both 0.24s;
`;

const VsLabel = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: 0.68rem;
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.creamMute};
  line-height: 1;
  margin-bottom: 0.45rem;
`;

const OpponentName = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: ${({ $compact }) => ($compact ? "1.6rem" : "2.1rem")};
  line-height: 1;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  hyphens: auto;
  color: ${({ $boss }) => ($boss ? C.gold : C.vermillionBright)};
  margin-bottom: 0.55rem;
  ${({ $boss }) =>
    $boss &&
    css`
      text-shadow: ${TEXT_SHADOW_UI}, 0 0 10px rgba(232, 197, 71, 0.24);
    `}
`;

// Rank / boss / style / record — one line under the name. Fixed sep margins
// beat flex-gap so letter-spacing on the rank doesn't skew the rule.
const OppMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  row-gap: 0.35rem;
  line-height: 1;
`;

const OpponentRank = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: 0.82rem;
  letter-spacing: ${TRACK.meta};
  // Kill the trailing tracking so the rule doesn't sit farther from the
  // last letter than from the next item on the other side.
  margin-right: -0.08em;
  text-transform: uppercase;
  color: ${C.gold};
`;

const MetaSep = styled.span`
  width: 1px;
  height: 0.75em;
  margin: 0 0.55rem;
  background: rgba(245, 236, 217, 0.28);
  flex-shrink: 0;
`;

const StyleMark = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: 0.72rem;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: ${C.creamMute};

  .kanji {
    font-family: ${FONT_KANJI};
    font-size: 1.05em;
    letter-spacing: 0;
    color: ${C.iceBright};
  }
`;

const MetaRecord = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: 0.82rem;
  letter-spacing: ${TRACK.none};
  color: ${C.cream};
`;

const BossBadge = styled.span`
  font-family: ${FONT_UI};
  font-size: 0.6rem;
  font-weight: ${FONT_WEIGHT.bold};
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.ink};
  background: linear-gradient(180deg, #f1d061, ${C.gold});
  padding: 0.18rem 0.5rem;
  box-shadow: 0 0 16px rgba(232, 197, 71, 0.5);
`;

// ── RIGHT: DRAFT + ACTIONS ──────────────────────────────────────────────────
const DraftCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  flex: 0 0 auto;
  min-width: 0;
`;

const DraftLabel = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: 0.8rem;
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.gold};
  animation: ${fadeUp} 0.6s ease both 0.36s;
`;

const CardsRow = styled.div`
  display: flex;
  gap: 18px;
  justify-content: center;
  align-items: stretch;
  flex-wrap: nowrap;
`;

// Card surface — copied from PowerUpSelection.PowerCard (cream washi trading
// card). $dimmed (rather than disabled) so the player can still re-pick.
const PowerCard = styled.button`
  --type-color: ${(p) => getTypeColor(p.$type).main};
  --type-deep: ${(p) => getTypeColor(p.$type).deep};
  --type-glow: ${(p) => getTypeColor(p.$type).glow};

  position: relative;
  flex: 0 0 auto;
  width: 148px;
  aspect-ratio: 5 / 6;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: ${C.cream};
  border: 2px solid rgba(60, 40, 20, 0.55);
  cursor: pointer;
  font-family: ${FONT_UI};
  padding: 0;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45), 0 2px 0 rgba(60, 40, 20, 0.55);
  opacity: 0;
  animation: ${cardDealIn} 0.38s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
  animation-delay: ${(p) => 0.42 + p.$index * 0.08}s;
  transition: transform 0.18s cubic-bezier(0.2, 0.7, 0.2, 1),
    border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.22s ease,
    filter 0.22s ease;
  will-change: transform, opacity;

  &::after {
    content: "";
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(60, 40, 20, 0.32);
    pointer-events: none;
    z-index: 3;
  }

  &:hover {
    transform: translateY(-12px) scale(1.025);
    border-color: var(--type-color);
    box-shadow: 0 22px 34px rgba(0, 0, 0, 0.55),
      0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 1px var(--type-color),
      0 0 32px var(--type-glow);
  }

  &:active {
    transform: translateY(-6px) scale(1.005);
    transition: transform 0.08s ease;
  }

  ${(p) =>
    p.$selected &&
    css`
      transform: translateY(-16px) scale(1.035);
      border-color: var(--type-color);
      box-shadow: 0 28px 40px rgba(0, 0, 0, 0.6),
        0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 2px var(--type-color),
        0 0 44px var(--type-glow);
    `}

  ${(p) =>
    p.$dimmed &&
    css`
      opacity: 0.28;
      filter: saturate(0.3) brightness(0.9);
      transform: translateY(0) scale(0.97);
      &:hover {
        opacity: 0.6;
        filter: saturate(0.6) brightness(0.95);
        transform: translateY(-6px) scale(1);
      }
    `}
`;

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
    width: clamp(48px, 6.2vw, 74px);
    height: clamp(48px, 6.2vw, 74px);
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.5));
  }
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(4px, 0.6vmin, 7px);
  padding: clamp(11px, 1.5vmin, 15px) clamp(9px, 1.1vw, 13px)
    clamp(22px, 3vmin, 30px);
  position: relative;
  flex: 1;
  border-top: 1px solid rgba(60, 40, 20, 0.35);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
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

const PowerName = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.66rem, 1vw, 0.9rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
  line-height: 1.05;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255, 252, 244, 0.7);
`;

const PowerDesc = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.48rem, 0.78vw, 0.64rem);
  color: ${C.inkTextSoft};
  text-align: center;
  line-height: 1.25;
  letter-spacing: ${TRACK.body};
`;

const UsageChip = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.4rem, 0.58vw, 0.5rem);
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  padding: 2px clamp(6px, 0.8vw, 9px);
  position: absolute;
  bottom: clamp(7px, 1vmin, 10px);
  right: clamp(7px, 0.9vw, 11px);
  background: ${(p) => (p.$active ? C.vermillion : "transparent")};
  color: ${(p) => (p.$active ? C.cream : C.inkTextMute)};
  border: 1px solid
    ${(p) => (p.$active ? C.vermillionDeep : "rgba(60, 40, 20, 0.32)")};
  ${(p) =>
    p.$active &&
    css`
      box-shadow: inset 0 0 0 1px rgba(245, 236, 217, 0.18),
        0 1px 0 rgba(0, 0, 0, 0.18);
      text-shadow: 0 1px 0 rgba(70, 18, 8, 0.5);
    `}
  z-index: 4;
  white-space: nowrap;
`;

// ── ACTIONS ───────────────────────────────────────────────────────────────
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.5rem;
  animation: ${fadeUp} 0.6s ease both 0.5s;
`;

const BeginButton = styled.button`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: 1.25rem;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: #1a1205;
  background: linear-gradient(160deg, ${C.gold} 0%, ${C.goldDeep} 100%);
  border: none;
  border-radius: 10px;
  padding: 0.85rem 2.8rem;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(232, 197, 71, 0.28);
  transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease,
    opacity 0.12s ease;

  .arrow {
    display: inline-block;
    margin-left: 0.5rem;
    transition: transform 0.18s ease;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.06);
    box-shadow: 0 14px 38px rgba(232, 197, 71, 0.4);
    .arrow {
      transform: translateX(4px);
    }
  }
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    filter: saturate(0.5);
    box-shadow: none;
  }
`;

// Always occupies the same box; only its text fades. Toggling the text
// itself would resize this element and shove the actions/cards around,
// which the design must never do — nothing moves except by intent.
const BeginHint = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: 0.72rem;
  line-height: 1.4;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: ${C.creamFaint};
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.15s ease;
`;

const WithdrawLink = styled.button`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: 0.74rem;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: ${C.creamMute};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  transition: color 0.12s ease;

  &:hover {
    color: ${C.vermillionBright};
  }
`;

// Dev-only — shown only when the bashoDebug flag is on (Ctrl+Shift+B in the
// hub). Fast-forwards the run to the final day for testing the results screen.
const DevLink = styled.button`
  margin-top: 0.4rem;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.55rem, 1.1vmin, 0.72rem);
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: ${C.iceBright};
  background: none;
  border: 1px dashed ${C.creamFaint};
  border-radius: 4px;
  cursor: pointer;
  padding: 0.3rem 0.7rem;
  opacity: 0.7;
  transition: opacity 0.12s ease, color 0.12s ease;

  &:hover {
    opacity: 1;
  }
`;

// ── WITHDRAW CONFIRM ────────────────────────────────────────────────────────
const ConfirmBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 38ch;
  text-align: center;
  animation: ${fadeUp} 0.4s ease both;
`;

const ConfirmTitle = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.2rem, 3.4vmin, 2rem);
  color: ${C.vermillionBright};
`;

const ConfirmText = styled.span`
  font-size: clamp(0.72rem, 1.5vmin, 0.94rem);
  color: ${C.creamWarm};
  line-height: 1.55;
`;

const ConfirmButtons = styled.div`
  display: flex;
  gap: 0.8rem;
  margin-top: 0.3rem;
`;

const SmallButton = styled.button`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.7rem, 1.5vmin, 0.92rem);
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  padding: 0.55rem 1.4rem;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$danger ? C.vermillion : C.creamFaint)};
  background: ${(p) => (p.$danger ? "rgba(216, 59, 39, 0.18)" : "transparent")};
  color: ${(p) => (p.$danger ? C.vermillionBright : C.creamMute)};
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: ${(p) =>
      p.$danger ? "rgba(216, 59, 39, 0.3)" : "rgba(245, 236, 217, 0.08)"};
    color: ${(p) => (p.$danger ? "#fff" : C.cream)};
  }
`;

function fmtRecord(r) {
  return `${r?.wins ?? 0}–${r?.losses ?? 0}`;
}

/** Scale the fixed-size stage to fill the viewport as much as possible. */
function useStageFillScale(stageRef, deps = []) {
  const [scale, setScale] = useState(1);

  const recompute = useCallback(() => {
    const stage = stageRef.current;
    const screen = stage?.parentElement?.parentElement;
    if (!stage || !screen) return;

    stage.style.transform = "scale(1)";
    const pad = 12;
    const sx = (screen.clientWidth - pad) / stage.scrollWidth;
    const sy = (screen.clientHeight - pad) / stage.scrollHeight;
    setScale(Math.min(sx, sy));
  }, [stageRef]);

  useLayoutEffect(() => {
    recompute();
    const stage = stageRef.current;
    const screen = stage?.parentElement?.parentElement;
    if (!stage || !screen) return undefined;

    const ro = new ResizeObserver(recompute);
    ro.observe(stage);
    ro.observe(screen);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute, ...deps]);

  return scale;
}

function DayCard({
  day,
  totalBouts,
  opponentName,
  opponentRankLabel,
  opponentRecord,
  opponentArchetype,
  opponentIsBoss,
  playerRecord,
  draftOptions,
  onBegin,
  onWithdraw,
  onSkipToFinalDay,
}) {
  // Resolve the rival's fighting-style metadata for the style tag. `balanced`
  // is the neutral default and shows no tag (only flavored styles surface).
  const archetypeMeta =
    opponentArchetype && opponentArchetype !== "balanced"
      ? AI_ARCHETYPES[opponentArchetype]
      : null;
  // Read the bashoDebug flag (toggled with Ctrl+Shift+B in the hub) so the
  // skip-to-final-day affordance only appears for developers.
  const devEnabled = (() => {
    try {
      return localStorage.getItem("bashoDebug") === "1";
    } catch {
      return false;
    }
  })();
  const isFinalDay = day >= totalBouts;
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState(null);
  const playedRef = useRef(false);
  const stageRef = useRef(null);

  const options = Array.isArray(draftOptions) ? draftOptions : [];
  const draftReady = options.length === 0 || picked != null;
  const compactName = (opponentName?.length ?? 0) > 18;
  const pipCount = Math.max(0, Number(totalBouts) || 0);
  const stageScale = useStageFillScale(stageRef, [
    confirming,
    options.length,
    opponentName,
    picked,
  ]);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    try {
      playBuffer(daySound, 0.18);
    } catch {
      /* sound is non-critical */
    }
  }, []);

  const handlePick = (type) => {
    playPowerUpSelectionPressSound();
    setPicked(type);
  };

  const handleBegin = () => {
    if (!draftReady) return;
    onBegin(picked);
  };

  if (confirming) {
    return (
      <Screen>
        <StageScaler>
          <Stage ref={stageRef} style={{ transform: `scale(${stageScale})` }}>
            <ConfirmBox>
              <ConfirmTitle>Withdraw — Kyūjō</ConfirmTitle>
              <ConfirmText>
                Withdraw from the basho? Your banzuke movement is resolved on your
                current record ({fmtRecord(playerRecord)}). This ends the run.
              </ConfirmText>
              <ConfirmButtons>
                <SmallButton onClick={() => setConfirming(false)}>
                  Keep Fighting
                </SmallButton>
                <SmallButton $danger onClick={onWithdraw}>
                  Withdraw
                </SmallButton>
              </ConfirmButtons>
            </ConfirmBox>
          </Stage>
        </StageScaler>
        <Vignette />
        <Grain />
      </Screen>
    );
  }

  return (
    <Screen>
      <StageScaler>
        <Stage ref={stageRef} style={{ transform: `scale(${stageScale})` }}>
          <InfoCol>
            <Kicker>
              <KickerRule />
              Honbasho
              <KickerRule />
            </Kicker>

            {pipCount > 0 && (
              <ProgressTrack aria-label={`Day ${day} of ${totalBouts}`}>
                {Array.from({ length: pipCount }).map((_, i) => (
                  <ProgressPip
                    key={i}
                    $done={i < day - 1}
                    $current={i === day - 1}
                    aria-hidden
                  />
                ))}
              </ProgressTrack>
            )}

            <DayHero>
              <HeroKanjiBg aria-hidden>日</HeroKanjiBg>
              <DayKanji>第{day}日目</DayKanji>
              <DayNumber>DAY {day}</DayNumber>
              <PlayerRecord aria-label={`Your record ${fmtRecord(playerRecord)}`}>
                {fmtRecord(playerRecord)}
              </PlayerRecord>
            </DayHero>

            <SectionRule />

            <Versus>
              <VsLabel>
                {opponentIsBoss ? "Division Gatekeeper" : "Next Opponent"}
              </VsLabel>
              <OpponentName $boss={opponentIsBoss} $compact={compactName}>
                {opponentName}
              </OpponentName>
              <OppMeta
                aria-label={`Opponent record ${fmtRecord(opponentRecord)}`}
              >
                {[
                  opponentRankLabel ? (
                    <OpponentRank key="rank">{opponentRankLabel}</OpponentRank>
                  ) : null,
                  opponentIsBoss ? (
                    <BossBadge key="boss">Boss</BossBadge>
                  ) : null,
                  archetypeMeta ? (
                    <StyleMark key="style">
                      <span className="kanji">{archetypeMeta.kanji}</span>
                      {archetypeMeta.label}
                    </StyleMark>
                  ) : null,
                  <MetaRecord key="record">
                    {fmtRecord(opponentRecord)}
                  </MetaRecord>,
                ]
                  .filter(Boolean)
                  .flatMap((part, i) =>
                    i === 0
                      ? [part]
                      : [
                          <MetaSep key={`sep-${i}`} aria-hidden />,
                          part,
                        ]
                  )}
              </OppMeta>
            </Versus>
          </InfoCol>

          <ColumnDivider aria-hidden />

          <DraftCol>
            {options.length > 0 && (
              <>
                <DraftLabel>Draft · Pick a Boon</DraftLabel>
                <CardsRow>
                  {options.map((type, index) => {
                    const info = DRAFT_INFO[type];
                    if (!info) return null;
                    const isSelected = picked === type;
                    const isDimmed = picked != null && !isSelected;
                    return (
                      <PowerCard
                        key={type}
                        type="button"
                        $type={type}
                        $selected={isSelected}
                        $dimmed={isDimmed}
                        $index={index}
                        onClick={() => handlePick(type)}
                        onMouseEnter={playPowerUpSelectionHoverSound}
                      >
                        <CardHeader>
                          <img src={info.icon} alt={info.name} />
                        </CardHeader>
                        <CardBody>
                          <PowerName>{info.name}</PowerName>
                          <PowerDesc>{info.description}</PowerDesc>
                          <UsageChip $active={info.active}>
                            {info.active ? "F To Use" : "Passive"}
                          </UsageChip>
                        </CardBody>
                      </PowerCard>
                    );
                  })}
                </CardsRow>
              </>
            )}

            <Actions>
              <BeginButton onClick={handleBegin} disabled={!draftReady} autoFocus>
                Begin Bout
                <span className="arrow" aria-hidden>
                  →
                </span>
              </BeginButton>
              <BeginHint $visible={options.length > 0 && !picked} aria-hidden={picked != null}>
                Choose boon first
              </BeginHint>
              <WithdrawLink onClick={() => setConfirming(true)}>
                Withdraw — Fake an Injury (Quit)
              </WithdrawLink>
              {devEnabled && onSkipToFinalDay && !isFinalDay && (
                <DevLink onClick={() => onSkipToFinalDay()}>
                  ⚡ Dev: Skip to Final Day
                </DevLink>
              )}
            </Actions>
          </DraftCol>
        </Stage>
      </StageScaler>

      <Vignette />
      <Grain />
    </Screen>
  );
}

DayCard.propTypes = {
  day: PropTypes.number,
  totalBouts: PropTypes.number,
  opponentName: PropTypes.string,
  opponentRankLabel: PropTypes.string,
  opponentRecord: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  opponentArchetype: PropTypes.string,
  opponentIsBoss: PropTypes.bool,
  playerRecord: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  draftOptions: PropTypes.arrayOf(PropTypes.string),
  onBegin: PropTypes.func,
  onWithdraw: PropTypes.func,
  onSkipToFinalDay: PropTypes.func,
};

export default DayCard;
