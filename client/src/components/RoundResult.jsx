import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";

// Victory animation - explosive, triumphant entrance
const victorySlam = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(3) rotate(-8deg);
    filter: blur(20px);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.85) rotate(3deg);
    filter: blur(0px);
  }
  25% {
    transform: translate(-50%, -50%) scale(1.1) rotate(-1deg);
  }
  35% {
    transform: translate(-50%, -50%) scale(0.98) rotate(0.5deg);
  }
  45% {
    transform: translate(-50%, -50%) scale(1.02) rotate(0deg);
  }
  55% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.1) rotate(0deg);
  }
`;

// Defeat animation - heavy, crushing drop
const defeatDrop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -200%) scale(1.2) rotate(0deg);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -45%) scale(1) rotate(-2deg);
  }
  25% {
    transform: translate(-50%, -50%) scale(0.95) rotate(1deg);
  }
  30% {
    transform: translate(-50%, -48%) scale(1.02) rotate(-0.5deg);
  }
  40% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95) rotate(0deg);
  }
`;

// Brush stroke reveal effect
const brushReveal = keyframes`
  0% {
    clip-path: inset(0 100% 0 0);
  }
  30% {
    clip-path: inset(0 0% 0 0);
  }
  100% {
    clip-path: inset(0 0% 0 0);
  }
`;

// Ink splatter animation
const inkSplatter = keyframes`
  0% {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }
  20% {
    transform: scale(1.2) rotate(10deg);
    opacity: 0.8;
  }
  40% {
    transform: scale(1) rotate(-5deg);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.1) rotate(0deg);
    opacity: 0;
  }
`;

// Subtitle slide in
const subtitleSlide = keyframes`
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  30% {
    opacity: 0;
    transform: translateY(20px);
  }
  50% {
    opacity: 1;
    transform: translateY(0);
  }
  80% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px);
  }
`;

// Victory glow pulse
const victoryGlow = keyframes`
  0%, 100% {
    text-shadow: 
      0 0 20px rgba(255, 215, 0, 0.8),
      0 0 40px rgba(255, 215, 0, 0.6),
      0 0 60px rgba(255, 215, 0, 0.4),
      4px 4px 0 #8B4513,
      -4px -4px 0 #8B4513,
      4px -4px 0 #8B4513,
      -4px 4px 0 #8B4513;
  }
  50% {
    text-shadow: 
      0 0 30px rgba(255, 215, 0, 1),
      0 0 60px rgba(255, 215, 0, 0.8),
      0 0 90px rgba(255, 215, 0, 0.6),
      4px 4px 0 #8B4513,
      -4px -4px 0 #8B4513,
      4px -4px 0 #8B4513,
      -4px 4px 0 #8B4513;
  }
`;

// Defeat dim pulse
const defeatPulse = keyframes`
  0%, 100% {
    text-shadow: 
      0 0 15px rgba(139, 0, 0, 0.6),
      0 0 30px rgba(139, 0, 0, 0.4),
      4px 4px 0 #1a1a1a,
      -4px -4px 0 #1a1a1a,
      4px -4px 0 #1a1a1a,
      -4px 4px 0 #1a1a1a;
  }
  50% {
    text-shadow: 
      0 0 20px rgba(139, 0, 0, 0.8),
      0 0 40px rgba(139, 0, 0, 0.5),
      4px 4px 0 #1a1a1a,
      -4px -4px 0 #1a1a1a,
      4px -4px 0 #1a1a1a,
      -4px 4px 0 #1a1a1a;
  }
`;

// Screen flash effect
const screenFlash = keyframes`
  0% {
    opacity: 0;
  }
  5% {
    opacity: 0.7;
  }
  15% {
    opacity: 0.3;
  }
  25% {
    opacity: 0.5;
  }
  40% {
    opacity: 0.15;
  }
  100% {
    opacity: 0;
  }
`;

// Victory screen shake
const victoryShake = keyframes`
  0%, 100% { transform: translate(-50%, -50%); }
  10% { transform: translate(-52%, -48%); }
  20% { transform: translate(-48%, -52%); }
  30% { transform: translate(-51%, -49%); }
  40% { transform: translate(-49%, -51%); }
  50% { transform: translate(-50%, -50%); }
`;

// Screen flash overlay - behind players but above gyoji/map
const ScreenFlash = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${props => props.$isVictory 
    ? 'radial-gradient(circle at center, rgba(255, 215, 0, 0.9) 0%, rgba(255, 165, 0, 0.6) 40%, transparent 80%)'
    : 'radial-gradient(circle at center, rgba(139, 0, 0, 0.7) 0%, rgba(74, 0, 0, 0.4) 40%, transparent 80%)'
  };
  animation: ${screenFlash} 0.6s ease-out forwards;
  pointer-events: none;
  z-index: 50;
