import styled from "styled-components";
import PropTypes from "prop-types";

// Phase 2: shadow width scaled proportionally with the gyoji's new 16% (was
// 17.33%) sprite width, and `left` re-anchored so each shadow keeps the same
// center coordinate it had pre-shrink. This preserves the hand-tuned shadow
// offset relative to the gyoji's feet in each stance.
const SHADOW_RAISE = 2; // % — uniform lift for every gyoji stance

const GyojiShadowElement = styled.div`
  position: absolute;
  left: ${(props) => (props.$gyojiState === "idle" ? "43.7%" : "44.25%")};
  bottom: ${(props) =>
    props.$gyojiState === "idle"
      ? `${46 + SHADOW_RAISE}%`
      : `${46.8 + SHADOW_RAISE}%`};
  width: ${(props) => (props.$gyojiState === "idle" ? "13%" : "11%")};
  height: 7.8%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0) 72%
  );
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
  z-index: 1;
`;

const GyojiShadow = ({ gyojiState }) => {
  return <GyojiShadowElement $gyojiState={gyojiState} />;
};

GyojiShadow.propTypes = {
  gyojiState: PropTypes.string.isRequired,
};

export default GyojiShadow;
