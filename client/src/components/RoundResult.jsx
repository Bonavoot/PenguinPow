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

// Screen flash overlay
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
  z-index: 1400;
`;

const ResultContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1500;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${props => props.$isVictory ? css`${victoryShake} 0.4s ease-out` : 'none'};
`;

const KanjiContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MainKanji = styled.div`
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: clamp(6rem, 25vw, 18rem);
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
      6px 6px 0 #8B4513,
      -2px -2px 0 #8B4513,
      6px -2px 0 #8B4513,
      -2px 6px 0 #8B4513
    `
    : `
      0 0 15px rgba(139, 0, 0, 0.6),
      0 0 30px rgba(139, 0, 0, 0.4),
      6px 6px 0 #1a1a1a,
      -2px -2px 0 #1a1a1a,
      6px -2px 0 #1a1a1a,
      -2px 6px 0 #1a1a1a
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
  filter: ${props => props.$isVictory ? 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.8))' : 'drop-shadow(0 0 20px rgba(139, 0, 0, 0.6))'};
`;

// Shadow layer behind the kanji for depth
const KanjiShadow = styled.div`
  position: absolute;
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: clamp(6rem, 25vw, 18rem);
  font-weight: 900;
  line-height: 1;
  top: 4px;
  left: 4px;
  color: ${props => props.$isVictory ? '#8B4513' : '#1a1a1a'};
  z-index: -1;
  filter: blur(2px);
  opacity: 0.7;
`;

const InkSplatter = styled.div`
  position: absolute;
  width: clamp(150px, 40vw, 400px);
  height: clamp(150px, 40vw, 400px);
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
`;

const SecondaryInkSplatter = styled(InkSplatter)`
  width: clamp(100px, 30vw, 300px);
  height: clamp(100px, 30vw, 300px);
  animation-delay: 0.1s;
  transform: rotate(45deg);
  opacity: 0.7;
`;

const SubtitleText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 4vw, 2.5rem);
  color: ${props => props.$isVictory ? '#FFFFFF' : '#CCCCCC'};
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-top: clamp(-10px, -2vw, -20px);
  animation: ${subtitleSlide} 3s ease-out forwards;
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.8),
    0 0 10px ${props => props.$isVictory ? 'rgba(255, 215, 0, 0.5)' : 'rgba(139, 0, 0, 0.5)'};
`;

const BrushStroke = styled.div`
  position: absolute;
  width: clamp(200px, 60vw, 600px);
  height: clamp(20px, 4vw, 50px);
  background: ${props => props.$isVictory 
    ? 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.4) 20%, rgba(255, 215, 0, 0.6) 50%, rgba(255, 215, 0, 0.4) 80%, transparent 100%)'
    : 'linear-gradient(90deg, transparent 0%, rgba(139, 0, 0, 0.3) 20%, rgba(139, 0, 0, 0.5) 50%, rgba(139, 0, 0, 0.3) 80%, transparent 100%)'
  };
  bottom: clamp(-30px, -5vw, -50px);
  animation: ${brushReveal} 3s ease-out forwards;
  border-radius: 50%;
  filter: blur(2px);
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
        <SubtitleText $isVictory={isVictory}>
          {isVictory ? 'SHIROBOSHI' : 'KUROBOSHI'}
        </SubtitleText>
        <BrushStroke $isVictory={isVictory} />
      </ResultContainer>
    </>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
};

export default RoundResult;
