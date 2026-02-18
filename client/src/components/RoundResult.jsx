import React, { memo, useMemo } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";

// Victory animation - explosive, triumphant entrance (NO blur - causes freeze)
const victorySlam = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(3) rotate(-8deg);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.85) rotate(3deg);
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

// Screen flash effect
const screenFlash = keyframes`
  0% { opacity: 0; }
  5% { opacity: 0.7; }
  15% { opacity: 0.35; }
  30% { opacity: 0.45; }
  50% { opacity: 0.15; }
  100% { opacity: 0; }
`;

// Shockwave ring expanding outward
const shockwaveExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.1);
    opacity: 0.9;
    border-width: clamp(4px, 0.5vw, 8px);
  }
  50% {
    opacity: 0.5;
    border-width: clamp(2px, 0.25vw, 4px);
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
    border-width: 1px;
  }
`;

// Floating ember/spark animation
const floatUp = keyframes`
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(clamp(-60px, -8vw, -100px)) scale(0.3);
    opacity: 0;
  }
`;

// Corner decoration fade in
const cornerFadeIn = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  20% { opacity: 0; transform: scale(0.5); }
  40% { opacity: 1; transform: scale(1); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1); }
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

// Vertical center for the announcement — centered in the play area below the HUD.
// The HUD (UiPlayerInfo) occupies roughly the top 18% of the game container,
// so the remaining play area spans ~18%–100%. Its midpoint is ~60%.
const ANNOUNCE_TOP = "52%";

// Counteracts the .game-scene camera transform so children stay screen-centered
// (aligned with the HUD scoreboard) regardless of camera pan/zoom.
// The scene applies: translate3d(cam-x, cam-y, 0) scale(cam-scale)
// This applies the inverse: scale(1/cam-scale) translate3d(-cam-x, -cam-y, 0)
// Because `transform` creates a stacking context, z-index on this wrapper
// determines where ALL its children render relative to player sprites.
const CameraStableLayer = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: center center;
  transform:
    scale(calc(1 / var(--cam-scale, 1)))
    translate3d(
      calc(-1 * var(--cam-x, 0px)),
      calc(-1 * var(--cam-y, 0px)),
      0
    );
  pointer-events: none;
  will-change: transform;
`;

// Screen flash overlay - fills the game container, behind players
const ScreenFlash = styled.div`
  position: absolute;
  inset: 0;
  background: ${props => props.$isVictory
    ? 'radial-gradient(circle at center, rgba(255, 255, 200, 0.95) 0%, rgba(255, 215, 0, 0.65) 30%, rgba(255, 180, 0, 0.4) 55%, transparent 80%)'
    : 'radial-gradient(circle at center, rgba(180, 20, 20, 0.8) 0%, rgba(120, 0, 0, 0.5) 35%, rgba(60, 0, 0, 0.25) 55%, transparent 80%)'
  };
  animation: ${screenFlash} 0.8s ease-out forwards;
  pointer-events: none;
  contain: strict;
`;

// Shockwave ring effect — scales with game container
const ShockwaveRing = styled.div`
  position: absolute;
  top: ${ANNOUNCE_TOP};
  left: 50%;
  width: clamp(160px, 26vw, 360px);
  height: clamp(160px, 26vw, 360px);
  border-radius: 50%;
  border: clamp(4px, 0.5vw, 8px) solid ${props => props.$isVictory
    ? 'rgba(255, 215, 0, 0.85)'
    : 'rgba(180, 0, 0, 0.7)'
  };
  background: transparent;
  animation: ${shockwaveExpand} 0.6s ease-out forwards;
  animation-delay: ${props => props.$delay || '0s'};
  pointer-events: none;
`;

