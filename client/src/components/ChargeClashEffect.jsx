import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./ChargeClashEffect.css";

const ClashEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 + 4}%`,
    transform: "translate(-50%, 50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

const ChargeClashEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 550);
    }
  }, [position]);

  if (!showEffect || !position) return null;

  return (
    <ClashEffectContainer $x={position.x} $y={position.y}>
      <div className="charge-clash-ring">
        <div className="charge-clash-cross"></div>
      </div>
    </ClashEffectContainer>
  );
};

ChargeClashEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }),
};

export default ChargeClashEffect;
