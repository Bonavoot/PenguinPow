import styled from "styled-components";
import PropTypes from "prop-types";

const GyojiShadowElement = styled.div`
  position: absolute;
  left: ${(props) => (props.$gyojiState === "idle" ? "43.5%" : "44.5%")};
  bottom: ${(props) => (props.$gyojiState === "idle" ? "41.5%" : "41.5%")};
  width: ${(props) => (props.$gyojiState === "idle" ? "12.4%" : "9.8%")};
  height: 6%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
  z-index: -1;
`;

const GyojiShadow = ({ gyojiState }) => {
  return <GyojiShadowElement $gyojiState={gyojiState} />;
};

GyojiShadow.propTypes = {
  gyojiState: PropTypes.string.isRequired,
};

export default GyojiShadow;
