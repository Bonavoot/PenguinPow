import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { C, FONT_BRUSH, FONT_DISPLAY, FONT_RENDER, FONT_UI } from "./menuTheme";
import {
  ANNOUNCEMENT_EXIT_S,
  ANNOUNCEMENT_MIN_HOLD_S,
} from "./sumoAnnouncementTiming";
import {
  CALLOUT_CREAM,
  CALLOUT_PIGMENT,
  CALLOUT_SLAB,
  CalloutParallelogram,
  withSpacedBang,
} from "./calloutPrimitives";

/*
 * SumoAnnouncementBanner — combat INFO rail.
 *
 * Well parallelogram (Tokon negative-space trick, Pumo materials):
 *   one shared HUD-well field, type color parked in the inner third,
 *   empty well running off the screen edge so the slab reads as coming
 *   out of the bezel — not a floating plaque. Color lives on the word,
 *   not the plate. No HUD cream stroke / inner keyline / type shadow —
 *   those belong on stamina and posture, not on a hit event.
 *
 * Hierarchy is length + type size + hold, not a lower seat. Both slots
 * share one origin. Cap 2 per side, and only for DIFFERENT types
 * (COUNTER HIT + PUNISH). Same type restrikes the live seat — never
 * a second copy of the same word. Same recipe as PERFECT / MATADOR:
 * the old instance hides in place, the live slab stays up, and a
 * scale punch marks the confirm. No blink, no wipe replay.
 *
 * Hype (PERFECT / MATADOR) lives on SumoHypeStamp, above this rail.
 *
 * `duration` is a HOLD target — parents must keep this mounted until
 * announcementVisibleMs(duration). See ./sumoAnnouncementTiming.
 */

export const ANNOUNCEMENT_DURATION_S = 1.5;
export const ANNOUNCEMENT_DURATION_MS = 1500;

const MAX_STACK = 2;

// ============================================
// THEMES — shared HUD-well slab, typed color on the word
// ============================================

const TYPE_INK = {
  punish: CALLOUT_PIGMENT.punish,
  counterhit: CALLOUT_PIGMENT.counterhit,
  counter: "#ff4d3d",
  countergrab: CALLOUT_PIGMENT.countergrab,
  counterthrow: "#ff7a2e",
  deepgrip: "#e8c547",
  parry: "#22d3ee",
  tech: "#22d3ee",
  break: "#22e584",
  matadorbreak: CALLOUT_PIGMENT.matadorbreak,
  perfect: "#22d3ee",
  perfectbrace: "#e8c547",
  perfectparry: "#22d3ee",
  default: C.cream,
};

const getTypeInk = (type) => TYPE_INK[type] || TYPE_INK.default;

const TYPE_KANJI = {
  counterhit: "返",
  punish: "罰",
  countergrab: "捕",
  matadorbreak: "破",
  counter: "逆",
  counterthrow: "投",
  deepgrip: "極",
  parry: "受",
  tech: "技",
  break: "崩",
  perfect: "完",
  perfectbrace: "耐",
  perfectparry: "完",
  default: "喝",
};

const getTypeKanji = (type) => TYPE_KANJI[type] || TYPE_KANJI.default;

const TYPE_TIER = {
  counterhit: "hero",
  countergrab: "hero",
  punish: "primary",
  matadorbreak: "primary",
  counter: "primary",
  counterthrow: "primary",
  perfect: "primary",
  perfectbrace: "primary",
  perfectparry: "primary",
  break: "secondary",
  parry: "secondary",
  deepgrip: "secondary",
  tech: "primary",
  default: "primary",
};

const getTier = (type) => TYPE_TIER[type] || "primary";

const TIER_RANK = {
  hero: 3,
  primary: 2,
  secondary: 1,
};

const TIER_LAYOUT = {
  hero: {
    fontSize: "clamp(1.06rem, 1.78cqw, 1.32rem)",
    fontSizeMobile: "clamp(0.93rem, 2.2cqw, 1.16rem)",
    padBlock: "clamp(5px, 0.55cqh, 8px)",
    minWidth: "clamp(186px, 18.2cqw, 236px)",
  },
  primary: {
    fontSize: "clamp(0.97rem, 1.62cqw, 1.18rem)",
    fontSizeMobile: "clamp(0.86rem, 2.05cqw, 1.06rem)",
    padBlock: "clamp(4px, 0.5cqh, 7px)",
    minWidth: "clamp(166px, 16.2cqw, 212px)",
  },
  secondary: {
    fontSize: "clamp(0.86rem, 1.46cqw, 1.06rem)",
    fontSizeMobile: "clamp(0.78rem, 1.84cqw, 0.95rem)",
    padBlock: "clamp(4px, 0.45cqh, 6px)",
    minWidth: "clamp(150px, 14.6cqw, 194px)",
  },
};

