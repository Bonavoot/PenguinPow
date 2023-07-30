import standing from "../assets/standing.gif";

const FighterSelect = () => {
  return (
    <div className="fighter-select">
      SELECT PENGUIN
      <button>
        <img
          style={{ height: "150px" }}
          className="lil-dinkey"
          src={standing}
          alt="lil-dinkey"
        />
      </button>
      <button>
        <h1 className="coming-soon">coming soon!</h1>
      </button>
    </div>
  );
};

export default FighterSelect;