// Single ember particle
const Ember = styled.div`
  position: absolute;
  width: ${props => props.$size || 'clamp(4px, 0.5vw, 8px)'};
  height: ${props => props.$size || 'clamp(4px, 0.5vw, 8px)'};
  background: ${props => props.$isVictory
    ? 'radial-gradient(circle, rgba(255, 255, 220, 1) 0%, rgba(255, 215, 0, 0.9) 40%, rgba(255, 180, 0, 0.6) 70%, transparent 100%)'
    : 'radial-gradient(circle, rgba(255, 150, 150, 1) 0%, rgba(200, 50, 50, 0.9) 40%, rgba(150, 0, 0, 0.6) 70%, transparent 100%)'
  };
  border-radius: 50%;
  animation: ${floatUp} ${props => props.$duration || '1.5s'} ease-out forwards;
  animation-delay: ${props => props.$delay || '0.1s'};
  left: ${props => props.$left || '50%'};
  bottom: ${props => props.$bottom || '40%'};
  z-index: 46;
  pointer-events: none;
`;

// Japanese corner decoration — scales with game container
const CornerDecoration = styled.div`
  position: absolute;
  width: clamp(35px, 6vw, 85px);
  height: clamp(35px, 6vw, 85px);
  border: clamp(2px, 0.35vw, 5px) solid ${props => props.$isVictory
    ? 'rgba(255, 215, 0, 0.75)'
    : 'rgba(180, 0, 0, 0.6)'
  };
  animation: ${cornerFadeIn} 3s ease-out forwards;
  z-index: 47;

  ${props => props.$position === 'topLeft' && `
    top: clamp(-35px, -6vw, -80px);
    left: clamp(-35px, -6vw, -80px);
    border-right: none;
    border-bottom: none;
  `}
  ${props => props.$position === 'topRight' && `
    top: clamp(-35px, -6vw, -80px);
    right: clamp(-35px, -6vw, -80px);
    border-left: none;
    border-bottom: none;
  `}
  ${props => props.$position === 'bottomLeft' && `
    bottom: clamp(-35px, -6vw, -80px);
    left: clamp(-35px, -6vw, -80px);
    border-right: none;
    border-top: none;
  `}
  ${props => props.$position === 'bottomRight' && `
    bottom: clamp(-35px, -6vw, -80px);
    right: clamp(-35px, -6vw, -80px);
    border-left: none;
    border-top: none;
  `}
`;

// Effects + kanji container — behind players, in front of dohyo
const EffectsContainer = styled.div`
  position: absolute;
  top: ${ANNOUNCE_TOP};
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${props => props.$isVictory ? css`${victoryShake} 0.4s ease-out` : 'none'};
  will-change: transform;
  contain: layout style;
`;

// Subtitle container — above players
const SubtitleContainer = styled.div`
  position: absolute;
  top: ${ANNOUNCE_TOP};
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: clamp(4.5rem, 10vw, 12rem);
`;

const KanjiContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MainKanji = styled.div`
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: clamp(8rem, 19vw, 22rem);
  font-weight: 900;
  line-height: 1;
  position: relative;
  color: ${props => props.$isVictory ? '#FFD700' : '#8B0000'};
  animation: ${props => props.$isVictory
    ? css`${victorySlam} 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
    : css`${defeatDrop} 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
  };
  text-shadow: ${props => props.$isVictory
    ? `
      clamp(3px, 0.4vw, 6px) clamp(3px, 0.4vw, 6px) 0 #E6B800,
      clamp(6px, 0.8vw, 12px) clamp(6px, 0.8vw, 12px) 0 #CC9900,
      clamp(9px, 1.2vw, 18px) clamp(9px, 1.2vw, 18px) 0 #B38600,
      clamp(12px, 1.6vw, 24px) clamp(12px, 1.6vw, 24px) 0 rgba(153, 115, 0, 0.85),
      clamp(15px, 2vw, 30px) clamp(15px, 2vw, 30px) 0 rgba(120, 90, 0, 0.6),
      0 0 clamp(24px, 4vw, 60px) rgba(255, 215, 0, 0.35)
    `
    : `
      clamp(3px, 0.4vw, 6px) clamp(3px, 0.4vw, 6px) 0 #4a0000,
      clamp(6px, 0.8vw, 12px) clamp(6px, 0.8vw, 12px) 0 #2a0000,
      clamp(9px, 1.2vw, 18px) clamp(9px, 1.2vw, 18px) 0 #1a0000,
      clamp(12px, 1.6vw, 24px) clamp(12px, 1.6vw, 24px) 0 #0a0a0a,
      clamp(15px, 2vw, 30px) clamp(15px, 2vw, 30px) 0 rgba(0, 0, 0, 0.7),
      0 0 clamp(24px, 4vw, 60px) rgba(139, 0, 0, 0.4)
    `
  };
  background: ${props => props.$isVictory
    ? 'linear-gradient(145deg, #FFFFFF 0%, #FFFFA0 10%, #FFEE44 22%, #FFD700 40%, #FFC500 55%, #FFB000 70%, #FF9500 85%, #FF8000 100%)'
    : 'linear-gradient(145deg, #FF4444 0%, #DD2222 10%, #BB1111 20%, #8B0000 35%, #6B0000 50%, #4a0000 65%, #2a0000 80%, #000000 100%)'
  };
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  will-change: transform, opacity;
  contain: layout style;
`;

