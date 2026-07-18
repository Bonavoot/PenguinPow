import PropTypes from "prop-types";
import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import {
  getPowerUpIcon,
  getPowerUpLabel,
  getPowerUpTypeColor,
  groupDraftedPowerUps,
} from "../config/powerUpConfig";

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

const boonChipSize = "clamp(24px, 2.75cqw, 32px)";

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

/* Boon chip — now speaks the same "recessed medal slot" language as the HUD's
 * PowerUpSlot (gradient fill main→deep, cream-faint hairline border, inner
 * top highlight + inner bottom shade + a real drop shadow, 3px radius) instead
 * of the old flat type-color square with a hard black outline. Reads as part
 * of the same broadcast HUD system as the stamina/balance bars rather than a
 * loose sticker cluster. */
const BoonChip = styled.div`
  --type-color: ${(p) => p.$color.main};

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
  border-radius: 4px;
  background: linear-gradient(
    150deg,
    ${(p) => p.$color.main} 0%,
    ${(p) => p.$color.deep} 100%
  );
  border: 1px solid rgba(245, 236, 217, 0.32);
  box-shadow:
    0 2px 7px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 -2px 5px rgba(0, 0, 0, 0.35);
  opacity: ${(p) => (p.$matchOver ? 0.82 : 1)};
  transition: opacity 240ms ease;
  animation: ${boonDealIn} 0.26s ease-out backwards;
  animation-delay: ${(p) => p.$delayMs}ms;
  overflow: visible;

  img {
    display: block;
    width: 70%;
    height: 70%;
    max-width: none;
    max-height: none;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
  }
`;

/* Stack count — same hard stroke as PowerUpChargeMark on the big slots. */
const StackMark = styled.span`
  position: absolute;
  top: clamp(-5px, -0.45cqw, -3px);
  right: 0;
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 0.95cqw, 12px);
  line-height: 1;
  color: #fff;
  -webkit-text-stroke: clamp(0.6px, 0.08cqw, 1px) rgba(0, 0, 0, 0.95);
  text-shadow:
    1px 0 0 #000,
    -1px 0 0 #000,
    0 1px 0 #000,
    0 -1px 0 #000,
    0 2px 4px rgba(0, 0, 0, 0.85);
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
