const PlayerHealthUi = ({ health, index }) => {
  return (
    <div className="ui">
      <div className={"ui-player-container"}>
        <div className="ui-player-name" id={"ui-name-" + (index + 1)}>
          Player {index + 1}
        </div>
        <div className="ui-player-health-container">
          <div
            className="ui-player-health"
            style={{ width: health + "%" }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default PlayerHealthUi;