const RAIL_TOP = "clamp(396px, 62cqh, 472px)";
const RAIL_TOP_MOBILE = "clamp(352px, 60cqh, 424px)";
const SLOT_GAP = "clamp(40px, 5.7cqh, 50px)";
// Hang the outer color field past the bezel. Same slab length — the
// viewport clips the empty pigment so the rail reads as coming out of
// the side. Text sits on the inner third and stays fully on-canvas.
const RAIL_EDGE = "clamp(-36px, -3.2cqw, -24px)";
// Empty well that may sit off-canvas. Content starts after this.
const RAIL_SAFE = `calc(${RAIL_EDGE} * -1 + clamp(10px, 1.2cqw, 16px))`;

// ============================================
// STACK RAIL — cap 2, rank-aware seats
// ============================================

const activeAnnouncementRails = {
  left: [],
  right: [],
};

const railListeners = new Set();
let announcementIdSeed = 0;

const getSideKey = (isLeftSide) => (isLeftSide ? "left" : "right");

const notifyRailListeners = () => {
  railListeners.forEach((listener) => listener());
};

const previewAssignment = (stack, type, rank) => {
  const sameIdx = stack.findIndex((e) => e.type === type);
  if (sameIdx >= 0) return { handoff: "restrike", slot: sameIdx };
  if (stack.length === 0) return { handoff: "fresh", slot: 0 };
  if (rank >= stack[0].rank) return { handoff: "replace", slot: 0 };
  return { handoff: "stack", slot: 1 };
};

const commitAssignment = (side, id, type, rank) => {
  const stack = activeAnnouncementRails[side];
  const sameIdx = stack.findIndex((e) => e.type === type);
  let next;
  if (sameIdx >= 0) {
    next = stack.map((e, i) => (i === sameIdx ? { id, type, rank } : e));
  } else if (stack.length === 0) {
    next = [{ id, type, rank }];
  } else if (rank >= stack[0].rank) {
    next = [{ id, type, rank }, stack[0]].slice(0, MAX_STACK);
  } else {
    next = [stack[0], { id, type, rank }];
  }
  activeAnnouncementRails[side] = next;
};

const useAnnouncementRail = (isLeftSide, type) => {
  const idRef = useRef(null);
  if (idRef.current === null) {
    announcementIdSeed += 1;
    idRef.current = `sumo-announcement-${announcementIdSeed}`;
  }

  const sideKey = getSideKey(isLeftSide);
  const rank = TIER_RANK[getTier(type)] || 2;
  const joinedRef = useRef(false);

  const previewRef = useRef(null);
  if (previewRef.current === null) {
    previewRef.current = previewAssignment(
      activeAnnouncementRails[sideKey],
      type,
      rank,
    );
  }

  const [railState, setRailState] = useState({
    evicted: false,
    evictedByRestrike: false,
    slot: previewRef.current.slot,
    handoff: previewRef.current.handoff,
  });
  const slotRef = useRef(previewRef.current.slot);

  useEffect(() => {
    const id = idRef.current;
    commitAssignment(sideKey, id, type, rank);
    joinedRef.current = true;

    const updateRailState = () => {
      const stack = activeAnnouncementRails[sideKey];
      const idx = stack.findIndex((e) => e.id === id);
      if (idx >= 0) slotRef.current = idx;
      const evicted = joinedRef.current && idx < 0;
      setRailState({
        handoff: previewRef.current.handoff,
        slot: idx >= 0 ? idx : slotRef.current,
        evicted,
        evictedByRestrike: evicted && stack.some((e) => e.type === type),
      });
    };

    railListeners.add(updateRailState);
    notifyRailListeners();

    return () => {
      railListeners.delete(updateRailState);
      activeAnnouncementRails[sideKey] = activeAnnouncementRails[sideKey].filter(
        (e) => e.id !== id,
      );
      notifyRailListeners();
    };
  }, [sideKey, type, rank]);

  return railState;
};

// ============================================
// ANIMATIONS
// Fresh: fill wipes, type snaps. Restrike: the slab stays and punches
// (same scale confirm as SumoHypeStamp). Exit: fill wipes away.
// ============================================

const CLIP_OPEN = "0";
const CLIP_SHUT_RIGHT = "0 100% 0 0";
const CLIP_SHUT_LEFT = "0 0 0 100%";

const fillWipeInFromLeft = keyframes`
  0%   { clip-path: inset(${CLIP_SHUT_RIGHT}); }
  100% { clip-path: inset(${CLIP_OPEN}); }
`;

const fillWipeInFromRight = keyframes`
  0%   { clip-path: inset(${CLIP_SHUT_LEFT}); }
  100% { clip-path: inset(${CLIP_OPEN}); }
`;

