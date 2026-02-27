// import { useEffect, useRef, useState } from "react";
// import styled, { keyframes } from "styled-components";
// import PropTypes from "prop-types";

// // Landing impact duration
// const LANDING_DURATION = 250; // ms

// // Dust particle burst animation
// const dustBurst = keyframes`
//   0% {
//     transform: translateX(-50%) scale(0.3);
//     opacity: 0.9;
//   }
//   30% {
//     transform: translateX(-50%) scale(1.2);
//     opacity: 0.8;
//   }
//   100% {
//     transform: translateX(-50%) scale(1.8) translateY(-15px);
//     opacity: 0;
//   }
// `;

// // Impact ring expansion
// const impactRing = keyframes`
//   0% {
//     transform: translateX(-50%) scaleX(0.2) scaleY(0.5);
//     opacity: 0.9;
//   }
//   50% {
//     transform: translateX(-50%) scaleX(1.5) scaleY(0.3);
//     opacity: 0.6;
//   }
//   100% {
//     transform: translateX(-50%) scaleX(2.5) scaleY(0.1);
//     opacity: 0;
//   }
// `;

// // Speed lines shooting outward
// const speedLineLeft = keyframes`
//   0% {
//     transform: translateX(0) scaleX(0.3);
//     opacity: 0.9;
//   }
//   100% {
//     transform: translateX(-80px) scaleX(1.5);
//     opacity: 0;
//   }
// `;

// const speedLineRight = keyframes`
//   0% {
//     transform: translateX(0) scaleX(0.3);
//     opacity: 0.9;
//   }
//   100% {
//     transform: translateX(80px) scaleX(1.5);
//     opacity: 0;
//   }
// `;

// // Small debris particles
// const debrisUp1 = keyframes`
//   0% {
//     transform: translate(-50%, 0) scale(1);
//     opacity: 1;
//   }
//   100% {
//     transform: translate(-80%, -40px) scale(0.3);
//     opacity: 0;
//   }
// `;

// const debrisUp2 = keyframes`
//   0% {
//     transform: translate(-50%, 0) scale(1);
//     opacity: 1;
//   }
//   100% {
//     transform: translate(20%, -35px) scale(0.4);
//     opacity: 0;
//   }
// `;

// const debrisUp3 = keyframes`
//   0% {
//     transform: translate(-50%, 0) scale(1);
//     opacity: 1;
//   }
//   100% {
//     transform: translate(-120%, -25px) scale(0.2);
//     opacity: 0;
//   }
// `;

// const debrisUp4 = keyframes`
//   0% {
//     transform: translate(-50%, 0) scale(1);
//     opacity: 1;
//   }
//   100% {
//     transform: translate(60%, -30px) scale(0.35);
//     opacity: 0;
//   }
// `;

// const LandingContainer = styled.div`
//   position: absolute;
//   left: ${(props) => `calc(${(props.$x / 1280) * 100}%)`};
//   bottom: ${(props) => `calc(${(props.$y / 720) * 100}%)`};
//   pointer-events: none;
//   z-index: 95;
// `;

// // Main dust cloud
// const DustCloud = styled.div`
//   position: absolute;
//   bottom: 0;
//   left: 50%;
//   width: clamp(60px, 8cqw, 120px);
//   height: clamp(25px, 3cqw, 45px);
//   background: radial-gradient(ellipse at center bottom, 
//     rgba(255, 255, 255, 0.7) 0%, 
//     rgba(200, 220, 255, 0.4) 40%, 
//     transparent 70%
//   );
//   border-radius: 50%;
//   filter: blur(3px);
//   animation: ${dustBurst} ${LANDING_DURATION}ms ease-out forwards;
// `;

// // Impact ring effect
// const ImpactRing = styled.div`
//   position: absolute;
//   bottom: 2px;
//   left: 50%;
//   width: clamp(80px, 10cqw, 150px);
//   height: clamp(15px, 2cqw, 25px);
//   background: transparent;
//   border: 2px solid rgba(255, 255, 255, 0.6);
//   border-radius: 50%;
//   filter: blur(1px);
//   animation: ${impactRing} ${LANDING_DURATION * 0.8}ms ease-out forwards;
// `;

// // Speed lines for horizontal momentum
// const SpeedLine = styled.div`
//   position: absolute;
//   bottom: 8px;
//   left: ${(props) => props.$left ? '45%' : '55%'};
//   width: clamp(30px, 4cqw, 60px);
//   height: 3px;
//   background: linear-gradient(
//     ${(props) => props.$left ? '90deg' : '270deg'},
//     rgba(255, 255, 255, 0.8) 0%,
//     transparent 100%
//   );
//   border-radius: 2px;
//   animation: ${(props) => props.$left ? speedLineLeft : speedLineRight} ${LANDING_DURATION * 0.7}ms ease-out forwards;
// `;

// // Small debris particles
// const Debris = styled.div`
//   position: absolute;
//   bottom: 5px;
//   left: 50%;
//   width: clamp(4px, 0.5cqw, 8px);
//   height: clamp(4px, 0.5cqw, 8px);
//   background: rgba(255, 255, 255, 0.9);
//   border-radius: 50%;
//   animation: ${(props) => {
//     switch(props.$variant) {
//       case 1: return debrisUp1;
//       case 2: return debrisUp2;
//       case 3: return debrisUp3;
//       case 4: return debrisUp4;
//       default: return debrisUp1;
//     }
//   }} ${LANDING_DURATION}ms ease-out forwards;
//   animation-delay: ${(props) => props.$delay || 0}ms;
// `;

// const DodgeLandingEffect = ({ x, y, justLanded, isCancelled }) => {
//   const [effects, setEffects] = useState([]);
//   const lastLandedState = useRef(justLanded);

//   useEffect(() => {
//     // Trigger effect when transitioning to landed state
//     if (justLanded && !lastLandedState.current) {
//       const newEffect = {
//         x,
//         y,
//         isCancelled,
//         key: Date.now() + Math.random(),
//       };
//       setEffects((prev) => [...prev, newEffect]);
//     }
//     lastLandedState.current = justLanded;
//   }, [justLanded, x, y, isCancelled]);

//   useEffect(() => {
//     if (effects.length === 0) return;
//     const timeout = setTimeout(() => {
//       setEffects((prev) => prev.slice(1));
//     }, LANDING_DURATION);
//     return () => clearTimeout(timeout);
//   }, [effects]);

//   if (effects.length === 0) return null;

//   return (
//     <>
//       {effects.map((effect) => (
//         <LandingContainer
//           key={effect.key}
//           $x={effect.x}
//           $y={effect.y}
//         >
//           <DustCloud />
//           <ImpactRing />
//           <SpeedLine $left />
//           <SpeedLine />
//           <Debris $variant={1} $delay={0} />
//           <Debris $variant={2} $delay={20} />
//           <Debris $variant={3} $delay={10} />
//           <Debris $variant={4} $delay={30} />
//         </LandingContainer>
//       ))}
//     </>
//   );
// };

// DodgeLandingEffect.propTypes = {
//   x: PropTypes.number.isRequired,
//   y: PropTypes.number.isRequired,
//   justLanded: PropTypes.bool.isRequired,
//   isCancelled: PropTypes.bool,
// };

// export default DodgeLandingEffect;
