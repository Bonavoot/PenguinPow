import Rematch from "./Rematch";

const MatchOver = ({ winner, roomName }) => {
  return (
    <div className="match-over-container">
      <div className="rematch-winner">{winner.toUpperCase()} WINS !</div>
      <Rematch roomName={roomName} />
    </div>
  );
};

export default MatchOver;
