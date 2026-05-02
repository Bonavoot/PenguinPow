import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import gamepadHandler from "../utils/gamepadHandler";
import Snowfall from "./Snowfall";
import { C, fadeIn, slideInLeft, fadeUp } from "./menuTheme";

// ============================================
// ANIMATIONS
// ============================================

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
  /*
   * Sumi ink base with a faint ice-blue lift in the upper third — same
   * "cold mountain hall before a match" mood as the Lobby's cinematic
   * overlay, so the startup screen reads as part of the same world.
   */
  background:
    radial-gradient(
      ellipse at 50% 30%,
      rgba(28, 78, 110, 0.22) 0%,
      rgba(7, 10, 20, 0.55) 55%,
      ${C.ink} 100%
    ),
    linear-gradient(
      180deg,
      ${C.ink} 0%,
      ${C.inkSoft} 50%,
      ${C.ink} 100%
    );
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.5s ease-out;
  overflow: hidden;
`;

const Vignette = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(0, 0, 0, 0.65) 100%
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
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background: ${(props) =>
    props.$isSnow
      ? `radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(210, 230, 255, 0.3) 50%, transparent 70%)`
      : `radial-gradient(circle, rgba(238, 81, 65, 0.55) 0%, transparent 70%)`};
  border-radius: 50%;
  left: ${(props) => props.$left}%;
  animation: ${(props) =>
      props.$isSnow ? snowParticle : floatParticle}
    ${(props) => props.$duration}s linear infinite;
  animation-delay: ${(props) => props.$delay}s;
  filter: ${(props) => (props.$isSnow ? "blur(0.5px)" : "none")};
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
  display: flex;
  justify-content: center;
  /*
   * Lets the inline TitleBlock (with its left vermillion accent bar)
   * stay attached to the title while the whole block centers in the
   * screen. Mirrors MainMenu's title treatment exactly — both pages
   * read as "the same logo wordmark."
   */
`;

/*
 * TitleBlock + LogoTitle mirror MainMenu's TitleBlock + MainTitle so
 * the wordmark looks identical on both surfaces. The vertical
 * vermillion-to-gold accent bar on the left is part of the brand
 * identity — keeping it here makes the startup screen and main menu
 * read as one product.
 */
const TitleBlock = styled.div`
  position: relative;
  padding-left: clamp(14px, 1.8cqw, 22px);
  animation: ${fadeUp} 0.8s ease-out 0.2s backwards;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6%;
    bottom: 6%;
    width: 4px;
    background: linear-gradient(
      180deg,
      ${C.vermillion} 0%,
      ${C.gold} 50%,
      ${C.vermillion} 100%
    );
    box-shadow: 0 0 16px ${C.vermillionGlow};
    border-radius: 2px;
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out 0.45s forwards;
  }
`;

const LogoTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(2rem, 7cqw, 4rem);
  margin: 0;
  line-height: 0.94;
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.012em;
  white-space: nowrap;
  position: relative;
  /*
   * Static, restrained shadow — matches MainMenu's title exactly.
   * Tiny vermillion offset for color depth + soft ambient drop for
   * lift. No animated glow.
   */
  text-shadow:
    1px 2px 0 ${C.vermillionDeep},
    0 4px 14px rgba(0, 0, 0, 0.55);
  animation: ${slideInLeft} 0.6s ease-out 0.35s backwards;

  span {
    display: inline-block;
  }

  span.accent {
    color: ${C.vermillionBright};
  }

  @media (max-width: 600px) {
    font-size: clamp(1.5rem, 8cqw, 2.5rem);
  }
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
  color: ${C.creamMute};
  margin: 0;
  letter-spacing: 0.22em;
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
  background: ${C.vermillion};
  border-radius: 50%;
  animation: ${dotBounce} 1.2s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay * 0.15}s;
  box-shadow: 0 0 8px ${C.vermillionGlow};
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
  color: ${C.vermillionBright};
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-shadow:
    0 0 10px ${C.vermillionGlow},
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
  color: ${C.success};
  margin: 0;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  animation: ${connectedPulse} 2s ease-in-out infinite;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 12px);

  &::before {
    content: "";
    width: clamp(8px, 1cqw, 10px);
    height: clamp(8px, 1cqw, 10px);
    background: ${C.success};
    border-radius: 50%;
    box-shadow: 0 0 10px ${C.successGlow};
  }
`;

const PressKeyText = styled.p`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.65rem, 1.3cqw, 0.85rem);
  color: ${C.creamMute};
  margin: 0;
  letter-spacing: 0.28em;
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
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.creamMute};
  margin: 0;
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

// ============================================
// DECORATIVE ELEMENTS
// ============================================

const DecoLine = styled.div`
  width: clamp(60px, 12cqw, 120px);
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    ${C.vermillion} 35%,
    ${C.gold} 50%,
    ${C.vermillion} 65%,
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
          <TitleBlock>
            <LogoTitle>
              <span>Pumo</span>{" "}
              <span className="accent">Pumo&nbsp;!</span>
            </LogoTitle>
          </TitleBlock>
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
