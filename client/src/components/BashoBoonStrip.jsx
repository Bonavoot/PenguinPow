import PropTypes from "prop-types";
import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import {
  getPowerUpIcon,
  getPowerUpLabel,
  getPowerUpTypeColor,
  groupDraftedPowerUps,
} from "../config/powerUpConfig";
import { FONT_UI, FONT_WEIGHT, HUD } from "./menuTheme";

/*
 * BashoBoonStrip — compact row of stacked draft picks for the BASHO HUD.
 *
 * Overlaid at balance-bar top (left/right half by side) — out of document
 * flow so stamina, balance, and the power-up slot stay unchanged.
 */

const boonDealIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/* Sized for the walk-up, not for the fight. The strip only exists while
 * the bout card is playing and nothing else is competing, so the chips
 * can be read at a glance instead of squeezed to survive alongside live
 * combat state. */
const boonChipSize = "clamp(28px, 3.2cqw, 40px)";

const BoonRow = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  flex: 0 0 auto;
  width: max-content;
  max-width: 100%;
  gap: clamp(3px, 0.4cqw, 6px);
  min-height: ${boonChipSize};
  flex-shrink: 0;
`;

/* Boon chip — a small version of the power-up slot, same rules.
 *
 * Flat `main` type color behind a cream hairline over a dark keyline, so
 * a boon is the same object at every size it appears in the game: draft
 * icon, HUD slot, or this strip. It briefly ran as an ink cell with the
 * type color reduced to a hairline along the bottom edge, on the theory
 * that a row of saturated squares under the posture gauge would be
 * noisy — but that made the passives look like a different class of
 * thing from the active in the slot right above them, which is exactly
 * backwards. They're the same power-ups. */
const BoonChip = styled.div`
  position: relative;
  box-sizing: border-box;
  flex: 0 0 ${boonChipSize};
  width: ${boonChipSize};
  height: ${boonChipSize};
  min-width: ${boonChipSize};
  min-height: ${boonChipSize};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  background: ${(p) => p.$color.main};
  /* Thin weight, same cream — a boon is a smaller object than the slot,
   * so its border is a similar fraction rather than the same pixels. */
  border: ${HUD.strokeThin} solid ${HUD.chrome};
  /* Ink both sides of the cream, same as the slot and the bars. */
  box-shadow:
    inset 0 0 0 1px ${HUD.keyline},
    0 0 0 1px ${HUD.keyline};
  opacity: ${(p) => (p.$matchOver ? 0.82 : 1)};
  transition: opacity 240ms ease;
  animation: ${boonDealIn} 0.26s ease-out backwards;
  animation-delay: ${(p) => p.$delayMs}ms;
  overflow: visible;

  img {
    display: block;
    width: 76%;
    height: 76%;
    max-width: none;
    max-height: none;
    object-fit: contain;
    /* Separates light artwork from a light tile (snowball on ice blue,
       shatter palm on yellow) — same treatment as the main slot. */
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
  }
`;

/* Stack count — cream pip, ink numeral. Same as the disc's charge mark. */
const StackMark = styled.span`
  position: absolute;
  top: clamp(-4px, -0.4cqw, -2px);
  right: clamp(-4px, -0.4cqw, -2px);
  min-width: clamp(10px, 1.15cqw, 14px);
  padding: 0 1px;
  text-align: center;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(7.5px, 0.85cqw, 10px);
  line-height: clamp(10px, 1.15cqw, 14px);
  color: #0a0d15;
  background: ${HUD.chrome};
  box-shadow: 0 0 0 1px ${HUD.keyline};
  pointer-events: none;
  z-index: 2;
`;

const BashoBoonStrip = ({ draftedPowerUps = [], matchOver = false }) => {
  const grouped = useMemo(
    () => groupDraftedPowerUps(draftedPowerUps),
    [draftedPowerUps]
  );

  if (grouped.length === 0) {
    return null;
  }

  return (
    <BoonRow>
      {grouped.map(({ type, count }, index) => {
        const color = getPowerUpTypeColor(type);
        const icon = getPowerUpIcon(type);
        const label = getPowerUpLabel(type);

        return (
          <BoonChip
            key={`${type}-${index}`}
            $color={color}
            $delayMs={index * 45}
            $matchOver={matchOver}
            title={count > 1 ? `${label} ×${count}` : label}
            aria-label={count > 1 ? `${label}, ${count} stacks` : label}
          >
            {icon && <img src={icon} alt="" draggable={false} />}
            {count >= 2 && <StackMark aria-hidden="true">{count}</StackMark>}
          </BoonChip>
        );
      })}
    </BoonRow>
  );
};

BashoBoonStrip.propTypes = {
  draftedPowerUps: PropTypes.arrayOf(PropTypes.string),
  matchOver: PropTypes.bool,
};

export default React.memo(BashoBoonStrip);
