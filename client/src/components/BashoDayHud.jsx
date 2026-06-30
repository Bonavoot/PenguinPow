import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";

/*
 * BashoDayHud — center broadcast readout for an in-progress honbasho bout.
 *
 * Matches the ROUND counter typography exactly; double-digit days (10+)
 * scale down only slightly so they don't overflow the slot.
 */

const DayStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const DayNum = styled.div`
  font-family: "Bungee", cursive;
  font-size: ${(p) =>
    p.$doubleDigit
      ? "clamp(25px, 4.5cqw, 64px)"
      : "clamp(28px, 5cqw, 72px)"};
  color: #fff;
  -webkit-text-stroke: ${(p) =>
    p.$doubleDigit
      ? "clamp(1.3px, 0.18cqw, 2.5px) rgba(0, 0, 0, 0.9)"
      : "clamp(1.5px, 0.2cqw, 3px) rgba(0, 0, 0, 0.9)"};
  text-shadow:
    0 0 12px rgba(232, 197, 71, 0.32),
    0 3px 8px rgba(0, 0, 0, 0.95);
  line-height: 1;
  user-select: none;
  min-width: 2ch;
  text-align: center;
`;

const DayLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.9cqw, 13px);
  color: rgba(232, 197, 71, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-indent: 0.25em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  margin-top: clamp(1px, 0.2cqh, 3px);
`;

const BashoDayHud = ({ day = 1 }) => (
  <DayStack>
    <DayNum $doubleDigit={day >= 10} aria-label={`Day ${day}`}>
      {day}
    </DayNum>
    <DayLabel>DAY</DayLabel>
  </DayStack>
);

BashoDayHud.propTypes = {
  day: PropTypes.number,
};

export default React.memo(BashoDayHud);