`;

const ResultContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${props => props.$isVictory ? css`${victoryShake} 0.4s ease-out` : 'none'};
`;

const SubtitleContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 110;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 10.5rem;
  
  @media (max-width: 1400px) {
    margin-top: 9rem;
  }
  
  @media (max-width: 1200px) {
    margin-top: 7.5rem;
  }
  
  @media (max-width: 900px) {
    margin-top: 6rem;
  }
  
  @media (max-width: 600px) {
    margin-top: 4rem;
  }
  
  @media (max-height: 800px) {
    margin-top: 7rem;
  }
  
  @media (max-height: 650px) {
    margin-top: 5.5rem;
  }
  
  @media (max-height: 500px) {
    margin-top: 3.5rem;
  }
`;

const KanjiContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MainKanji = styled.div`
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: 22rem;
  font-weight: 900;
  line-height: 1;
  position: relative;
  color: ${props => props.$isVictory ? '#FFD700' : '#8B0000'};
  animation: ${props => props.$isVictory 
    ? css`${victorySlam} 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards, ${victoryGlow} 0.5s ease-in-out 0.3s infinite`
    : css`${defeatDrop} 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards, ${defeatPulse} 0.8s ease-in-out 0.4s infinite`
  };
  text-shadow: ${props => props.$isVictory
    ? `
      0 0 20px rgba(255, 215, 0, 0.8),
      0 0 40px rgba(255, 215, 0, 0.6),
      0 0 60px rgba(255, 215, 0, 0.4),
      8px 8px 0 #8B4513,
      -3px -3px 0 #8B4513,
      8px -3px 0 #8B4513,
      -3px 8px 0 #8B4513
    `
    : `
      0 0 15px rgba(139, 0, 0, 0.6),
      0 0 30px rgba(139, 0, 0, 0.4),
      8px 8px 0 #1a1a1a,
      -3px -3px 0 #1a1a1a,
      8px -3px 0 #1a1a1a,
      -3px 8px 0 #1a1a1a
    `
  };
  /* Brush stroke texture effect */
  background: ${props => props.$isVictory 
    ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 30%, #FFD700 50%, #FFEC8B 70%, #FFD700 100%)'
    : 'linear-gradient(135deg, #8B0000 0%, #4a0000 30%, #8B0000 50%, #a52a2a 70%, #8B0000 100%)'
  };
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: ${props => props.$isVictory ? 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))' : 'drop-shadow(0 0 30px rgba(139, 0, 0, 0.6))'};
  
  @media (max-width: 1400px) {
    font-size: 19rem;
  }
  
  @media (max-width: 1200px) {
    font-size: 16rem;
  }
  
  @media (max-width: 900px) {
    font-size: 13rem;
  }
  
  @media (max-width: 600px) {
    font-size: 9rem;
  }
  
  @media (max-height: 800px) {
    font-size: 15rem;
  }
  
  @media (max-height: 650px) {
    font-size: 12rem;
  }
  
  @media (max-height: 500px) {
    font-size: 8rem;
  }
`;

// Shadow layer behind the kanji for depth
const KanjiShadow = styled.div`
  position: absolute;
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: 22rem;
  font-weight: 900;
  line-height: 1;
  top: 5px;
  left: 5px;
  color: ${props => props.$isVictory ? '#8B4513' : '#1a1a1a'};
  z-index: -1;
  filter: blur(2px);
  opacity: 0.7;
  
  @media (max-width: 1400px) {
    font-size: 19rem;
  }
  
  @media (max-width: 1200px) {
    font-size: 16rem;
  }
  
  @media (max-width: 900px) {
    font-size: 13rem;
  }
  
  @media (max-width: 600px) {
    font-size: 9rem;
  }
  
  @media (max-height: 800px) {
    font-size: 15rem;
  }
  
  @media (max-height: 650px) {
    font-size: 12rem;
  }
  
  @media (max-height: 500px) {
    font-size: 8rem;
  }
`;

const InkSplatter = styled.div`
  position: absolute;
  width: 450px;
  height: 450px;
  border-radius: 50%;
  background: ${props => props.$isVictory 
    ? 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 40%, transparent 70%)'
    : 'radial-gradient(ellipse at center, rgba(139, 0, 0, 0.25) 0%, rgba(74, 0, 0, 0.15) 40%, transparent 70%)'
  };
  animation: ${inkSplatter} 3s ease-out forwards;
  z-index: -1;
  transform-origin: center center;
  
  /* Irregular splatter shape */
  clip-path: polygon(
    50% 0%, 65% 10%, 80% 5%, 85% 20%, 100% 25%, 
    95% 40%, 100% 50%, 95% 65%, 85% 75%, 90% 85%, 
    75% 90%, 65% 100%, 50% 95%, 35% 100%, 25% 90%, 
    15% 85%, 10% 70%, 0% 60%, 5% 45%, 0% 30%, 
    10% 20%, 20% 10%, 35% 5%
  );
  
  @media (max-width: 1200px) {
    width: 380px;
    height: 380px;
  }
  
  @media (max-width: 900px) {
    width: 300px;
    height: 300px;
  }
  
  @media (max-width: 600px) {
    width: 220px;
    height: 220px;
  }
  
  @media (max-height: 650px) {
    width: 260px;
    height: 260px;
  }
  
  @media (max-height: 500px) {
    width: 190px;
    height: 190px;
  }
