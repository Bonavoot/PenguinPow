const Fighter = ({ index, fighterImgSrc }) => {
  return (
    <div className={`fighter${index}-container`}>
      <h1 className={`player-side player${index}`}>PLAYER {index + 1}</h1>
      <img
        className={`fighter${index + 1}`}
        src={fighterImgSrc}
        alt="fighter"
      />
    </div>
  );
};

export default Fighter;
