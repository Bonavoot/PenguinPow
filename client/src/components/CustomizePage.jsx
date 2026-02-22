/**
 * CustomizePage - Full-page character customization screen
 * 
 * Accessible from the main menu "Customize" button.
 * Shows a large penguin preview with standard and special color options.
 * Matches the game's sumo/snow aesthetic with backgrounds, snowfall, and wood/gold UI.
 * Color selection persists in PlayerColorContext for the session.
 */

import React, { useState, useEffect, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
  RAINBOW_COLOR,
  FIRE_COLOR,
  VAPORWAVE_COLOR,
  CAMO_COLOR,
  GALAXY_COLOR,
  GOLD_COLOR,
} from "../utils/SpriteRecolorizer";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall, { SnowCap, IcicleRow, Icicle } from "./Snowfall";

import pumo from "../assets/pumo.png";
import mainMenuBackground from "../assets/main-menu-bkg-3.png";

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const slideUp = keyframes`
  0% { opacity: 0; transform: translateY(25px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const titleGlow = keyframes`
  0%, 100% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 20px rgba(212, 175, 55, 0.4),
      0 0 40px rgba(212, 175, 55, 0.2);
  }
  50% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 30px rgba(212, 175, 55, 0.6),
      0 0 60px rgba(212, 175, 55, 0.3);
  }
`;

const gentleBob = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

// ============================================
// PAGE LAYOUT
// ============================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: "Bungee", cursive;
`;

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
`;

const DarkOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%),
    linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 100%);
  z-index: 1;
  pointer-events: none;
`;

const ContentWrapper = styled.div`
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: clamp(16px, 2.5vh, 28px) clamp(20px, 3vw, 40px);
`;

// ============================================
// BACK BUTTON
// ============================================

const BackButton = styled.button`
  position: absolute;
  top: clamp(14px, 2vh, 22px);
  left: clamp(20px, 3vw, 48px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.9vw, 0.75rem);
  color: #d4af37;
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border: 2px solid #8b7355;
  border-radius: clamp(4px, 0.7vw, 8px);
  padding: clamp(8px, 1vh, 12px) clamp(16px, 2vw, 24px);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  transition: all 0.25s ease;
  z-index: 20;
  animation: ${fadeIn} 0.3s ease-out;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -2px 4px rgba(0,0,0,0.3);
  text-shadow: 2px 2px 0 #000;

  /* Wood grain texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent 0px,
      rgba(255,255,255,0.02) 1px,
      transparent 3px
    );
    border-radius: clamp(4px, 0.7vw, 8px);
    pointer-events: none;
  }

  &:hover {
    background: linear-gradient(180deg, #5c4530 0%, #4a3525 50%, #3d2817 100%);
    border-color: #d4af37;
    transform: translateX(-3px);
    box-shadow: 
      0 6px 18px rgba(0,0,0,0.5),
      0 0 20px rgba(212, 175, 55, 0.2),
      inset 0 1px 0 rgba(255,255,255,0.12);
    color: #f0d080;
  }

  &:active {
    transform: translateX(-1px);
  }
`;

// ============================================
// TITLE
// ============================================

const PageTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.3rem, 2.8vw, 2.2rem);
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  animation: ${titleGlow} 3s ease-in-out infinite;
  margin: clamp(4px, 1vh, 12px) 0 clamp(8px, 1.5vh, 16px) 0;
`;

const Subtitle = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.45rem, 0.8vw, 0.65rem);
  color: #e8dcc8;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
  opacity: 0.7;
  margin-bottom: clamp(12px, 2vh, 24px);
  animation: ${fadeIn} 0.5s ease-out;
`;

// ============================================
// MAIN CONTENT AREA
// ============================================

const ContentLayout = styled.div`
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: clamp(20px, 3vw, 50px);
  flex: 1;
  max-height: calc(100vh - 160px);
  animation: ${slideUp} 0.5s ease-out;
`;

// ============================================
// PREVIEW PANEL (left) — framed in a wooden banner
// ============================================

const PreviewPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PreviewBanner = styled.div`
  position: relative;
`;

const PreviewHangingBar = styled.div`
  width: 105%;
  height: clamp(12px, 1.8vh, 18px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 5px 5px 0 0;
  margin-left: -2.5%;
  position: relative;
  border: 2px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);

  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -7px;
    width: clamp(8px, 1.2vw, 14px);
    height: clamp(8px, 1.2vw, 14px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

const PreviewBody = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid #8b7355;
  border-top: none;
  border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  padding: clamp(16px, 2.5vh, 28px) clamp(20px, 3vw, 36px);
  box-shadow: 
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.5),
    inset 0 2px 0 rgba(139, 115, 85, 0.1);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;

  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(0deg, transparent 0px, rgba(255,255,255,0.015) 1px, transparent 2px),
      repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.01) 1px, transparent 2px);
    pointer-events: none;
    border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  }

  /* Gold inner border */
  &::after {
    content: "";
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
    border: 1px solid rgba(212, 175, 55, 0.12);
    border-radius: clamp(4px, 0.8vw, 10px);
    pointer-events: none;
  }
`;

