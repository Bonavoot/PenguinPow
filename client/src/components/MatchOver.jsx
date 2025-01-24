import Rematch from "./Rematch";

const MatchOver = ({ winner, roomName, localId }) => {
  return (
    <div className="match-over-container">
      <div
        className="rematch-winner"
        style={{ color: localId === winner.id ? "lime" : "red" }}
      >
        {localId === winner.id ? (
          <div className="win-container">
            KATCHI-KOSHI<span className="win-text">(YOU WIN!)</span>
          </div>
        ) : (
          <div className="win-container">
            MAKE-KOSHI<span className="win-text">(YOU LOSE!)</span>
          </div>
        )}
      </div>
      <Rematch roomName={roomName} />
    </div>
  );
};

export default MatchOver;
