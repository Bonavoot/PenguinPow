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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.78;
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
   * Hokkaido daybreak: a flat snow base with the colder ice tone
   * banded toward the top and the warmest light gathered just below
   * the title. Single linear gradient — no radial wash on top of a
   * second gradient like the dark version had. The flatter the
   * background, the less it reads as templated AI chrome.
   */
  background: linear-gradient(
    180deg,
    ${C.snowFrost} 0%,
    ${C.snow} 38%,
    ${C.snowSoft} 72%,
    ${C.snow} 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.5s ease-out;
  overflow: hidden;
`;

/*
 * Soft cool corner shadows. Replaces the previous radial vignette
 * (transparent center → 65% black edges), which was useful on the
 * dark theme but is the wrong move on a snow page — a hard radial
 * dark edge on a light field reads as a dropped gel on a stage.
 * Instead the corners gently darken with a cool snow-shadow so the
 * page feels framed, not vignetted.
 */
const Vignette = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      ellipse 80% 60% at 50% 100%,
      transparent 60%,
      ${C.snowShadow} 100%
    ),
    radial-gradient(
      ellipse 80% 50% at 50% 0%,
      transparent 65%,
      ${C.snowShadow} 100%
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
  /*
   * On the snow theme the white drifting "snow-on-black" particle
   * disappears because the field IS white. So snow particles become
   * faint cool DOTS (slightly darker than the snow background) that
   * read like distant flurries against a pale sky. The non-snow
   * particles are kept as small cool ice glints (pale blue) instead
   * of the previous warm vermillion specks — a lighter scene wants
   * cooler particle accents to stay on-brand with the icy palette.
   */
  background: ${(props) =>
    props.$isSnow
      ? `radial-gradient(circle, rgba(80, 110, 145, 0.45) 0%, rgba(120, 160, 195, 0.18) 55%, transparent 75%)`
      : `radial-gradient(circle, rgba(54, 130, 170, 0.55) 0%, rgba(54, 130, 170, 0.18) 50%, transparent 75%)`};
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
 * the wordmark looks identical on both surfaces — both pages read
 * as "the same product." The decorative vertical accent bar that
 * used to live here was fighting the type for attention; the new
 * lockup carries itself on type alone.
 */
const TitleBlock = styled.div`
  position: relative;
  animation: ${fadeUp} 0.8s ease-out 0.2s backwards;
`;

const LogoTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(2rem, 7cqw, 4rem);
  margin: 0;
  line-height: 0.94;
  color: ${C.inkTextStrong};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  position: relative;
  /*
   * Stamped poster depth: thin white emboss highlight, solid dark
   * drop at the bottom, and a soft cool ambient shadow that lifts
   * the wordmark off the snow surface. The previous vermillion
   * misregistration was muddying the letterforms — the new layered
   * shadow is what gives the type its real "pressed into paper"
   * weight without the color smudge.
   */
  text-shadow:
    0 -1px 0 rgba(255, 255, 255, 0.55),
    0 2px 0 rgba(15, 29, 46, 0.18),
    0 4px 0 rgba(15, 29, 46, 0.30),
    0 8px 18px ${C.snowShadowStrong};
  animation: ${slideInLeft} 0.6s ease-out 0.35s backwards;

  span {
    display: inline-block;
  }

  /*
   * Both PUMO halves share the deep ink so the wordmark reads as
   * ONE word, not two. Only the exclamation mark gets the red
   * accent — it works like a hanko seal closing the lockup.
   */
  span.bang {
    color: ${C.vermillion};
    margin-left: 0.08em;
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
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.7rem, 1.6cqw, 1rem);
  color: ${C.inkTextMute};
  margin: 0;
  letter-spacing: 0.22em;
  text-transform: uppercase;
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
  color: ${C.vermillionDeep};
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
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
  /*
   * Mid-green sitting between C.success (#4ade80, too bright to
   * read on the icy off-white snow surface) and C.successDeep
   * (#16a34a, reads as a too-dark forest green). #22c55e
   * preserves the visual relationship to the bright dot beside
   * it — same "live" green family.
   *
   * Paired with a subtle dark text-shadow that gives each letter
   * a faint dark fringe so the green pops off the snow surface
   * without forcing a literal stroke (which would feel out of
   * place next to all the other unstroked menu type). This is
   * the standard "live status label on a light background"
   * recipe — game HUDs and sports tickers all do this.
   */
  color: #22c55e;
  text-shadow:
    0 0 2px rgba(15, 29, 46, 0.55),
    0 1px 0 rgba(15, 29, 46, 0.35);
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
  }
`;

const PressKeyText = styled.p`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.65rem, 1.3cqw, 0.85rem);
  color: ${C.inkTextSoft};
  margin: 0;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  animation: ${pressKeyFade} 2.5s ease-in-out infinite;
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
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.inkTextMute};
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
      <Snowfall intensity={55} showFrost={true} zIndex={1} />
      
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
              <span>Pumo</span> <span>Pumo</span>
              <span className="bang">!</span>
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