const PreviewImageContainer = styled.div`
  width: clamp(200px, 24vw, 320px);
  height: clamp(200px, 24vw, 320px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  animation: ${gentleBob} 3s ease-in-out infinite;
  filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
`;

const SelectedColorLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1vw, 0.85rem);
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-shadow: 2px 2px 0 #000;
  margin-top: clamp(8px, 1.5vh, 16px);
  text-align: center;
  position: relative;
  z-index: 1;
`;

const SelectedColorSubtitle = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.4rem, 0.7vw, 0.55rem);
  color: #8b7355;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
  margin-top: 2px;
  position: relative;
  z-index: 1;
`;

// ============================================
// COLORS PANEL (right) — also in a wooden frame
// ============================================

const ColorsPanel = styled.div`
  display: flex;
  flex-direction: column;
`;

const ColorsBanner = styled.div`
  position: relative;
`;

const ColorsHangingBar = styled(PreviewHangingBar)``;

const ColorsBody = styled(PreviewBody)`
  padding: clamp(14px, 2vh, 22px) clamp(16px, 2.5vw, 28px);
  gap: clamp(14px, 2vh, 22px);
`;

const SectionDivider = styled.div`
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.25) 20%, rgba(212, 175, 55, 0.25) 80%, transparent 100%);
  position: relative;
  z-index: 1;

  &::before {
    content: "◆";
    position: absolute;
    top: -7px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 8px;
    color: rgba(212, 175, 55, 0.4);
  }
`;

const ColorCategory = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1vh, 10px);
  position: relative;
  z-index: 1;
`;

const CategoryTitle = styled.h3`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.85vw, 0.7rem);
  color: ${props => props.$special ? '#e8d4f0' : '#d4af37'};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: 0;
  text-shadow: 1px 1px 0 #000;
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: clamp(5px, 0.6vw, 8px);
`;

const ColorSwatch = styled.button`
  width: clamp(30px, 3.2vw, 44px);
  height: clamp(30px, 3.2vw, 44px);
  border-radius: 6px;
  border: 2px solid ${props => props.$selected ? '#d4af37' : 'rgba(139, 115, 85, 0.3)'};
  background: ${props => props.$gradient || props.$color};
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: ${props => props.$selected
    ? '0 0 12px rgba(212, 175, 55, 0.5), 0 0 4px rgba(212, 175, 55, 0.3)'
    : '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'};
  position: relative;

  &:hover {
    transform: scale(1.15);
    border-color: rgba(212, 175, 55, 0.7);
    box-shadow: 0 0 14px rgba(212, 175, 55, 0.3), 0 4px 12px rgba(0,0,0,0.4);
  }

  &:active {
    transform: scale(0.95);
  }

  ${props => props.$selected && css`
    &::after {
      content: "";
      position: absolute;
      top: -5px;
      left: -5px;
      right: -5px;
      bottom: -5px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 9px;
      pointer-events: none;
    }
  `}
`;

const ColorName = styled.div`
  font-family: "Outfit", sans-serif;
  font-size: clamp(0.35rem, 0.55vw, 0.45rem);
  color: #8b7355;
  text-align: center;
  margin-top: 2px;
  letter-spacing: 0.03em;
  opacity: 0;
  transition: opacity 0.15s ease;

  ${ColorSwatch}:hover + & {
    opacity: 1;
  }
`;

// ============================================
// TAB BUTTONS
// ============================================

const TabRow = styled.div`
  display: flex;
  gap: clamp(4px, 0.5vw, 8px);
  width: 100%;
  position: relative;
  z-index: 1;
`;

const Tab = styled.button`
  flex: 1;
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.7vw, 0.6rem);
  padding: clamp(5px, 0.7vh, 8px) 0;
  border: 2px solid ${props => props.$active ? '#d4af37' : '#5c4033'};
  border-radius: clamp(4px, 0.5vw, 6px);
  background: ${props => props.$active
    ? 'linear-gradient(180deg, #4a3525 0%, #3d2817 100%)'
    : 'rgba(26, 10, 8, 0.6)'};
  color: ${props => props.$active ? '#d4af37' : '#777'};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-shadow: 1px 1px 0 #000;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${props => props.$active ? '#d4af37' : '#8b7355'};
    color: ${props => props.$active ? '#d4af37' : '#aaa'};
  }