`;

const SecondaryInkSplatter = styled(InkSplatter)`
  width: 330px;
  height: 330px;
  animation-delay: 0.1s;
  transform: rotate(45deg);
  opacity: 0.7;
  
  @media (max-width: 1200px) {
    width: 280px;
    height: 280px;
  }
  
  @media (max-width: 900px) {
    width: 220px;
    height: 220px;
  }
  
  @media (max-width: 600px) {
    width: 160px;
    height: 160px;
  }
  
  @media (max-height: 650px) {
    width: 190px;
    height: 190px;
  }
  
  @media (max-height: 500px) {
    width: 140px;
    height: 140px;
  }
`;

const SubtitleText = styled.div`
  font-family: "Bungee", cursive;
  font-size: 2.6rem;
  color: ${props => props.$isVictory ? '#FFFFFF' : '#CCCCCC'};
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-top: -22px;
  animation: ${subtitleSlide} 3s ease-out forwards;
  text-shadow: 
    3px 3px 6px rgba(0, 0, 0, 0.9),
    0 0 15px ${props => props.$isVictory ? 'rgba(255, 215, 0, 0.6)' : 'rgba(139, 0, 0, 0.5)'};
  
  @media (max-width: 1400px) {
    font-size: 2.2rem;
    margin-top: -18px;
  }
  
  @media (max-width: 1200px) {
    font-size: 1.9rem;
    margin-top: -15px;
  }
  
  @media (max-width: 900px) {
    font-size: 1.5rem;
    margin-top: -12px;
    letter-spacing: 0.25em;
  }
  
  @media (max-width: 600px) {
    font-size: 1.1rem;
    margin-top: -8px;
    letter-spacing: 0.18em;
  }
  
  @media (max-height: 800px) {
    font-size: 1.7rem;
    margin-top: -14px;
  }
  
  @media (max-height: 650px) {
    font-size: 1.3rem;
    margin-top: -10px;
  }
  
  @media (max-height: 500px) {
    font-size: 1rem;
    margin-top: -6px;
  }
`;

const BrushStroke = styled.div`
  position: absolute;
  width: 620px;
  height: 50px;
  background: ${props => props.$isVictory 
    ? 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.4) 20%, rgba(255, 215, 0, 0.6) 50%, rgba(255, 215, 0, 0.4) 80%, transparent 100%)'
    : 'linear-gradient(90deg, transparent 0%, rgba(139, 0, 0, 0.3) 20%, rgba(139, 0, 0, 0.5) 50%, rgba(139, 0, 0, 0.3) 80%, transparent 100%)'
  };
  bottom: -50px;
  animation: ${brushReveal} 3s ease-out forwards;
  border-radius: 50%;
  filter: blur(2px);
  
  @media (max-width: 1400px) {
    width: 540px;
    height: 42px;
    bottom: -42px;
  }
  
  @media (max-width: 1200px) {
    width: 460px;
    height: 36px;
    bottom: -36px;
  }
  
  @media (max-width: 900px) {
    width: 360px;
    height: 30px;
    bottom: -30px;
  }
  
  @media (max-width: 600px) {
    width: 260px;
    height: 22px;
    bottom: -22px;
  }
  
  @media (max-height: 650px) {
    width: 320px;
    height: 26px;
    bottom: -26px;
  }
  
  @media (max-height: 500px) {
    width: 240px;
    height: 18px;
    bottom: -18px;
  }
`;

const RoundResult = ({ isVictory }) => {
  const kanji = isVictory ? '勝' : '敗';
  
  return (
    <>
      <ScreenFlash $isVictory={isVictory} />
      <ResultContainer $isVictory={isVictory}>
        <InkSplatter $isVictory={isVictory} />
        <SecondaryInkSplatter $isVictory={isVictory} />
        <KanjiContainer>
          <KanjiShadow $isVictory={isVictory}>{kanji}</KanjiShadow>
          <MainKanji $isVictory={isVictory}>{kanji}</MainKanji>
        </KanjiContainer>
        <BrushStroke $isVictory={isVictory} />
      </ResultContainer>
      <SubtitleContainer>
        <SubtitleText $isVictory={isVictory}>
          {isVictory ? 'SHIROBOSHI' : 'KUROBOSHI'}
        </SubtitleText>
      </SubtitleContainer>
    </>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
};

export default RoundResult;
