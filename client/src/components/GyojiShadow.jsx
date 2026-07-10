import styled from "styled-components";
import PropTypes from "prop-types";

// Phase 2: shadow width scaled proportionally with the gyoji's new 16% (was
// 17.33%) sprite width, and `left` re-anchored so each shadow keeps the same
// center coordinate it had pre-shrink. This preserves the hand-tuned shadow
// offset relative to the gyoji's feet in each stance.
const SHADOW_RAISE = 1; // % — uniform lift for every gyoji stance

function shadowLeft(gyojiState) {
  if (gyojiState === "idle") return "43.7%";
  if (gyojiState === "ready") return "44.65%";
  if (gyojiState === "player1Win" || gyojiState === "player2Win") return "45.3%";
  return "45%";
}

const GyojiShadowElement = styled.div`
  position: absolute;
  left: ${(props) => shadowLeft(props.$gyojiState)};
  bottom: ${(props) =>
    props.$gyojiState === "idle"
      ? `${45.25 + SHADOW_RAISE}%`
      : `${46.05 + SHADOW_RAISE}%`};
  width: ${(props) => (props.$gyojiState === "idle" ? "13%" : "10.25%")};
  height: ${(props) => (props.$gyojiState === "idle" ? "7.8%" : "6.6%")};
  /* Cool slate falloff to match the fighters' ice-cooled contact shadows —
     near-neutral core, cold penumbra so the gyoji belongs to the frozen ring. */
  background: radial-gradient(
    ellipse at center,
    rgba(2, 4, 8, 0.82) 0%,
    rgba(9, 17, 32, 0.38) ${(props) => (props.$gyojiState === "idle" ? "48%" : "45%")},
    rgba(14, 24, 42, 0) ${(props) => (props.$gyojiState === "idle" ? "72%" : "66%")}
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
