import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import dodgeSmokeGif from "../assets/dodge-effect.gif";

const GIF_DURATION = 450; // Match bigger dodge arc duration

// Speed line animation - shoots in dodge direction
const speedLineShoot = keyframes`
  0% {
    transform: scaleX(0.3) translateX(0);
    opacity: 1;
  }
  40% {
    transform: scaleX(1.2) translateX(var(--shoot-dir, 30px));
    opacity: 0.8;
  }
  100% {
    transform: scaleX(0.5) translateX(calc(var(--shoot-dir, 30px) * 2.5));
    opacity: 0;
  }
`;

// Afterimage fade
const afterimageFade = keyframes`
  0% {
    opacity: 0.6;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(var(--trail-dir, -20px)) scale(0.95);
  }
`;

// Burst particles at start
const burstParticle = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 1;
  }
  100% {
    transform: translate(var(--burst-x, 0), var(--burst-y, -30px)) scale(0.1);
    opacity: 0;
  }
`;

// Ground dust kick-up
const groundDust = keyframes`
  0% {
    transform: translateX(-50%) scaleY(0.3) scaleX(0.5);
    opacity: 0.9;
  }
  30% {
    transform: translateX(-50%) scaleY(1) scaleX(1.2);
    opacity: 0.7;
  }
  100% {
    transform: translateX(-50%) scaleY(0.5) scaleX(2) translateY(-20px);
    opacity: 0;
  }
`;

const SmokeContainer = styled.div.attrs((props) => {
  const isBackward =
    props.$dodgeDirection !== undefined &&
    props.$facing !== undefined &&
    props.$dodgeDirection !== props.$facing;
  let offset = 0;
  if (isBackward) {
    offset = props.$facing === 1 ? 10 : 8;
  } else {
    offset = props.$facing === 1 ? 5 : 10;
  }
  const scaleX = (props.$facing === 1 ? 1 : -1) * (isBackward ? 1 : -1);
  return {
    style: {
      position: "absolute",
      left: `calc(${(props.$x / 1280) * 100}% + ${offset}%)`,
      bottom: `calc(${(props.$y / 720) * 100}%)`,
      pointerEvents: "none",
      width: "clamp(75px, 11.11vw, 199px)",
      height: "auto",
      transform: `translateX(-50%) scaleX(${scaleX})`,
      opacity: 0.85,
      zIndex: 1000,
      filter: "grayscale(100%) brightness(200%)",
    },
  };
})``;

// Speed lines container - shoots in dodge direction
const SpeedLinesContainer = styled.div`
  position: absolute;
  left: ${(props) => `calc(${(props.$x / 1280) * 100}%)`};
  bottom: ${(props) => `calc(${((props.$y + 35) / 720) * 100}%)`};
  pointer-events: none;
  z-index: 999;
`;

const SpeedLine = styled.div`
  position: absolute;
  width: clamp(30px, 4.44vw, 67px);
  height: 2px;
  background: linear-gradient(
    ${(props) => props.$direction > 0 ? '90deg' : '270deg'},
    rgba(255, 255, 255, 0.95) 0%,
    rgba(200, 230, 255, 0.6) 50%,
    transparent 100%
  );
  border-radius: 2px;
  --shoot-dir: ${(props) => props.$direction * 44}px;
  animation: ${speedLineShoot} ${GIF_DURATION * 0.6}ms ease-out forwards;
  animation-delay: ${(props) => props.$delay || 0}ms;
  top: ${(props) => props.$offset || 0}px;
  filter: blur(0.5px);
`;

// Afterimage effect - ghost trail
const AfterimageContainer = styled.div`
  position: absolute;
  left: ${(props) => `calc(${(props.$x / 1280) * 100}%)`};
  bottom: ${(props) => `calc(${(props.$y / 720) * 100}%)`};
  pointer-events: none;
  z-index: 97;
  --trail-dir: ${(props) => props.$direction * -25}px;
  animation: ${afterimageFade} ${GIF_DURATION * 0.5}ms ease-out forwards;
  animation-delay: ${(props) => props.$delay || 0}ms;
  opacity: 0;
