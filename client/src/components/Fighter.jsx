const Fighter = ({ index, fighterImgSrc, fighterName }) => {
  return (
    <div className="fighter-container">
      {index > 0 ? (
        <img className="fighter2" src={fighterImgSrc} alt="fighter2" />
      ) : (
        <img className="fighter1" src={fighterImgSrc} alt="fighter1" />
      )}
    </div>
  );
};

export default Fighter;
