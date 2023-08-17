const GameUi = ({ rooms, index }) => {
  return (
    <div className="ui">
      {rooms[index].players.map((player, i) => {
        return (
          <div className={"ui-player-container"}>
            <div className="ui-player-name" id={"ui-name-" + (i + 1)}>
              Player {i + 1}
            </div>
            <div className="ui-player-health-container">
              <div
                className="ui-player-health"
                style={{ width: player.health + "%" }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GameUi;
