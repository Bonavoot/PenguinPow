import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import gamepadHandler from "../utils/gamepadHandler";
import Snowfall from "./Snowfall";

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const logoGlow = keyframes`
  0%, 100% {
    text-shadow: 
      3px 3px 0 #000,
      0 0 20px rgba(212, 175, 55, 0.3),
      0 0 40px rgba(212, 175, 55, 0.15);
  }
  50% {
    text-shadow: 
      3px 3px 0 #000,
      0 0 35px rgba(212, 175, 55, 0.5),
      0 0 60px rgba(212, 175, 55, 0.25);
  }
`;

const subtlePulse = keyframes`
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
`;

const dotBounce = keyframes`
  0%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-6px);
  }
`;

const pressKeyFade = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
`;

const connectedPulse = keyframes`
  0% {
    text-shadow: 
      0 0 8px rgba(74, 222, 128, 0.5),
      1px 1px 0 #000;
  }
  50% {
    text-shadow: 
      0 0 15px rgba(74, 222, 128, 0.7),
      0 0 25px rgba(74, 222, 128, 0.3),
      1px 1px 0 #000;
  }
  100% {
    text-shadow: 
      0 0 8px rgba(74, 222, 128, 0.5),
      1px 1px 0 #000;
  }
`;

const floatParticle = keyframes`
  0% {
    transform: translateY(100cqh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-20px) rotate(360deg);
    opacity: 0;
  }
`;

const snowParticle = keyframes`
  0% {
    transform: translate(0, -20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  50% {
    transform: translate(15px, 50cqh) rotate(180deg);
  }
  90% {
    opacity: 0.5;
  }
  100% {
    transform: translate(-5px, 100cqh) rotate(360deg);
    opacity: 0;
  }
`;

// ============================================
// CONTAINER
// ============================================

const ScreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg,
    #0a0505 0%,
    #120a08 30%,
    #150c0a 50%,
    #120a08 70%,
    #0a0505 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.5s ease-out;
  overflow: hidden;
`;

// Subtle vignette
const Vignette = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(0, 0, 0, 0.6) 100%
  );
  pointer-events: none;
`;

// Floating particles
const ParticleContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
`;

const Particle = styled.div`
  position: absolute;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$isSnow
    ? `radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(210, 230, 255, 0.3) 50%, transparent 70%)`
    : `radial-gradient(circle, rgba(212, 175, 55, 0.6) 0%, transparent 70%)`
  };
  border-radius: 50%;
  left: ${props => props.$left}%;
  animation: ${props => props.$isSnow ? snowParticle : floatParticle} ${props => props.$duration}s linear infinite;
  animation-delay: ${props => props.$delay}s;
  filter: ${props => props.$isSnow ? 'blur(0.5px)' : 'none'};
`;

// ============================================
// CONTENT
// ============================================

const Content = styled.div`
  text-align: center;
  max-width: 700px;
  padding: 2rem;
  position: relative;
  z-index: 1;
`;

// ============================================
// LOGO
// ============================================

const LogoSection = styled.div`
  margin-bottom: clamp(60px, 12cqh, 120px);
  animation: ${fadeIn} 0.8s ease-out 0.2s both;
`;

const Logo = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(2rem, 7cqw, 4rem);
  color: #d4af37;
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  animation: ${logoGlow} 4s ease-in-out infinite;
  
  @media (max-width: 600px) {
    font-size: clamp(1.5rem, 8cqw, 2.5rem);
  }
`;

const LogoAccent = styled.span`
  font-family: "Bungee", cursive;
  color: #d4af37;
  font-size: 1.1em;
`;

// ============================================
// STATUS SECTION
// ============================================

const StatusSection = styled.div`
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.6s ease-out 0.5s both;
`;

const ConnectingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(12px, 2cqh, 20px);
`;

const ConnectingText = styled.p`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.7rem, 1.6cqw, 1rem);
  color: #8b7355;
  margin: 0;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
`;

const DotsContainer = styled.div`
  display: flex;
  gap: clamp(6px, 1cqw, 10px);
`;

const Dot = styled.div`
  width: clamp(8px, 1.2cqw, 12px);
  height: clamp(8px, 1.2cqw, 12px);
  background: #d4af37;
  border-radius: 50%;
  animation: ${dotBounce} 1.2s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
`;

const ConnectionError = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.2cqw, 12px);
`;

const ErrorIcon = styled.span`
  font-size: clamp(1rem, 2cqw, 1.4rem);
`;

const ErrorText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1.3cqw, 0.8rem);
  color: #f87171;
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 
    0 0 10px rgba(248, 113, 113, 0.3),
    1px 1px 0 #000;
`;

const ConnectedContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(16px, 2.5cqh, 28px);
`;

const ConnectedText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.4cqw, 0.85rem);
  color: #4ade80;
  margin: 0;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  animation: ${connectedPulse} 2s ease-in-out infinite;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 12px);
  
  &::before {
    content: "";
    width: clamp(8px, 1cqw, 10px);
    height: clamp(8px, 1cqw, 10px);
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.6);
  }
`;

