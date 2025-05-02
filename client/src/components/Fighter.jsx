import PropTypes from "prop-types";

const Fighter = ({ index, fighterImgSrc }) => {
  return (
    <div className={`fighter${index}-container`}>
      <img
        className={`fighter${index + 1}`}
        src={fighterImgSrc}
        alt="fighter"
      />
    </div>
  );
};

Fighter.propTypes = {
  index: PropTypes.number.isRequired,
  fighterImgSrc: PropTypes.string.isRequired,
};

export default Fighter;
