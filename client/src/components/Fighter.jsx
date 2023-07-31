const Fighter = ({ index, fighter }) => {
  return (
    <>
      {index > 0 ? (
        <img className="fighter2" src={fighter} alt="lil-dinkey" />
      ) : (
        <img className="fighter1" src={fighter} alt="lil-dinkey" />
      )}
    </>
  );
};

export default Fighter;
