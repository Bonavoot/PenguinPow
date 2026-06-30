import PropTypes from "prop-types";
import React, { useMemo } from "react";
import styled from "styled-components";
import {
  getPowerUpIcon,
  getPowerUpLabel,
  getPowerUpTypeColor,
  groupDraftedPowerUps,
} from "../config/powerUpConfig";

/*
 * Inline BASHO draft icons — one chip per unique power-up, rendered
 * directly inside the HUD win/loss row (no tray, no label). Background
 * colors match the PowerUpSelection card header bands.
 */

const BoonChip = styled.div`
  --type-main: ${(p) => p.$color.main};
  --type-deep: ${(p) => p.$color.deep};

  position: relative;
  flex: 0 0 auto;
  width: clamp(22px, 2.75cqw, 30px);
  height: clamp(22px, 2.75cqw, 30px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--type-main);
  box-shadow:
    inset 0 -2px 0 var(--type-deep),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 clamp(2px, 0.2cqw, 3px) clamp(5px, 0.45cqw, 8px) rgba(0, 0, 0, 0.44);
  border: 1px solid rgba(0, 0, 0, 0.2);
  opacity: ${(p) => (p.$matchOver ? 0.86 : 1)};
  transition: opacity 240ms ease;

  img {
    width: 62%;
    height: auto;
    max-width: clamp(12px, 1.6cqw, 18px);
    max-height: clamp(12px, 1.6cqw, 18px);
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
`;

const StackCount = styled.div`
  position: absolute;
  bottom: -3px;
  right: -4px;
  min-width: clamp(11px, 1.15cqw, 14px);
  height: clamp(11px, 1.15cqw, 14px);
  padding: 0 clamp(1px, 0.15cqw, 3px);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Bungee", cursive;
  font-size: clamp(6px, 0.62cqw, 8px);
  line-height: 1;
  color: #fff;
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
  border: 1px solid rgba(168, 212, 255, 0.65);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  pointer-events: none;
`;

const BashoDraftIcons = ({ draftedPowerUps = [], matchOver = false }) => {
  const grouped = useMemo(
    () => groupDraftedPowerUps(draftedPowerUps),
    [draftedPowerUps]
  );

  if (grouped.length === 0) return null;

  return (
    <>
      {grouped.map(({ type, count }, index) => {
        const color = getPowerUpTypeColor(type);
        const icon = getPowerUpIcon(type);
        const label = getPowerUpLabel(type);

        return (
          <BoonChip
            key={`${type}-${index}`}
            $color={color}
            $matchOver={matchOver}
            title={count > 1 ? `${label} ×${count}` : label}
            aria-label={count > 1 ? `${label}, ${count} stacks` : label}
          >
            {icon && <img src={icon} alt="" draggable={false} />}
            {count >= 2 && <StackCount>{count}</StackCount>}
          </BoonChip>
        );
      })}
    </>
  );
};

BashoDraftIcons.propTypes = {
  draftedPowerUps: PropTypes.arrayOf(PropTypes.string),
  matchOver: PropTypes.bool,
};

export default React.memo(BashoDraftIcons);
