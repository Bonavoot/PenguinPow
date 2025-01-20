const PlayerStaminaUi = ({ stamina, index }) => {
  return (
    <div>
      <div className={"ui-player-container"} id={"ui-container-" + (index + 1)}>
        {/* <div className="ui-player-name" id={"ui-name-" + (index + 1)}>
          Player {index + 1}
        </div> */}
        <div className="ui-player-stamina-container">
          <div
            className="ui-player-stamina-red"
            style={{
              width: stamina + "%",
              transition: "width 2s ease-out",
              backgroundColor: "red",
            }}
          ></div>
          <div
            className="ui-player-stamina-yellow"
            style={{
              width: stamina + "%",
              backgroundColor: "Yellow",
            }}
          >
            {/* <div id={"dodge-label-" + (index + 1)}>
              <span className="material-symbols-outlined">bolt</span>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStaminaUi;