const fillWipeOutToLeft = keyframes`
  0%   { clip-path: inset(${CLIP_OPEN}); }
  100% { clip-path: inset(${CLIP_SHUT_RIGHT}); }
`;

const fillWipeOutToRight = keyframes`
  0%   { clip-path: inset(${CLIP_OPEN}); }
  100% { clip-path: inset(${CLIP_SHUT_LEFT}); }
`;

const textSnapOn = keyframes`
  0%   { opacity: 0; }
  100% { opacity: 1; }
`;

const textSnapOff = keyframes`
  0%   { opacity: 1; }
  100% { opacity: 0; }
`;

const restrikePunch = keyframes`
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1); }
`;

// ============================================
// LAYOUT
// ============================================

const BannerWrapper = styled.div`
  position: absolute;
  top: ${(p) =>
    p.$slot === 1 ? `calc(${RAIL_TOP} + ${SLOT_GAP})` : RAIL_TOP};
  ${(p) =>
    p.$isLeftSide
      ? css`left: ${RAIL_EDGE};`
      : css`right: ${RAIL_EDGE};`}
  pointer-events: none;
  z-index: ${(p) => 220 - p.$slot};
  visibility: ${(p) => (p.$evictedByRestrike ? "hidden" : "visible")};
  transition: ${(p) =>
    p.$slotReady
      ? "top 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none"};

  @media (max-width: 900px) {
    top: ${(p) =>
      p.$slot === 1
        ? `calc(${RAIL_TOP_MOBILE} + ${SLOT_GAP})`
        : RAIL_TOP_MOBILE};
  }
`;

const EXIT_DURATION_S = ANNOUNCEMENT_EXIT_S;
const REPLACE_ENTER_DELAY_S = 0.05;
const RESTRIKE_S = 0.12;
const MIN_HOLD_S = ANNOUNCEMENT_MIN_HOLD_S;
const WIPE_IN_S = 0.14;
const TEXT_SNAP_DELAY_S = 0.08;

const BannerMotion = styled.div`
  position: relative;
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  ${(p) =>
    p.$handoff === "restrike" &&
    !p.$evicted &&
    css`
      animation: ${restrikePunch} ${RESTRIKE_S}s
        cubic-bezier(0.2, 0.9, 0.22, 1) both;
    `}
`;

const Slab = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-end" : "flex-start")};
  min-width: ${(p) => TIER_LAYOUT[getTier(p.$type)].minWidth};
  max-width: 30cqw;
  width: max-content;
  padding-block: ${(p) => TIER_LAYOUT[getTier(p.$type)].padBlock};
  /* Outer pad clears the bezel hang so type never clips.
     Inner pad is the kanji seat — same side on both players.
     Short words (PUNISH) pack to that inner edge; extra min-width
     stays as empty well on the bezel, not a hole after the bang. */
  ${(p) =>
    p.$isLeftSide
      ? css`
          padding-left: ${RAIL_SAFE};
          padding-right: clamp(16px, 1.8cqw, 24px);
        `
      : css`
          padding-left: clamp(16px, 1.8cqw, 24px);
          padding-right: ${RAIL_SAFE};
        `}
`;

const FillWipe = styled.div`
  position: absolute;
  inset: -3px 0;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
  ${(p) => {
    const wipeIn = p.$isLeftSide ? fillWipeInFromLeft : fillWipeInFromRight;
    const wipeOut = p.$isLeftSide ? fillWipeOutToLeft : fillWipeOutToRight;

    if (p.$evictedByRestrike) {
      return css`
        opacity: 0;
        animation: none;
      `;
    }

    if (p.$evicted) {
      return css`
        animation: ${wipeOut} 0.14s cubic-bezier(0.4, 0, 1, 1) forwards;
      `;
    }

    const isRestrike = p.$handoff === "restrike";
    const isReplace = p.$handoff === "replace";
    const enterDelay = isReplace ? REPLACE_ENTER_DELAY_S : 0;
    const hold =
      Math.max(
        MIN_HOLD_S,
        (p.$duration || ANNOUNCEMENT_DURATION_S) - EXIT_DURATION_S,
      ) + enterDelay;

    if (isRestrike) {
      return css`
        animation: ${wipeOut} ${EXIT_DURATION_S}s ease-in forwards;
        animation-delay: ${hold}s;
      `;
    }

    return css`
      animation:
        ${wipeIn} ${WIPE_IN_S}s cubic-bezier(0.2, 0.7, 0.2, 1) ${enterDelay}s both,
        ${wipeOut} ${EXIT_DURATION_S}s ease-in forwards;
      animation-delay: ${enterDelay}s, ${hold}s;
    `;
  }}
