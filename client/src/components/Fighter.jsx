const Fighter = ({ index, fighterImgSrc }) => {
  return (
    <div className="fighter-container">
      <img
        className={`fighter${index + 1}`}
        src={fighterImgSrc}
        alt="fighter"
      />
    </div>
  );
};

export default Fighter;