`;

// ============================================
// CSS GRADIENT PREVIEWS FOR SPECIAL COLORS
// ============================================

const SPECIAL_SWATCH_STYLES = {
  [RAINBOW_COLOR]: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  [FIRE_COLOR]: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  [VAPORWAVE_COLOR]: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  [CAMO_COLOR]: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  [GALAXY_COLOR]: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  [GOLD_COLOR]: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
};

// ============================================
// COLOR OPTIONS DATA
// ============================================

const STANDARD_COLORS = [
  { name: "Default", hex: SPRITE_BASE_COLOR },
  { name: "Graphite", hex: COLOR_PRESETS.graphite },
  { name: "Cobalt", hex: COLOR_PRESETS.cobalt },
  { name: "Orchid", hex: COLOR_PRESETS.orchid },
  { name: "Emerald", hex: COLOR_PRESETS.emerald },
  { name: "Teal", hex: COLOR_PRESETS.teal },
  { name: "Tangerine", hex: COLOR_PRESETS.tangerine },
  { name: "Coral", hex: COLOR_PRESETS.coral },
  { name: "Gold", hex: COLOR_PRESETS.gold },
  { name: "Caramel", hex: COLOR_PRESETS.caramel },
  { name: "Pewter", hex: COLOR_PRESETS.pewter },
  { name: "Powder", hex: COLOR_PRESETS.powder },
  { name: "Scarlet", hex: COLOR_PRESETS.scarlet },
];

const SPECIAL_COLOR_OPTIONS = [
  { name: "Rainbow", hex: RAINBOW_COLOR },
  { name: "Fire", hex: FIRE_COLOR },
  { name: "Vaporwave", hex: VAPORWAVE_COLOR },
  { name: "Camo", hex: CAMO_COLOR },
  { name: "Galaxy", hex: GALAXY_COLOR },
  { name: "Shiny Gold", hex: GOLD_COLOR },
];

const BODY_COLOR_OPTIONS = [
  { name: "Default", hex: null },
  { name: "Black", hex: "#4d4d4d" },
  { name: "Blue", hex: "#2656A8" },
  { name: "Purple", hex: "#9932CC" },
  { name: "Green", hex: "#32CD32" },
  { name: "Aqua", hex: "#17A8A0" },
  { name: "Orange", hex: "#E27020" },
  { name: "Pink", hex: "#FFB6C1" },
  { name: "Yellow", hex: "#F5C422" },
  { name: "Brown", hex: "#8B5E3C" },
  { name: "Silver", hex: "#A8A8A8" },
  { name: "Light Blue", hex: "#6ABED0" },
  { name: "Red", hex: "#CC3333" },
];

// ============================================
// COMPONENT
// ============================================

function CustomizePage({ onBack }) {
  const { player1Color, setPlayer1Color, player1BodyColor, setPlayer1BodyColor } = usePlayerColors();
  const [previewSrc, setPreviewSrc] = useState(pumo);
  const [isLoading, setIsLoading] = useState(false);
  const [customizeTab, setCustomizeTab] = useState("mawashi");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Update preview when mawashi or body color changes — show both combined
  useEffect(() => {
    const needsMawashi = player1Color && player1Color !== SPRITE_BASE_COLOR;
    const needsBody = !!player1BodyColor;

    if (!needsMawashi && !needsBody) {
      setPreviewSrc(pumo);
      return;
    }

    setIsLoading(true);
    const bodyOpts = needsBody ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player1BodyColor } : {};
    recolorImage(pumo, BLUE_COLOR_RANGES, player1Color || SPRITE_BASE_COLOR, bodyOpts)
      .then((recolored) => {
        if (mountedRef.current) setPreviewSrc(recolored);
      })
      .catch(() => {
        if (mountedRef.current) setPreviewSrc(pumo);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [player1Color, player1BodyColor]);

  const handleColorSelect = (hex) => {
    playButtonPressSound2();
    setPlayer1Color(hex);
  };

  const handleBodyColorSelect = (hex) => {
    playButtonPressSound2();
    setPlayer1BodyColor(hex);
  };

  // Find the name of the currently selected colors
  const allColors = [...STANDARD_COLORS, ...SPECIAL_COLOR_OPTIONS];
  const selectedName = allColors.find(c => c.hex === player1Color)?.name || "Default Blue";
  const selectedBodyName = BODY_COLOR_OPTIONS.find(c => c.hex === player1BodyColor)?.name || "Default";

  return (
    <PageContainer>
      <BackgroundImage src={mainMenuBackground} alt="" />
      <DarkOverlay />
      <Snowfall intensity={15} showFrost={true} zIndex={2} />

      <ContentWrapper>
        <BackButton
          onClick={() => { playButtonPressSound2(); onBack(); }}
          onMouseEnter={playButtonHoverSound}
        >
          Back
        </BackButton>

        <PageTitle>Customize</PageTitle>
        <Subtitle>{customizeTab === "mawashi" ? "Mawashi & Headband" : "Body Color"}</Subtitle>

        <ContentLayout>
          {/* Left: Preview in wooden banner */}
          <PreviewPanel>
            <PreviewBanner>
              <PreviewHangingBar>
                <SnowCap />
                <IcicleRow $bottom="-8px">
                  <Icicle $w={2} $h={8} />
                  <Icicle $w={3} $h={11} />
                  <Icicle $w={2} $h={6} />
                  <Icicle $w={3} $h={9} />
                  <Icicle $w={2} $h={7} />
                </IcicleRow>
              </PreviewHangingBar>
              <PreviewBody>
                <PreviewImageContainer>
                  <PreviewImage src={previewSrc} alt="Penguin preview" />
                </PreviewImageContainer>
                <SelectedColorLabel>{customizeTab === "mawashi" ? selectedName : selectedBodyName}</SelectedColorLabel>
                <SelectedColorSubtitle>{customizeTab === "mawashi" ? "Current Mawashi" : "Current Body"}</SelectedColorSubtitle>
              </PreviewBody>
            </PreviewBanner>
          </PreviewPanel>

          {/* Right: Color selections in wooden banner */}
          <ColorsPanel>
            <ColorsBanner>
              <ColorsHangingBar>
                <SnowCap />
                <IcicleRow $bottom="-8px">
                  <Icicle $w={3} $h={7} />
                  <Icicle $w={2} $h={10} />
                  <Icicle $w={3} $h={6} />
                  <Icicle $w={2} $h={12} />
                  <Icicle $w={3} $h={8} />
                  <Icicle $w={2} $h={6} />
                </IcicleRow>
              </ColorsHangingBar>
              <ColorsBody>
                <TabRow>
                  <Tab
                    $active={customizeTab === "mawashi"}
                    onClick={() => { playButtonPressSound2(); setCustomizeTab("mawashi"); }}
                    onMouseEnter={playButtonHoverSound}
                  >
                    Mawashi
                  </Tab>
                  <Tab
                    $active={customizeTab === "body"}
                    onClick={() => { playButtonPressSound2(); setCustomizeTab("body"); }}
                    onMouseEnter={playButtonHoverSound}
                  >
                    Body
                  </Tab>
                </TabRow>

                {customizeTab === "mawashi" ? (
                  <>
                    <ColorCategory>
                      <CategoryTitle>Mawashi Colors</CategoryTitle>
                      <ColorGrid>
                        {STANDARD_COLORS.map((color) => (
                          <ColorSwatch
                            key={color.name}
                            $color={color.hex}
                            $selected={player1Color === color.hex}
                            onClick={() => handleColorSelect(color.hex)}
                            onMouseEnter={playButtonHoverSound}
                            title={color.name}
                          />
                        ))}
                      </ColorGrid>
                    </ColorCategory>

                    <SectionDivider />

                    <ColorCategory>
                      <CategoryTitle $special>Special Patterns</CategoryTitle>
                      <ColorGrid>
                        {SPECIAL_COLOR_OPTIONS.map((color) => (
                          <ColorSwatch
                            key={color.name}
                            $gradient={SPECIAL_SWATCH_STYLES[color.hex]}
                            $selected={player1Color === color.hex}
                            onClick={() => handleColorSelect(color.hex)}
                            onMouseEnter={playButtonHoverSound}
                            title={color.name}
                          />
                        ))}
                      </ColorGrid>
                    </ColorCategory>
                  </>
                ) : (
                  <ColorCategory>
                    <CategoryTitle>Body Colors</CategoryTitle>
                    <ColorGrid>
                      {BODY_COLOR_OPTIONS.map((color) => (
                        <ColorSwatch
                          key={color.name}
                          $color={color.hex || "#888"}
                          $selected={player1BodyColor === color.hex}
                          onClick={() => handleBodyColorSelect(color.hex)}
                          onMouseEnter={playButtonHoverSound}
                          title={color.name}
                        />
                      ))}
                    </ColorGrid>
                  </ColorCategory>
                )}
              </ColorsBody>
            </ColorsBanner>
          </ColorsPanel>
        </ContentLayout>
      </ContentWrapper>
    </PageContainer>
  );
}

export default CustomizePage;