// Shadow layer behind the kanji for depth
const KanjiShadow = styled.div`
  position: absolute;
  font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho Pro", serif;
  font-size: clamp(8rem, 19vw, 22rem);
  font-weight: 900;
  line-height: 1;
  top: clamp(5px, 0.6vw, 10px);
  left: clamp(5px, 0.6vw, 10px);
  color: ${props => props.$isVictory ? '#FFFFFF' : '#000000'};
  z-index: -1;
  opacity: 0.7;
  will-change: transform, opacity;
  contain: layout style;
`;

const InkSplatter = styled.div`
  position: absolute;
  width: clamp(190px, 36vw, 500px);
  height: clamp(190px, 36vw, 500px);
  border-radius: 50%;
  background: ${props => props.$isVictory
    ? 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.45) 0%, rgba(255, 190, 0, 0.35) 25%, rgba(255, 160, 0, 0.2) 50%, transparent 70%)'
    : 'radial-gradient(ellipse at center, rgba(180, 0, 0, 0.4) 0%, rgba(120, 0, 0, 0.25) 30%, rgba(60, 0, 0, 0.12) 50%, transparent 70%)'
  };
  animation: ${inkSplatter} 3s ease-out forwards;
  z-index: -1;
  transform-origin: center center;
  clip-path: polygon(
    50% 0%, 65% 10%, 80% 5%, 85% 20%, 100% 25%,
    95% 40%, 100% 50%, 95% 65%, 85% 75%, 90% 85%,
    75% 90%, 65% 100%, 50% 95%, 35% 100%, 25% 90%,
    15% 85%, 10% 70%, 0% 60%, 5% 45%, 0% 30%,
    10% 20%, 20% 10%, 35% 5%
  );
`;

const SecondaryInkSplatter = styled(InkSplatter)`
  width: clamp(140px, 27vw, 370px);
  height: clamp(140px, 27vw, 370px);
  animation-delay: 0.1s;
  transform: rotate(45deg);
  opacity: 0.7;
`;

const SubtitleText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.4vw, 3rem);
  color: ${props => props.$isVictory ? '#FFF8E7' : '#E8E8E8'};
  text-transform: uppercase;
  letter-spacing: clamp(0.15em, 0.3em, 0.3em);
  animation: ${subtitleSlide} 3s ease-out forwards;
  -webkit-text-stroke: ${props => props.$isVictory ? 'clamp(1px, 0.12vw, 2px) #996600' : 'clamp(0.5px, 0.08vw, 1px) #2a0000'};
  text-shadow: ${props => props.$isVictory
    ? `
      2px 2px 0 #CC8800,
      4px 4px 0 #AA6600,
      5px 5px 10px rgba(0, 0, 0, 0.7),
      0 0 20px rgba(255, 215, 0, 0.5)
    `
    : `
      2px 2px 0 #6a0000,
      4px 4px 0 #4a0000,
      6px 6px 12px rgba(0, 0, 0, 0.9),
      0 0 25px rgba(139, 0, 0, 0.5),
      0 0 50px rgba(80, 0, 0, 0.3)
    `
  };
