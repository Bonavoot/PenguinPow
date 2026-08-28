import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import gamepadHandler from "../utils/gamepadHandler";
import Snowfall from "./Snowfall";
import { setMusic, unlockScreenMusic } from "../utils/soundUtils";
import {
  C,
  FONT_BODY,
  FONT_WEIGHT,
  TRACK,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  broadcastSlideDown,
} from "./menuTheme";
import PumoLogo from "./PumoLogo";

// ============================================
// ANIMATIONS
// ============================================

const pressKeyFade = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.38; }
`;

const liveDotPulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
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
  container-type: size;
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
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

const AtmosphereKanji = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -52%);
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: clamp(14rem, 42cqw, 28rem);
  color: ${C.inkText};
  opacity: 0.035;
  line-height: 1;
  letter-spacing: 0.08em;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  z-index: 0;
`;

// ============================================
// TOP SLUG — same broadcast chrome as MainMenu,
// adapted for the snow surface (ink + ice, no
// cream text-shadow).
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(12px, 1.8cqh, 20px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  z-index: 30;
  will-change: transform, opacity;
  animation: ${broadcastSlideDown} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s
    backwards;
`;

const SlugText = styled.span`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) =>
    p.$warn
      ? C.vermillionDeep
      : p.$accent
        ? C.iceMid
        : C.inkTextMute};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  white-space: nowrap;

  strong {
    color: ${C.inkText};
    letter-spacing: 0.1em;
  }
`;

const SlugRule = styled.span`
  width: 16px;
  height: 1px;
  background: ${C.snowBorder};
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${C.successDeep};
  flex-shrink: 0;
  animation: ${liveDotPulse} 2s ease-in-out infinite;
`;

// ============================================
// CONTENT
// ============================================

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(28px, 5cqh, 48px);
  text-align: center;
  padding: 2rem;
`;

const BrandBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(14px, 2.2cqh, 22px);
  animation: ${fadeUp} 0.75s cubic-bezier(0.2, 0.7, 0.2, 1) 0.15s backwards;
`;

const BrandRule = styled.div`
  width: clamp(48px, 7cqw, 72px);
  height: 2px;
  background: ${C.vermillion};
  opacity: 0;
  animation: ${fadeIn} 0.4s ease-out 0.45s forwards;
`;

// ============================================
// STATUS
// ============================================

const StatusSection = styled.div`
  min-height: clamp(2.5rem, 5cqh, 3.5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.55s ease-out 0.55s both;
`;

const ConnectingText = styled.p`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.6rem, 1.15cqw, 0.75rem);
  color: ${C.inkTextMute};
  margin: 0;
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
`;

const ErrorText = styled.p`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.55rem, 1.2cqw, 0.75rem);
  color: ${C.vermillionDeep};
  margin: 0;
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
`;

const PressKeyText = styled.p`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.65rem, 1.25cqw, 0.82rem);
  color: ${C.inkTextSoft};
  margin: 0;
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  animation: ${pressKeyFade} 2.6s ease-in-out infinite;
`;

// ============================================
// COMPONENT
// ============================================

const StartupScreen = ({ onContinue, connectionError, steamDeckMode }) => {
  const [showPressKey, setShowPressKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    setMusic("title");
    const unlock = () => unlockScreenMusic();
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
  }, []);

  useEffect(() => {
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

  const slugStatus = connectionError
    ? { warn: true, label: "Ring Closed" }
    : isConnecting
      ? { warn: false, label: "Connecting" }
      : { warn: false, label: "Dohyo Open", live: true };

  return (
    <ScreenContainer>
      <Vignette />
      <AtmosphereKanji aria-hidden>相撲</AtmosphereKanji>
      <Snowfall intensity={22} showFrost zIndex={1} />

      <TopSlug>
        <SlugText $accent>
          <strong>VER.</strong> HATSU
        </SlugText>
        <SlugRule aria-hidden />
        {slugStatus.live && <LiveDot aria-hidden />}
        <SlugText $warn={slugStatus.warn}>{slugStatus.label}</SlugText>
      </TopSlug>

      <Content>
        <BrandBlock>
          <PumoLogo size="startup" />
          <BrandRule aria-hidden />
        </BrandBlock>

        <StatusSection>
          {isConnecting && !connectionError && (
            <ConnectingText>Connecting</ConnectingText>
          )}

          {connectionError && (
            <ErrorText>Playing Offline</ErrorText>
          )}

          {showPressKey && !connectionError && (
            <PressKeyText>
              {steamDeckMode
                ? "Press any button to continue"
                : "Press any key to continue"}
            </PressKeyText>
          )}
        </StatusSection>
      </Content>
    </ScreenContainer>
  );
};

StartupScreen.propTypes = {
  onContinue: PropTypes.func.isRequired,
  connectionError: PropTypes.bool,
  steamDeckMode: PropTypes.bool,
};

export default StartupScreen;
