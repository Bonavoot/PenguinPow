import styled from "styled-components";

const GyojiShadowElement = styled.div`
  position: absolute;
  left: ${(props) => (props.gyojiState === "idle" ? "38.8%" : "41.2%")};
  bottom: ${(props) => (props.gyojiState === "idle" ? "34.2%" : "35.5%")};
  width: ${(props) => (props.gyojiState === "idle" ? "21%" : "15%")};
  height: 6%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
  z-index: -1;
`;

const GyojiShadow = ({ gyojiState }) => {
  return <GyojiShadowElement gyojiState={gyojiState} />;
};

export default GyojiShadow;
