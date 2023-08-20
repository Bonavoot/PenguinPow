const PlayerHealthUi = ({ health, index }) => {
  return (
    <div className="ui">
      <div className={"ui-player-container"}>
        <div className="ui-player-name" id={"ui-name-" + (index + 1)}>
          Player {index + 1}
        </div>
        <div className="ui-player-health-container">
          <div
            className="ui-player-health-red"
            style={{
              width: health + "%",
              transition: "width 2s ease-in",
              backgroundColor: "red",
            }}
          ></div>
          <div
            className="ui-player-health-green"
            style={{
              width: health + "%",
              backgroundColor: "Chartreuse",
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default PlayerHealthUi;
