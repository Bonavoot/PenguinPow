import Rematch from "./Rematch";

const MatchOver = ({ winner, roomName, localId }) => {
  return (
    <div className="match-over-container">
      <div
        className="rematch-winner"
        style={{ color: localId === winner.id ? "lime" : "red" }}
      >
        {localId === winner.id ? "YOU WIN !" : "YOU LOSE !"}
      </div>
      <Rematch roomName={roomName} />
    </div>
  );
};

export default MatchOver;
