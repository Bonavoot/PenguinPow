import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import dodgeSmokeGif from "../assets/dodge-smoke-effect.gif";

const GIF_DURATION = 1000; // ms

const SmokeContainer = styled.div.attrs((props) => {
  // Dash is forward if dodgeDirection === facing
  const isBackward =
    props.$dodgeDirection &&
    props.$facing &&
    props.$dodgeDirection !== props.$facing;
  // Offset: adjust based on facing and dash direction
  let offset = 0;
  if (isBackward) {
    offset = props.$facing === 1 ? 10 : 8;
  } else {
    offset = props.$facing === 1 ? 5 : 10;
  }
  // Flip based on facing direction and backward dash
  const scaleX = (props.$facing === 1 ? 1 : -1) * (isBackward ? 1 : -1);
  return {
    style: {
      position: "absolute",
      left: `calc(${(props.$x / 1280) * 100}% + ${offset}%)`,
      bottom: `calc(${(props.$y / 720) * 100}% - 4%)`,
      pointerEvents: "none",
      width: "clamp(144px, 22vw, 384px)",
      height: "auto",
      transform: `translateX(-50%) scaleX(${scaleX})`,
    },
  };
})``;

const DodgeSmokeEffect = ({ x, y, isDodging, facing, dodgeDirection }) => {
  const [smokeInstances, setSmokeInstances] = useState([]);
  const lastDodgeState = useRef(isDodging);

  useEffect(() => {
    if (isDodging && !lastDodgeState.current) {
      setSmokeInstances([
        { x, y, facing, dodgeDirection, key: Date.now() + Math.random() },
      ]);
    }
    lastDodgeState.current = isDodging;
  }, [isDodging, x, y, facing, dodgeDirection]);

  useEffect(() => {
    if (smokeInstances.length === 0) return;
    const timeout = setTimeout(() => {
      setSmokeInstances((prev) => prev.slice(1));
    }, GIF_DURATION);
    return () => clearTimeout(timeout);
  }, [smokeInstances]);

  if (smokeInstances.length === 0) return null;
  return (
    <>
      {smokeInstances.map((smoke) => (
        <SmokeContainer
          $x={smoke.x}
          $y={smoke.y}
          $facing={smoke.facing}
          $dodgeDirection={smoke.dodgeDirection}
          key={smoke.key}
        >
          <img
            src={dodgeSmokeGif}
            alt="Dodge Smoke Effect"
            style={{
              width: "clamp(144px, 22vw, 384px)",
              height: "auto",
              display: "block",
              filter:
                "sepia(1) saturate(2.2) hue-rotate(-35deg) brightness(0.8) contrast(1.15)",
            }}
            draggable={false}
          />
        </SmokeContainer>
      ))}
    </>
  );
};

DodgeSmokeEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isDodging: PropTypes.bool.isRequired,
  facing: PropTypes.number.isRequired,
  dodgeDirection: PropTypes.number.isRequired,
};

export default DodgeSmokeEffect;
