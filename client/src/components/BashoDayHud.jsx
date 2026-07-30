import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import {
  C,
  FONT_RENDER,
  FONT_UI,
  FONT_WEIGHT,
  TEXT_SHADOW_COMBAT,
  TEXT_SHADOW_UI,
  TRACK,
} from "./menuTheme";

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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(24px, 4cqw, 56px);
  color: ${C.cream};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_COMBAT};
  line-height: 1;
  user-select: none;
  width: 100%;
  text-align: center;
`;

const DayLabel = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(7px, 0.9cqw, 12px);
  color: rgba(232, 197, 71, 0.82);
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  text-shadow: ${TEXT_SHADOW_UI};
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