`;

const AfterimageGhost = styled.div`
  width: clamp(59px, 7.41vw, 111px);
  height: clamp(59px, 7.41vw, 111px);
  background: radial-gradient(ellipse at center, 
    rgba(200, 230, 255, 0.4) 0%, 
    rgba(150, 200, 255, 0.2) 40%, 
    transparent 70%
  );
  border-radius: 40% 40% 45% 45%;
  filter: blur(8px);
  transform: translateX(-50%);
`;

// Burst particles at dodge start
const BurstParticle = styled.div`
  position: absolute;
  width: clamp(4px, 0.59vw, 9px);
  height: clamp(4px, 0.59vw, 9px);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  --burst-x: ${(props) => props.$bx}px;
  --burst-y: ${(props) => props.$by}px;
  animation: ${burstParticle} ${GIF_DURATION * 0.5}ms ease-out forwards;
  filter: blur(1px);
`;

// Ground dust cloud
const GroundDust = styled.div`
  position: absolute;
  bottom: 0;
  left: 50%;
  width: clamp(37px, 5.19vw, 74px);
  height: clamp(15px, 1.85vw, 30px);
  background: radial-gradient(ellipse at center bottom, 
    rgba(255, 255, 255, 0.6) 0%, 
    rgba(200, 220, 255, 0.3) 50%, 
    transparent 80%
  );
  border-radius: 50%;
  filter: blur(4px);
  animation: ${groundDust} ${GIF_DURATION * 0.7}ms ease-out forwards;
`;

const BurstContainer = styled.div`
  position: absolute;
  left: ${(props) => `calc(${(props.$x / 1280) * 100}%)`};
  bottom: ${(props) => `calc(${((props.$y + 30) / 720) * 100}%)`};
  pointer-events: none;
  z-index: 998;
`;

const DodgeSmokeEffect = ({ x, y, isDodging, facing, dodgeDirection }) => {
  const [smokeInstances, setSmokeInstances] = useState([]);
  const lastDodgeState = useRef(isDodging);

  useEffect(() => {
    if (isDodging && !lastDodgeState.current) {
      setSmokeInstances([
        {
          x,
          y,
          facing,
          dodgeDirection: dodgeDirection || facing,
          key: Date.now() + Math.random(),
        },
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
        <div key={smoke.key}>
          {/* Original smoke GIF */}
          <SmokeContainer
            $x={smoke.x}
            $y={smoke.y}
            $facing={smoke.facing}
            $dodgeDirection={smoke.dodgeDirection}
          >
      
          </SmokeContainer>

          {/* Speed lines shooting in dodge direction */}
          <SpeedLinesContainer $x={smoke.x} $y={smoke.y}>
            <SpeedLine $direction={smoke.dodgeDirection} $offset={-5} $delay={0} />
            <SpeedLine $direction={smoke.dodgeDirection} $offset={5} $delay={30} />
            <SpeedLine $direction={smoke.dodgeDirection} $offset={15} $delay={60} />
            <SpeedLine $direction={smoke.dodgeDirection} $offset={-15} $delay={20} />
          </SpeedLinesContainer>

          {/* Afterimage ghosts trailing behind */}
          <AfterimageContainer 
            $x={smoke.x} 
            $y={smoke.y} 
            $direction={smoke.dodgeDirection}
            $delay={0}
          >
            <AfterimageGhost />
          </AfterimageContainer>
          <AfterimageContainer 
            $x={smoke.x} 
            $y={smoke.y} 
            $direction={smoke.dodgeDirection}
            $delay={50}
          >
            <AfterimageGhost />
          </AfterimageContainer>

          {/* Burst particles */}
          <BurstContainer $x={smoke.x} $y={smoke.y}>
            <BurstParticle $bx={smoke.dodgeDirection * 20} $by={-25} />
            <BurstParticle $bx={smoke.dodgeDirection * 35} $by={-15} />
            <BurstParticle $bx={smoke.dodgeDirection * 15} $by={-35} />
            <BurstParticle $bx={smoke.dodgeDirection * 40} $by={-5} />
            <GroundDust />
          </BurstContainer>
        </div>
      ))}
    </>
  );
};

DodgeSmokeEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isDodging: PropTypes.bool.isRequired,
  facing: PropTypes.number.isRequired,
  dodgeDirection: PropTypes.number,
};

export default DodgeSmokeEffect;
