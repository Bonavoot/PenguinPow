import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { C, FONT_DISPLAY, FONT_RENDER, FONT_UI } from "./menuTheme";
import {
  ANNOUNCEMENT_EXIT_S,
  ANNOUNCEMENT_MIN_HOLD_S,
} from "./sumoAnnouncementTiming";
import {
  CALLOUT_CREAM,
  CalloutParallelogram,
  withSpacedBang,
} from "./calloutPrimitives";

/*
 * SumoAnnouncementBanner — combat INFO rail.
 *
 * Color-field parallelogram (Tokon negative-space trick, Pumo materials):
 *   opaque pigment fill, cream HUD stroke + dark keyline, cream Bungee
 *   parked in the inner third, empty color running to the screen edge.
 *
 * Hierarchy is length + type size + hold, not a lower seat. Both slots
 * share one origin. Cap 2 per side; same type restrikes in place.
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
// THEMES — flat pigment, cream type
// ============================================

const TYPE_COLORS = {
  punish: { fill: "#9b3dff" },
  counterhit: { fill: "#ff5c1a" },
  counter: { fill: "#ff4d3d" },
  countergrab: { fill: "#ff3d88" },
  counterthrow: { fill: "#ff7a2e" },
  deepgrip: { fill: "#e8c547" },
  parry: { fill: "#22d3ee" },
  tech: { fill: "#22d3ee" },
  break: { fill: "#22e584" },
  matadorbreak: { fill: "#ff6b1a" },
  perfect: { fill: "#22d3ee" },
  perfectbrace: { fill: "#e8c547" },
  perfectparry: { fill: "#22d3ee" },
  default: { fill: C.sumi },
};

const getTheme = (type) => TYPE_COLORS[type] || TYPE_COLORS.default;

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
    fontSize: "clamp(1.08rem, 1.85cqw, 1.38rem)",
    fontSizeMobile: "clamp(0.95rem, 2.25cqw, 1.18rem)",
    padBlock: "clamp(5px, 0.55cqh, 8px)",
    minWidth: "clamp(176px, 17cqw, 225px)",
  },
  primary: {
    fontSize: "clamp(0.98rem, 1.65cqw, 1.22rem)",
    fontSizeMobile: "clamp(0.86rem, 2.05cqw, 1.08rem)",
    padBlock: "clamp(4px, 0.5cqh, 7px)",
    minWidth: "clamp(160px, 15.5cqw, 205px)",
  },
  secondary: {
    fontSize: "clamp(0.88rem, 1.45cqw, 1.08rem)",
    fontSizeMobile: "clamp(0.78rem, 1.85cqw, 0.95rem)",
    padBlock: "clamp(4px, 0.45cqh, 6px)",
    minWidth: "clamp(148px, 14cqw, 188px)",
  },
};

const RAIL_TOP = "clamp(372px, 59cqh, 448px)";
const RAIL_TOP_MOBILE = "clamp(328px, 57cqh, 400px)";
const SLOT_GAP = "clamp(44px, 6.4cqh, 58px)";

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
      setRailState({
        handoff: previewRef.current.handoff,
        slot: idx >= 0 ? idx : slotRef.current,
        evicted: joinedRef.current && idx < 0,
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
// Fill wipes. Type snaps. The slab may nudge — it never scales the glyphs.
// ============================================

/* Negative inset leaves room for the cream chrome so clip-path
   does not crop it into a rectangle. */
const CLIP_OPEN = "-10px -8px";
const CLIP_SHUT_RIGHT = "-10px 100% -10px -8px";
const CLIP_SHUT_LEFT = "-10px -8px -10px 100%";

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

// ============================================
// LAYOUT
// ============================================

const BannerWrapper = styled.div`
  position: absolute;
  top: ${(p) =>
    p.$slot === 1 ? `calc(${RAIL_TOP} + ${SLOT_GAP})` : RAIL_TOP};
  ${(p) =>
    p.$isLeftSide
      ? css`left: clamp(8px, 1.15cqw, 16px);`
      : css`right: clamp(8px, 1.15cqw, 16px);`}
  pointer-events: none;
  z-index: ${(p) => 220 - p.$slot};
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
const MIN_HOLD_S = ANNOUNCEMENT_MIN_HOLD_S;
const WIPE_IN_S = 0.14;
const TEXT_SNAP_DELAY_S = 0.08;

const BannerMotion = styled.div`
  position: relative;
`;

const Slab = styled.div`
  position: relative;
  min-width: ${(p) => TIER_LAYOUT[getTier(p.$type)].minWidth};
  max-width: 26cqw;
  padding-block: ${(p) => TIER_LAYOUT[getTier(p.$type)].padBlock};
  /* Inner pad (toward the fight) has to clear the parallelogram slant
     plus the 1.5px glyph stroke. Outer pad is the empty color — enough
     air, not a banner to center screen. */
  ${(p) =>
    p.$isLeftSide
      ? css`
          padding-left: clamp(40px, 4.6cqw, 62px);
          padding-right: clamp(22px, 2.4cqw, 32px);
          text-align: right;
        `
      : css`
          padding-left: clamp(22px, 2.4cqw, 32px);
          padding-right: clamp(40px, 4.6cqw, 62px);
          text-align: left;
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
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].fontSize};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  color: ${C.cream};
  text-shadow: none;
  ${FONT_RENDER}
  user-select: none;
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${textSnapOff} 0.04s linear forwards;
      `;
    }

    const isRestrike = p.$handoff === "restrike";
    const isReplace = p.$handoff === "replace";
    const enterDelay = isReplace ? REPLACE_ENTER_DELAY_S : 0;
    const snapDelay = isRestrike ? enterDelay : enterDelay + TEXT_SNAP_DELAY_S;
    const hold =
      Math.max(
        MIN_HOLD_S,
        (p.$duration || ANNOUNCEMENT_DURATION_S) - EXIT_DURATION_S,
      ) + enterDelay;

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
  const { evicted, slot, handoff } = useAnnouncementRail(isLeftSide, type);
  const [slotReady, setSlotReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSlotReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const theme = getTheme(type);
  const fill = theme.fill;
  let label =
    typeof text === "string" ? text.replace(/\s+/g, " ").trim() : text;
  label = withSpacedBang(label);

  return (
    <BannerWrapper
      $isLeftSide={isLeftSide}
      $slot={slot}
      $slotReady={slotReady}
    >
      <BannerMotion
        $isLeftSide={isLeftSide}
        $evicted={evicted}
        $handoff={handoff}
      >
        <Slab $isLeftSide={isLeftSide} $type={type}>
          <FillWipe
            $isLeftSide={isLeftSide}
            $evicted={evicted}
            $handoff={handoff}
            $duration={duration}
            aria-hidden
          >
            <CalloutParallelogram
              color={fill}
              chrome
              insetY={7}
              slant={6}
            />
          </FillWipe>
          <MainText
            $type={type}
            $evicted={evicted}
            $handoff={handoff}
            $duration={duration}
          >
            {label}
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
