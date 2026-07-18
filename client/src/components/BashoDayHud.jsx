import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { FONT_DISPLAY } from "./menuTheme";

/*
 * BashoDayHud — bare center numerals for an in-progress honbasho bout.
 * Sized to fit UiPlayerInfo's fixed CenterRound slot (1–15 digits).
 */

const DayStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
`;

const DayNum = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(24px, 4cqw, 56px);
  color: #f3ede2;
  -webkit-text-stroke: clamp(1.4px, 0.18cqw, 2.75px) rgba(0, 0, 0, 0.9);
  text-shadow:
    0 0 12px rgba(243, 237, 226, 0.16),
    0 3px 10px rgba(0, 0, 0, 0.95);
  line-height: 1;
  user-select: none;
  width: 100%;
  text-align: center;
`;

const DayLabel = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(7px, 0.9cqw, 12px);
  color: rgba(232, 197, 71, 0.78);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  margin-top: clamp(1px, 0.2cqh, 3px);
`;

const BashoDayHud = ({ day = 1 }) => (
  <DayStack>
    <DayNum aria-label={`Day ${day}`}>{day}</DayNum>
    <DayLabel>DAY</DayLabel>
  </DayStack>
);

BashoDayHud.propTypes = {
  day: PropTypes.number,
};

export default React.memo(BashoDayHud);
