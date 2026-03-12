import Rematch from "./Rematch";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const bannerDrop = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-6%) scale(0.86);
  }
  60% {
    transform: translateY(1.5%) scale(1.015);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.4deg) translateY(0); }
  50% { transform: rotate(0.4deg) translateY(0.5%); }
`;

const victoryGlow = keyframes`
  0%, 100% { 
    text-shadow: 
      3px 3px 0 #1a0e06,
      6px 6px 0 rgba(18, 10, 4, 0.6),
      0 0 6px rgba(255, 215, 0, 0.2),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
  50% { 
    text-shadow: 
      3px 3px 0 #1a0e06,
      6px 6px 0 rgba(18, 10, 4, 0.6),
      0 0 12px rgba(255, 215, 0, 0.35),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
`;

const defeatPulse = keyframes`
  0%, 100% { 
    text-shadow: 
      3px 3px 0 #3a0a0a,
      6px 6px 0 rgba(40, 8, 8, 0.6),
      0 0 6px rgba(200, 50, 50, 0.2),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
  50% { 
    text-shadow: 
      3px 3px 0 #3a0a0a,
      6px 6px 0 rgba(40, 8, 8, 0.6),
      0 0 12px rgba(200, 50, 50, 0.35),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

const overlayFade = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

const spotlightPulse = keyframes`
  0%, 100% {
    opacity: 0.82;
    transform: translateY(0) scale(1);
  }
  50% {
    opacity: 0.9;
    transform: translateY(-1%) scale(1.02);
  }
`;

const haloBreathe = keyframes`
  0%, 100% {
    opacity: 0.54;
    transform: scale(1);
  }
  50% {
    opacity: 0.68;
    transform: scale(1.025);
  }
`;

const innerShimmer = keyframes`
  0% { transform: translateX(-120%); opacity: 0; }
  18% { opacity: 0.55; }
  44% { transform: translateX(120%); opacity: 0.12; }
  100% { transform: translateX(120%); opacity: 0; }
`;

const moteDrift = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, 12px, 0) scale(0.7);
  }
  18% {
    opacity: 0.55;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx), var(--ty), 0) scale(1.12);
  }
`;

const MatchOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
  animation: ${overlayFade} 0.35s ease-out forwards;
`;

const BackdropScrim = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse at center,
      rgba(255, 232, 176, ${(p) => (p.$isWinner ? "0.08" : "0.025")}) 0%,
      rgba(255, 232, 176, 0.015) 22%,
      transparent 42%
    ),
    radial-gradient(
      ellipse at 50% 58%,
      rgba(3, 5, 14, 0.08) 0%,
      rgba(3, 5, 14, 0.24) 34%,
      rgba(2, 3, 10, 0.5) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 5, 12, 0.48) 0%,
      rgba(4, 6, 14, 0.24) 16%,
      rgba(4, 6, 14, 0.18) 30%,
      rgba(3, 5, 12, 0.36) 100%
    );
  backdrop-filter: blur(6px) saturate(0.9) brightness(0.87);
  -webkit-backdrop-filter: blur(6px) saturate(0.9) brightness(0.87);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.22) 0%,
        rgba(0, 0, 0, 0.04) 18%,
        rgba(0, 0, 0, 0) 50%,
        rgba(0, 0, 0, 0.04) 82%,
        rgba(0, 0, 0, 0.22) 100%
      ),
      linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.14) 0%,
        transparent 30%,
        transparent 72%,
        rgba(0, 0, 0, 0.18) 100%
      );
    opacity: 0.62;
  }
`;

const StageLight = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(82vw, 960px);
  height: min(58vh, 620px);
  transform: translate(-50%, -50%);
  pointer-events: none;
  border-radius: 50%;
  background: ${(p) =>
    p.$isWinner
      ? "radial-gradient(circle, rgba(255, 215, 120, 0.18) 0%, rgba(212, 175, 55, 0.11) 24%, rgba(90, 50, 15, 0.05) 42%, transparent 66%)"
      : "radial-gradient(circle, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.018) 24%, rgba(255, 255, 255, 0.01) 42%, transparent 66%)"};
  filter: blur(14px);
  animation: ${spotlightPulse} 4.6s ease-in-out infinite;
`;

const MatchOverStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(52px, 8vh, 88px) clamp(24px, 4vw, 40px);
  pointer-events: none;
`;

const MoteField = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
`;

const Mote = styled.span`
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: ${(p) =>
    p.$isWinner
      ? "radial-gradient(circle, rgba(255, 229, 165, 0.95) 0%, rgba(255, 205, 96, 0.45) 45%, rgba(255, 205, 96, 0) 72%)"
      : "radial-gradient(circle, rgba(255, 160, 160, 0.75) 0%, rgba(180, 48, 48, 0.35) 48%, rgba(180, 48, 48, 0) 74%)"};
  box-shadow: 0 0 14px ${(p) =>
    p.$isWinner ? "rgba(255, 215, 0, 0.22)" : "rgba(160, 30, 30, 0.22)"};
  animation: ${moteDrift} var(--dur) linear infinite;
  animation-delay: var(--delay);
  opacity: 0.65;
`;

