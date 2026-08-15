import React, { memo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import { ANNOUNCE_Y } from "./SumoGameAnnouncement";
import {
  C,
  FONT_BRUSH,
  FONT_DISPLAY,
  FONT_RENDER,
  HUD,
} from "./menuTheme";
import { withSpacedBang } from "./calloutPrimitives";

/*
 * RoundResult — the gyoji's call.
 *
 * Same ceremony grammar as HAKKI-YOI (cut type + hairline), different
 * pigment so the finish is not the start. Victory: cream English,
 * gold-leaf kimarite and rule (same ceremony metal as HAKKI-YOI).
 * Defeat: vermillion English on the same ink contour; cream
 * kimarite. One stamp. No slab.
 *
 * Shares ANNOUNCE_Y with HAKKI-YOI. Hype sits under this stack so a
 * winning special can stay on screen without becoming one sentence.
 */

const WIN_TYPE_CONFIG = {
  slap: { english: "THRUST OUT!", japanese: "突き出し" },
  charged: { english: "PUSH OUT!", japanese: "押し出し" },
  cinematicKill: { english: "DEMOLISHED!", japanese: "破壊された" },
  grabPush: { english: "FORCE OUT!", japanese: "寄り切り" },
  grabThrow: { english: "OVERARM THROW!", japanese: "上手投げ" },
  clinchKillThrow: { english: "CRUSHING THROW!", japanese: "掛け投げ" },
  clinchKillPull: { english: "PULL DOWN!", japanese: "引き落とし" },
  okuridashi: { english: "REAR PUSH OUT!", japanese: "送り出し" },
  flap: { english: "BODY SLAM!", japanese: "浴びせ倒し" },
  snowball: { english: "RING OUT!", japanese: "場外" },
  pumoClone: { english: "RING OUT!", japanese: "場外" },
  ringOut: { english: "RING OUT!", japanese: "場外" },
  /* Clock ran out. The headline is the same for both outcomes because in
     sumo the callout names the FINISH, not the winner — who won is told
     by the judges' scores standing over the wrestlers' heads. The
     kimarite line is what separates a decision (hantei) from a dead heat
     that has to be fought again (torinaoshi). */
  timeExpired: { english: "TIME'S UP!", japanese: "判定" },
  torinaoshi: { english: "TIME'S UP!", japanese: "取り直し" },
};

/**
 * Look up the kimarite (winning-move) label for a winType. Shared with the
 * BASHO results strip so the post-run summary can name each day's finish.
 * Falls back to the generic ring-out call for unknown/missing types.
 */
export function kimariteFor(winType) {
  return WIN_TYPE_CONFIG[winType] || WIN_TYPE_CONFIG.ringOut;
}

const RESULT_HOLD_S = 3;
const INK = "#05070c";

const GOLD = "#f0d56a";

const FILL = {
  victory: HUD.heroType,
  defeat: C.vermillionBright,
};

const STROKE_W = "clamp(4.2px, 0.5cqw, 6.4px)";

const KIMARITE_FILL = {
  victory: GOLD,
  defeat: HUD.heroType,
};

const KIMARITE_STROKE_W = "clamp(1.6px, 0.2cqw, 2.6px)";

const RULE = {
  victory: GOLD,
  defeat: C.vermillion,
};

// ============================================
// ANIMATIONS
// ============================================

/* Sized on the English line only so translate(-50%, -50%) shares a
 * band with HAKKI-YOI. Kimarite hangs below and is not in this box.
 * Punch-in, no rebound — same weight as HAKKI-YOI, not a squash. */
const wordStamp = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.16); }
  10%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  82%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

// ============================================
// LAYOUT
// ============================================

const CalloutAnchor = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1005;
  pointer-events: none;
  width: max-content;
  max-width: 92cqw;
  animation: ${wordStamp} ${RESULT_HOLD_S}s cubic-bezier(0.16, 1, 0.3, 1)
    forwards;
  will-change: transform, opacity;
`;

const MainText = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(2.1rem, 5.8cqw, 5.2rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.06em;
  text-indent: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  text-align: center;
  color: ${(p) => (p.$isVictory ? FILL.victory : FILL.defeat)};
  -webkit-text-stroke: ${STROKE_W} ${INK};
  paint-order: stroke fill;
  text-shadow: none;
  ${FONT_RENDER}
  user-select: none;

  @media (max-width: 900px) {
    font-size: clamp(1.7rem, 5.2cqw, 3.8rem);
  }
  @media (max-width: 600px) {
    font-size: clamp(1.35rem, 4.6cqw, 2.8rem);
  }

  &::after {
    content: "";
    display: block;
    width: 46%;
    height: 3px;
    margin: clamp(5px, 0.7cqh, 9px) auto 0;
    background:
      linear-gradient(
        90deg,
        transparent 0%,
        ${(p) => (p.$isVictory ? RULE.victory : RULE.defeat)} 22%,
        ${(p) => (p.$isVictory ? RULE.victory : RULE.defeat)} 78%,
        transparent 100%
      )
        top / 100% 2px no-repeat,
      linear-gradient(
        90deg,
        transparent 0%,
        ${INK} 22%,
        ${INK} 78%,
        transparent 100%
      )
        bottom / 100% 3px no-repeat;
  }
`;

const SupportStack = styled.div`
  position: absolute;
  top: calc(100% + clamp(8px, 1.1cqh, 14px));
  left: 50%;
  transform: translateX(-50%);
`;

const KimariteText = styled.div`
  font-family: ${FONT_BRUSH};
  font-size: clamp(1.25rem, 2.55cqw, 2.05rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  text-align: center;
  color: ${(p) => (p.$isVictory ? KIMARITE_FILL.victory : KIMARITE_FILL.defeat)};
  -webkit-text-stroke: ${KIMARITE_STROKE_W} ${INK};
  paint-order: stroke fill;
  text-shadow: none;
  ${FONT_RENDER}
  user-select: none;

  @media (max-width: 600px) {
    font-size: clamp(1rem, 2.1cqw, 1.55rem);
  }
`;

// ============================================
// COMPONENT
// ============================================

const RoundResult = ({ isVictory, winType }) => {
  const config = WIN_TYPE_CONFIG[winType] || WIN_TYPE_CONFIG.ringOut;
  const hasKimarite = !!config.japanese;
  const headline = withSpacedBang(config.english);

  return (
    <CalloutAnchor>
      <MainText $isVictory={isVictory}>{headline}</MainText>
      {hasKimarite && (
        <SupportStack>
          <KimariteText $isVictory={isVictory}>
            {config.japanese}
          </KimariteText>
        </SupportStack>
      )}
    </CalloutAnchor>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
  winType: PropTypes.string,
};

export default memo(RoundResult);
