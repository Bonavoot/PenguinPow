import PropTypes from "prop-types";
import React, { useMemo } from "react";
import UiPlayerInfo from "./UiPlayerInfo";
import BashoBoonStrip from "./BashoBoonStrip";
import { getBashoPassiveDraft } from "../config/powerUpConfig";

/*
 * BASHO-only HUD wrapper around UiPlayerInfo.
 *
 * Shares the base HUD's skeleton exactly — rank beside the shikona, slot
 * capping the stamina bar, bout clock in the center — and only differs
 * in content: one bout per day means no round score, and passive boons
 * overlay the gauge column at posture height. Draft actives render in
 * the slot.
 *
 * `bashoDay` is still accepted (it rides the rest spread) but currently
 * renders nowhere: it used to be the center numeral, and the center now
 * belongs to the bout clock. It is destined for the bout card that plays
 * ahead of HANDS DOWN, which lands with the timer work.
 */

const UiPlayerInfoBasho = ({
  bashoDraftedPowerUps = [],
  bashoOpponentPowerUps = [],
  bashoOpponentName = null,
  isPlayer1Local = true,
  matchOver = false,
  ...uiPlayerInfoProps
}) => {
  const playerPassiveBoons = useMemo(
    () => getBashoPassiveDraft(bashoDraftedPowerUps),
    [bashoDraftedPowerUps]
  );
  const opponentPassiveBoons = useMemo(
    () => getBashoPassiveDraft(bashoOpponentPowerUps),
    [bashoOpponentPowerUps]
  );

  return (
    <UiPlayerInfo
      {...uiPlayerInfoProps}
      isPlayer1Local={isPlayer1Local}
      matchOver={matchOver}
      bashoPowerUpSlots
      showRoundMarks={false}
      player2Name={bashoOpponentName || "CPU"}
      player1SubMarks={
        playerPassiveBoons.length > 0 ? (
          <BashoBoonStrip
            draftedPowerUps={playerPassiveBoons}
            matchOver={matchOver}
          />
        ) : null
      }
      player2SubMarks={
        opponentPassiveBoons.length > 0 ? (
          <BashoBoonStrip
            draftedPowerUps={opponentPassiveBoons}
            matchOver={matchOver}
          />
        ) : null
      }
    />
  );
};

UiPlayerInfoBasho.propTypes = {
  bashoDraftedPowerUps: PropTypes.arrayOf(PropTypes.string),
  bashoOpponentPowerUps: PropTypes.arrayOf(PropTypes.string),
  bashoDay: PropTypes.number,
  bashoOpponentName: PropTypes.string,
  isPlayer1Local: PropTypes.bool,
  matchOver: PropTypes.bool,
};

export default React.memo(UiPlayerInfoBasho);