// Nobori-style banner container
const MatchOverContainer = styled.div`
  position: relative;
  width: clamp(328px, 33cqw, 462px);
  max-width: min(92vw, 462px);
  z-index: 1;
  pointer-events: auto;
  animation: ${bannerDrop} 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) forwards,
    ${bannerSway} 8s ease-in-out 0.7s infinite;

  @media (max-width: 1200px) {
    width: clamp(300px, 37cqw, 418px);
  }

  @media (max-width: 900px) {
    width: clamp(278px, 45cqw, 360px);
  }
`;

const BannerHalo = styled.div`
  position: absolute;
  inset: -26px -34px -38px;
  border-radius: 32px;
  pointer-events: none;
  background: ${(p) =>
    p.$isWinner
      ? "radial-gradient(circle, rgba(255, 215, 0, 0.18) 0%, rgba(212, 175, 55, 0.12) 26%, rgba(212, 175, 55, 0.04) 46%, transparent 68%)"
      : "radial-gradient(circle, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.025) 26%, rgba(255, 255, 255, 0.01) 46%, transparent 68%)"};
  filter: blur(14px);
  animation: ${haloBreathe} 4s ease-in-out infinite;
`;

// Top hanging bar
const HangingBar = styled.div`
  width: 112%;
  height: clamp(16px, 2.1cqh, 24px);
  background: linear-gradient(180deg,
    #7a5943 0%,
    #5c4033 18%,
    #3d2817 58%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -6%;
  position: relative;
  border: 2px solid #b19062;
  border-bottom: none;
  box-shadow:
    0 4px 12px rgba(0,0,0,0.5),
    0 0 18px rgba(0,0,0,0.24),
    inset 0 1px 0 rgba(255, 230, 180, 0.22);

  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(10px, 1.5cqw, 16px);
    height: clamp(10px, 1.5cqw, 16px);
    background: radial-gradient(circle at 30% 30%, #f3d376, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

// Tassels
const TasselContainer = styled.div`
  position: absolute;
  bottom: -25px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 8%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(6px, 1cqw, 10px);
  height: clamp(20px, 3cqh, 35px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 3px 3px;
  animation: ${tasselSway} ${(props) => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay * 0.15}s;
  transform-origin: top center;

  &::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 8px;
    background: linear-gradient(180deg, #8b7355 0%, #5c4033 100%);
    border-radius: 0 0 2px 2px;
  }
`;

// Main banner body
const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #2a120d 0%,
    #1d0d0a 16%,
    #120707 52%,
    #0d0404 100%
  );
  border: 3px solid #9f8058;
  border-top: none;
  border-radius: 0 0 clamp(12px, 1.5cqw, 20px) clamp(12px, 1.5cqw, 20px);
  padding: clamp(28px, 4cqh, 44px) clamp(20px, 2.7cqw, 34px) clamp(28px, 3.6cqh, 40px);
  box-shadow:
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.6),
    inset 0 2px 0 rgba(255, 221, 180, 0.14),
    inset 0 -18px 30px rgba(0, 0, 0, 0.32);
  position: relative;

  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.018) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.012) 1px,
        transparent 2px
      ),
      linear-gradient(
        180deg,
        rgba(255, 221, 180, 0.06) 0%,
        transparent 26%,
        transparent 72%,
        rgba(255, 221, 180, 0.03) 100%
      );
    pointer-events: none;
    border-radius: 0 0 clamp(12px, 1.5cqw, 20px) clamp(12px, 1.5cqw, 20px);
  }

  /* Gold corner decorations */
  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.18);
    border-radius: clamp(8px, 1cqw, 12px);
    pointer-events: none;
  }

  @supports (backdrop-filter: blur(1px)) {
    backdrop-filter: blur(1.5px);
    -webkit-backdrop-filter: blur(1.5px);
  }

  @media (max-width: 900px) {
    padding: clamp(22px, 3cqh, 32px) clamp(16px, 2.2cqw, 24px) clamp(22px, 2.8cqh, 30px);
    border-width: 2px;
  }
`;

const ResultSection = styled.div`
  text-align: center;
  margin-bottom: clamp(20px, 2.6cqh, 30px);
  padding-bottom: clamp(18px, 2.2cqh, 24px);
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(100%, 260px);
    height: 1px;
    transform: translateX(-50%);
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(212, 175, 55, 0.14) 14%,
      rgba(212, 175, 55, 0.42) 50%,
      rgba(212, 175, 55, 0.14) 86%,
      transparent 100%
    );
  }

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -4px;
    width: clamp(7px, 0.75cqw, 10px);
    height: clamp(7px, 0.75cqw, 10px);
    transform: translateX(-50%) rotate(45deg);
    background: linear-gradient(135deg, #f3d376 0%, #c2932e 100%);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
  }
`;

const ResultText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.28rem, 3.25cqw, 2rem);
  color: ${(props) => (props.$isWinner ? "#FFD700" : "#e36b6b")};
  -webkit-text-stroke: ${(props) =>
    props.$isWinner
      ? "clamp(1.5px, 0.15cqw, 3px) #1a0e06"
      : "clamp(1.5px, 0.15cqw, 3px) #3a0a0a"};
  paint-order: stroke fill;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 0.94;
  animation: ${(props) => (props.$isWinner ? victoryGlow : defeatPulse)} 2s ease-in-out infinite;

  @media (max-width: 900px) {
    font-size: clamp(1rem, 4cqw, 1.55rem);
  }