`;

const BrushStroke = styled.div`
  position: absolute;
  width: clamp(240px, 48vw, 660px);
  height: clamp(20px, 3.8vw, 50px);
  background: ${props => props.$isVictory
    ? 'linear-gradient(90deg, transparent 0%, rgba(255, 180, 0, 0.3) 15%, rgba(255, 200, 0, 0.55) 35%, rgba(255, 215, 0, 0.7) 50%, rgba(255, 200, 0, 0.55) 65%, rgba(255, 180, 0, 0.3) 85%, transparent 100%)'
    : 'linear-gradient(90deg, transparent 0%, rgba(60, 0, 0, 0.25) 15%, rgba(120, 0, 0, 0.45) 35%, rgba(139, 0, 0, 0.55) 50%, rgba(120, 0, 0, 0.45) 65%, rgba(60, 0, 0, 0.25) 85%, transparent 100%)'
  };
  bottom: clamp(-20px, -3.8vw, -50px);
  animation: ${brushReveal} 3s ease-out forwards;
  border-radius: 50%;
  filter: blur(2px);
`;

const RoundResult = ({ isVictory }) => {
  const kanji = isVictory ? '勝' : '敗';

  const embers = useMemo(() => {
    const positions = [];
    const emberCount = 6;
    for (let i = 0; i < emberCount; i++) {
      positions.push({
        id: i,
        left: `${38 + (i * 4)}%`,
        bottom: `${38 + (i % 2) * 10}%`,
        size: `clamp(4px, ${0.4 + (i % 3) * 0.15}vw, ${6 + (i % 3) * 2}px)`,
        delay: `${0.15 + (i * 0.1)}s`,
        duration: `${1.3 + (i % 2) * 0.4}s`
      });
    }
    return positions;
  }, []);

  return (
    <>
      {/* Behind players (z-index 10) — camera-stabilized so it stays screen-centered */}
      <CameraStableLayer style={{ zIndex: 10 }}>
        <ScreenFlash $isVictory={isVictory} />
        <ShockwaveRing $isVictory={isVictory} $delay="0s" />
        <EffectsContainer $isVictory={isVictory}>
          <InkSplatter $isVictory={isVictory} />
          <SecondaryInkSplatter $isVictory={isVictory} />

          <CornerDecoration $isVictory={isVictory} $position="topLeft" />
          <CornerDecoration $isVictory={isVictory} $position="topRight" />
          <CornerDecoration $isVictory={isVictory} $position="bottomLeft" />
          <CornerDecoration $isVictory={isVictory} $position="bottomRight" />

          <KanjiContainer>
            <KanjiShadow $isVictory={isVictory}>{kanji}</KanjiShadow>
            <MainKanji $isVictory={isVictory}>{kanji}</MainKanji>
          </KanjiContainer>
          <BrushStroke $isVictory={isVictory} />

          {embers.map(ember => (
            <Ember
              key={ember.id}
              $isVictory={isVictory}
              $left={ember.left}
              $bottom={ember.bottom}
              $size={ember.size}
              $delay={ember.delay}
              $duration={ember.duration}
            />
          ))}
        </EffectsContainer>
      </CameraStableLayer>

      {/* Above players (z-index 110) — camera-stabilized */}
      <CameraStableLayer style={{ zIndex: 110 }}>
        <SubtitleContainer>
          <SubtitleText $isVictory={isVictory}>
            {isVictory ? 'SHIROBOSHI' : 'KUROBOSHI'}
          </SubtitleText>
        </SubtitleContainer>
      </CameraStableLayer>
    </>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
};

export default memo(RoundResult);