`;

const MainText = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-end" : "flex-start")};
  gap: 0.28em;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].fontSize};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  color: ${(p) => getTypeInk(p.$type)};
  text-shadow: none;
  /* Bungee caps sit high in the em — drop the cluster onto the plate midline. */
  transform: translateY(0.05em);
  ${FONT_RENDER}
  user-select: none;
  ${(p) => {
    if (p.$evictedByRestrike) {
      return css`
        opacity: 0;
        animation: none;
      `;
    }

    if (p.$evicted) {
      return css`
        animation: ${textSnapOff} 0.04s linear forwards;
      `;
    }

    const isRestrike = p.$handoff === "restrike";
    const isReplace = p.$handoff === "replace";
    const enterDelay = isReplace ? REPLACE_ENTER_DELAY_S : 0;
    const snapDelay = enterDelay + TEXT_SNAP_DELAY_S;
    const hold =
      Math.max(
        MIN_HOLD_S,
        (p.$duration || ANNOUNCEMENT_DURATION_S) - EXIT_DURATION_S,
      ) + enterDelay;

    if (isRestrike) {
      return css`
        animation: ${textSnapOff} 0.04s linear forwards;
        animation-delay: ${hold}s;
      `;
    }

    return css`
      animation:
        ${textSnapOn} 0.01s linear ${snapDelay}s both,
        ${textSnapOff} 0.04s linear forwards;
      animation-delay: ${snapDelay}s, ${hold}s;
    `;
  }}

  @media (max-width: 900px) {
    font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].fontSizeMobile};
  }
`;

const KanjiMark = styled.span`
  flex: 0 0 auto;
  display: block;
  font-family: ${FONT_BRUSH};
  font-size: 1.15em;
  line-height: 1;
  letter-spacing: 0;
  text-transform: none;
  /* Brush em-box sits low against Bungee caps — nudge to the word midline. */
  transform: ${(p) =>
    p.$isLeftSide
      ? "translateY(-0.07em) rotate(7deg)"
      : "translateY(-0.07em) rotate(-7deg)"};
  pointer-events: none;
  user-select: none;
`;

const CalloutLabel = styled.span`
  display: block;
  line-height: 1;
`;

const SubText = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_UI};
  font-weight: 700;
  font-size: clamp(0.45rem, 0.75cqw, 0.62rem);
  color: ${CALLOUT_CREAM};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-align: inherit;
  opacity: 0.7;
  ${FONT_RENDER}
`;

// ============================================
// COMPONENT
// ============================================

const SumoAnnouncementBanner = ({
  text,
  type = "default",
  isLeftSide = true,
  duration = ANNOUNCEMENT_DURATION_S,
  subText = null,
}) => {
  const { evicted, evictedByRestrike, slot, handoff } = useAnnouncementRail(
    isLeftSide,
    type,
  );
  const [slotReady, setSlotReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSlotReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let label =
    typeof text === "string" ? text.replace(/\s+/g, " ").trim() : text;
  label = withSpacedBang(label);

  return (
    <BannerWrapper
      $isLeftSide={isLeftSide}
      $slot={slot}
      $slotReady={slotReady}
      $evictedByRestrike={evictedByRestrike}
    >
      <BannerMotion
        $isLeftSide={isLeftSide}
        $handoff={handoff}
        $evicted={evicted}
      >
        <Slab $isLeftSide={isLeftSide} $type={type}>
          <FillWipe
            $isLeftSide={isLeftSide}
            $evicted={evicted}
            $evictedByRestrike={evictedByRestrike}
            $handoff={handoff}
            $duration={duration}
            aria-hidden
          >
            <CalloutParallelogram
              color={CALLOUT_SLAB}
              insetY={7}
              slant={6}
              mirror={!isLeftSide}
            />
          </FillWipe>
          <MainText
            $isLeftSide={isLeftSide}
            $type={type}
            $evicted={evicted}
            $evictedByRestrike={evictedByRestrike}
            $handoff={handoff}
            $duration={duration}
          >
            {isLeftSide && <CalloutLabel>{label}</CalloutLabel>}
            <KanjiMark $isLeftSide={isLeftSide} aria-hidden>
              {getTypeKanji(type)}
            </KanjiMark>
            {!isLeftSide && <CalloutLabel>{label}</CalloutLabel>}
          </MainText>
          {subText && <SubText>{subText}</SubText>}
        </Slab>
      </BannerMotion>
    </BannerWrapper>
  );
};

SumoAnnouncementBanner.propTypes = {
  text: PropTypes.string.isRequired,
  type: PropTypes.oneOf([
    "parry",
    "perfect",
    "perfectbrace",
    "perfectparry",
    "counter",
    "counterhit",
    "counterthrow",
    "deepgrip",
    "punish",
    "countergrab",
    "break",
    "tech",
    "matadorbreak",
    "default",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  subText: PropTypes.string,
};

export default SumoAnnouncementBanner;
