import PropTypes from "prop-types";
import React, { useMemo } from "react";
import UiPlayerInfo from "./UiPlayerInfo";
import BashoBoonStrip from "./BashoBoonStrip";
import BashoDayHud from "./BashoDayHud";
import { getBashoPassiveDraft } from "../config/powerUpConfig";

/*
 * BASHO-only HUD wrapper around UiPlayerInfo.
 *
 * Rank sits in the name row beside the shikona; passive boons overlay the
 * gauge column at balance-bar height without shifting stamina/balance/power-up.
 * Draft actives render in the power-up slot beside stamina.
 */

const UiPlayerInfoBasho = ({
  bashoDraftedPowerUps = [],
  bashoOpponentPowerUps = [],
  bashoDay = 1,
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
      rankInTopMarks
      nameAlignToMarkBottom
      player2Name={bashoOpponentName || "CPU"}
      centerContent={<BashoDayHud day={bashoDay} />}
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