const PressKeyText = styled.p`
  font-family: "Outfit", sans-serif;
  font-weight: 400;
  font-size: clamp(0.65rem, 1.3cqw, 0.85rem);
  color: #8b7355;
  margin: 0;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  animation: ${pressKeyFade} 2.5s ease-in-out infinite;
  text-shadow: 1px 1px 0 #000;
`;

// ============================================
// FOOTER
// ============================================

const Footer = styled.div`
  position: absolute;
  bottom: clamp(16px, 3cqh, 32px);
  width: 100%;
  text-align: center;
  animation: ${fadeIn} 0.6s ease-out 0.8s both;
`;

const VersionText = styled.p`
  font-family: "Outfit", sans-serif;
  font-weight: 400;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: rgba(92, 64, 51, 0.6);
  margin: 0;
  letter-spacing: 0.12em;
`;

// ============================================
// DECORATIVE ELEMENTS
// ============================================

const DecoLine = styled.div`
  width: clamp(60px, 12cqw, 120px);
  height: 2px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(139, 115, 85, 0.4) 50%, 
    transparent 100%
  );
  margin: clamp(20px, 4cqh, 40px) auto;
  animation: ${subtlePulse} 3s ease-in-out infinite;
`;

// ============================================
// COMPONENT
// ============================================

const StartupScreen = ({ onContinue, connectionError, steamDeckMode }) => {
  const [showPressKey, setShowPressKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  // Generate particles once on mount (mix of gold + snow)
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: i < 10 ? 3 + Math.random() * 4 : 2 + Math.random() * 4,
    left: Math.random() * 100,
    duration: i < 10 ? 15 + Math.random() * 20 : 12 + Math.random() * 16,
    delay: Math.random() * 15,
    isSnow: i >= 10, // Last 8 particles are snow
  }));

  useEffect(() => {
    // Simulate initial loading/connecting phase
    const connectingTimer = setTimeout(() => {
      setIsConnecting(false);
      setShowPressKey(true);
    }, 2000);

    return () => {
      clearTimeout(connectingTimer);
    };
  }, []);

  useEffect(() => {
    if (!showPressKey) return;

    const handleKeyPress = () => {
      onContinue();
    };

    const handleMouseClick = (event) => {
      if (event.button === 0 || event.button === 2) {
        onContinue();
      }
    };

    const handleGamepadInput = () => {
      if (gamepadHandler.isConnected()) {
        const gamepad = gamepadHandler.getGamepad();
        if (gamepad) {
          const anyButtonPressed = gamepad.buttons.some(
            (button) => button.pressed
          );
          if (anyButtonPressed) {
            onContinue();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("mousedown", handleMouseClick);
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    const gamepadInterval = setInterval(handleGamepadInput, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("mousedown", handleMouseClick);
      document.removeEventListener("contextmenu", (e) => e.preventDefault());
      clearInterval(gamepadInterval);
    };
  }, [showPressKey, onContinue]);

  return (
    <ScreenContainer>
      <Vignette />
      <Snowfall intensity={25} showFrost={true} zIndex={1} />
      
      {/* Subtle floating particles (gold + snow mix) */}
      <ParticleContainer>
        {particles.map((p) => (
          <Particle
            key={p.id}
            $size={p.size}
            $left={p.left}
            $duration={p.duration}
            $delay={p.delay}
            $isSnow={p.isSnow}
          />
        ))}
      </ParticleContainer>
      
      <Content>
        <LogoSection>
          <Logo>
            Pumo Pumo <LogoAccent>!</LogoAccent>
          </Logo>
        </LogoSection>

        <DecoLine />

        <StatusSection>
          {isConnecting && !connectionError && (
            <ConnectingContainer>
              <ConnectingText>Connecting to server</ConnectingText>
              <DotsContainer>
                <Dot $delay={0} />
                <Dot $delay={1} />
                <Dot $delay={2} />
              </DotsContainer>
            </ConnectingContainer>
          )}

          {connectionError && (
            <ConnectionError>
              <ErrorIcon>⚠️</ErrorIcon>
              <ErrorText>Connection failed - Playing offline</ErrorText>
            </ConnectionError>
          )}

          {showPressKey && !connectionError && (
            <ConnectedContainer>
              <ConnectedText>Connected</ConnectedText>
              <PressKeyText>
                {steamDeckMode
                  ? "Press any button to continue"
                  : "Press any key to continue"}
              </PressKeyText>
            </ConnectedContainer>
          )}
        </StatusSection>
      </Content>

      <Footer>
        <VersionText>v1.0.0 Early Access</VersionText>
      </Footer>
    </ScreenContainer>
  );
};

StartupScreen.propTypes = {
  onContinue: PropTypes.func.isRequired,
  connectionError: PropTypes.bool,
  steamDeckMode: PropTypes.bool,
};

export default StartupScreen;
