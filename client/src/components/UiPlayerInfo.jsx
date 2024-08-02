const UiPlayerInfo = ({ playerOneWinCount, playerTwoWinCount }) => {
  return (
    <div className="ui-player-info">
      <div className="rank-record-1">
        <div className="rank">UNRANKED</div>
        <div className="record">
          <div className="win-circle"></div>
          <div className="win-count">{playerOneWinCount}</div>
          <div className="loss-circle"></div>
          <div className="loss-count">{playerTwoWinCount}</div>
        </div>
      </div>
      <div className="ui-player-1-name">PLAYER 1</div>
      <div className="ui-player-2-name">PLAYER 2</div>
      <div className="rank-record-2">
        <div className="rank">UNRANKED</div>
        <div className="record">
          <div className="win-circle"></div>
          <div className="win-count">{playerTwoWinCount}</div>
          <div className="loss-circle"></div>
          <div className="loss-count">{playerOneWinCount}</div>
        </div>
      </div>
    </div>
  );
};

export default UiPlayerInfo;