`;

const SubText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.56rem, 1.2cqw, 0.78rem);
  color: #f2e6d0;
  margin-top: clamp(10px, 1.3cqh, 14px);
  letter-spacing: 0.18em;
  text-shadow: 2px 2px 0 #000;

  @media (max-width: 900px) {
    font-size: clamp(0.46rem, 1.9cqw, 0.66rem);
  }
`;

// Rematch section wrapper
const RematchSection = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  padding-top: clamp(10px, 1.3cqh, 16px);
`;

const InnerShimmer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;

  &::before {
    content: "";
    position: absolute;
    top: -8%;
    bottom: -8%;
    width: 34%;
    left: 0;
    background: ${(p) =>
      p.$isWinner
        ? "linear-gradient(100deg, transparent 0%, rgba(255, 228, 156, 0.02) 28%, rgba(255, 228, 156, 0.16) 52%, rgba(255, 228, 156, 0.02) 76%, transparent 100%)"
        : "linear-gradient(100deg, transparent 0%, rgba(255, 150, 150, 0.02) 28%, rgba(255, 150, 150, 0.1) 52%, rgba(255, 150, 150, 0.02) 76%, transparent 100%)"};
    transform: translateX(-120%);
    animation: ${innerShimmer} ${(p) => (p.$isWinner ? "5.6s" : "7.4s")} ease-in-out infinite;
    animation-delay: 1.2s;
  }
`;

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;
  const motes = [
    { left: "16%", top: "24%", size: "8px", tx: "-24px", ty: "-64px", dur: "6.6s", delay: "-0.9s" },
    { left: "28%", top: "72%", size: "6px", tx: "16px", ty: "-78px", dur: "7.4s", delay: "-3.1s" },
    { left: "47%", top: "18%", size: "10px", tx: "-10px", ty: "-58px", dur: "6.9s", delay: "-2.2s" },
    { left: "61%", top: "78%", size: "7px", tx: "28px", ty: "-70px", dur: "7.8s", delay: "-1.3s" },
    { left: "76%", top: "26%", size: "5px", tx: "-18px", ty: "-60px", dur: "6.2s", delay: "-4.4s" },
    { left: "84%", top: "66%", size: "9px", tx: "12px", ty: "-82px", dur: "8.1s", delay: "-0.5s" },
  ];

  return (
    <MatchOverOverlay>
      <BackdropScrim $isWinner={isWinner} />
      <StageLight $isWinner={isWinner} />
      <MoteField aria-hidden="true">
        {motes.map((mote, index) => (
          <Mote
            key={`${mote.left}-${mote.top}-${index}`}
            $isWinner={isWinner}
            style={{
              "--left": mote.left,
              "--top": mote.top,
              "--size": mote.size,
              "--tx": mote.tx,
              "--ty": mote.ty,
              "--dur": mote.dur,
              "--delay": mote.delay,
            }}
          />
        ))}
      </MoteField>
      <MatchOverStage>
        <MatchOverContainer>
          <BannerHalo $isWinner={isWinner} />
          <HangingBar />
          <BannerBody>
            <InnerShimmer $isWinner={isWinner} />
            <ResultSection $isWinner={isWinner}>
              <ResultText $isWinner={isWinner}>
                {isWinner ? "KACHI-KOSHI" : "MAKE-KOSHI"}
              </ResultText>
              <SubText>{isWinner ? "Victory!" : "Defeat"}</SubText>
            </ResultSection>
            <RematchSection>
              <Rematch roomName={roomName} />
            </RematchSection>
            <TasselContainer>
              <Tassel $delay={0} />
              <Tassel $delay={1} />
              <Tassel $delay={2} />
            </TasselContainer>
          </BannerBody>
        </MatchOverContainer>
      </MatchOverStage>
    </MatchOverOverlay>
  );
};

MatchOver.propTypes = {
  winner: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default MatchOver;
