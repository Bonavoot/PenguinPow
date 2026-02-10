import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Import penguin sprites
import pumo from "../assets/pumo.png";
import { SPRITE_BASE_COLOR, recolorImage, BLUE_COLOR_RANGES } from "../utils/SpriteRecolorizer";

// ============================================
// ANIMATIONS
// ============================================
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideInLeft = keyframes`
  from { transform: translateX(-80px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideInRight = keyframes`
  from { transform: translateX(80px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

// ============================================
// STYLED COMPONENTS
// ============================================
const ScreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: ${fadeIn} 0.3s ease-out;
  overflow: hidden;
`;

// Transparent overlay to let the actual game scene show through
const BlurredBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
`;

// Dark overlay - semi-transparent to see game scene behind
const DarkOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
`;

// Main match card - 90% width, 80% height with cloud pattern background
const MatchCard = styled.div`
  position: relative;
  display: flex;
  width: 90%;
  height: 80%;
  background: transparent;
  border: 4px solid #8b5a2b;
  box-shadow: 
    0 0 0 2px #d4af37,
    0 0 0 6px #8b5a2b,
    0 0 0 8px #d4af37,
    0 15px 60px rgba(0, 0, 0, 0.6);
  animation: ${fadeIn} 0.5s ease-out 0.2s both;
  overflow: visible;
  
  /* Cloud pattern overlay */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(ellipse 80px 40px at 10% 15%, rgba(255, 255, 255, 0.25) 0%, transparent 70%),
      radial-gradient(ellipse 60px 30px at 5% 25%, rgba(255, 255, 255, 0.2) 0%, transparent 70%),
      radial-gradient(ellipse 70px 35px at 90% 15%, rgba(255, 255, 255, 0.25) 0%, transparent 70%),
      radial-gradient(ellipse 50px 25px at 95% 25%, rgba(255, 255, 255, 0.2) 0%, transparent 70%),
      radial-gradient(ellipse 90px 45px at 8% 85%, rgba(255, 255, 255, 0.2) 0%, transparent 70%),
      radial-gradient(ellipse 70px 35px at 92% 85%, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
`;

// Decorative corner ornaments
const CornerOrnament = styled.div`
  position: absolute;
  width: 60px;
  height: 60px;
  z-index: 10;
  opacity: 0.7;
  
  ${props => props.$position === 'top-left' && `
    top: 8px;
    left: 8px;
    border-top: 3px solid #8b5a2b;
    border-left: 3px solid #8b5a2b;
    &::after {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      width: 20px;
      height: 20px;
      border-top: 2px solid #d4af37;
      border-left: 2px solid #d4af37;
    }
  `}
  
  ${props => props.$position === 'top-right' && `
    top: 8px;
    right: 8px;
    border-top: 3px solid #8b5a2b;
    border-right: 3px solid #8b5a2b;
    &::after {
      content: '';
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border-top: 2px solid #d4af37;
      border-right: 2px solid #d4af37;
    }
  `}
  
  ${props => props.$position === 'bottom-left' && `
    bottom: 8px;
    left: 8px;
    border-bottom: 3px solid #8b5a2b;
    border-left: 3px solid #8b5a2b;
    &::after {
      content: '';
      position: absolute;
      bottom: 8px;
      left: 8px;
      width: 20px;
      height: 20px;
      border-bottom: 2px solid #d4af37;
      border-left: 2px solid #d4af37;
    }
  `}
  
  ${props => props.$position === 'bottom-right' && `
    bottom: 8px;
    right: 8px;
    border-bottom: 3px solid #8b5a2b;
    border-right: 3px solid #8b5a2b;
    &::after {
      content: '';
      position: absolute;
      bottom: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border-bottom: 2px solid #d4af37;
      border-right: 2px solid #d4af37;
    }
  `}
`;

// Player panel (left or right)
const PlayerPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
  z-index: 1;
  background: transparent;
  animation: ${props => props.$side === 'left' ? slideInLeft : slideInRight} 0.6s ease-out 0.3s both;
`;

// Rank banner (East/West) - styled like Abema's rank badges
const RankBanner = styled.div`
  position: absolute;
  top: 12px;
  ${props => props.$side === 'left' ? 'left: 12px;' : 'right: 12px;'}
  background: linear-gradient(180deg, #e63946 0%, #c41e3a 50%, #9d1a2d 100%);
  color: white;
  padding: 10px 20px;
  font-size: clamp(14px, 2vw, 20px);
  font-family: "Bungee", cursive;
  letter-spacing: 0.1em;
  border: 2px solid #ffd700;
  border-radius: 4px;
  box-shadow: 
    0 3px 10px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  z-index: 10;
  text-shadow: 
    -2px -2px 0 #000, 
    2px -2px 0 #000, 
    -2px 2px 0 #000, 
    2px 2px 0 #000;
`;

// Rank number badge - smaller secondary badge
const RankNumber = styled.div`
  position: absolute;
  top: 50px;
  ${props => props.$side === 'left' ? 'left: 12px;' : 'right: 12px;'}
  background: linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%);
  color: #ffd700;
  padding: 6px 14px;
  font-size: clamp(11px, 1.4vw, 14px);
  font-family: "Bungee", cursive;
  letter-spacing: 0.05em;
  border: 1px solid #d4af37;
  border-radius: 3px;
  z-index: 10;
  text-shadow: 
    -1px -1px 0 #000, 
    1px -1px 0 #000, 
    -1px 1px 0 #000, 
    1px 1px 0 #000;
`;

// Character display area - takes up most of the panel
const CharacterArea = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding-top: 60px;
  background: linear-gradient(180deg, rgba(248, 244, 235, 0.85) 0%, rgba(232, 224, 208, 0.85) 100%);
  border: 2px solid #8b5a2b;
`;

// Character image container - positioned to extend below info section
const CharacterImageContainer = styled.div`
  position: absolute;
  bottom: -20%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 1;
`;

const CharacterImage = styled.img`
  width: 85%;
  height: auto;
  object-fit: contain;
  transform: ${props => props.$flip ? 'scaleX(1)' : 'scaleX(-1)'};
  filter: drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.4));
  opacity: ${props => props.$ready ? 1 : 0};
  transition: opacity 0.25s ease-out;
`;

// Horizontal gap between player image and info section
const HorizontalDivider = styled.div`
  width: 100%;
  height: 12px;
  background: linear-gradient(180deg, rgba(248, 244, 235, 0.6) 0%, rgba(232, 224, 208, 0.6) 100%);
`;

// Info section at bottom of player panel - styled like Abema
const PlayerInfoSection = styled.div`
  background: linear-gradient(180deg, #f8f4eb 0%, #e8e0d0 100%);
  padding: 20px 15px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 5;
  border: 2px solid #8b5a2b;
`;

// Player name area - larger and more prominent
const PlayerNameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
  width: 100%;
`;

// Stable name - displayed above player name like in sumo broadcasts
const StableName = styled.div`
  font-size: clamp(10px, 1.3vw, 14px);
  color: #6b4423;
  letter-spacing: 0.15em;
  margin-bottom: 4px;
  font-family: "Bungee", cursive;
  text-transform: uppercase;
`;

const PlayerName = styled.div`
  font-size: clamp(22px, 3.5vw, 36px);
  font-family: "Bungee", cursive;
  color: #1a1a1a;
  text-shadow: 
    -2px -2px 0 #fff, 
    2px -2px 0 #fff, 
    -2px 2px 0 #fff, 
    2px 2px 0 #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
  line-height: 1.1;
`;

// Special mawashi colors (same gradients as Lobby color picker squares)
const SPECIAL_MAWASHI_GRADIENTS = {
  rainbow: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  fire: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  vaporwave: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  camo: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  galaxy: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  gold: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
};

// Mawashi color indicator - styled like a belt (supports solid hex and special gradients like Lobby swatches)
const MawashiIndicator = styled.div`
  width: 70%;
  height: 10px;
  background: ${props => props.$gradient || props.$color || '#888'};
  margin: 10px 0 14px;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.3),
    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.3);
  position: relative;
  
  /* Belt knot detail */
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 16px;
    background: ${props => props.$gradient || props.$color || '#888'};
    border: 2px solid rgba(0, 0, 0, 0.3);
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
`;

// Record display - styled like Abema with larger numbers
const RecordContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const RecordItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 2px;
`;

const RecordNum = styled.span`
  font-size: clamp(26px, 4vw, 42px);
  font-family: "Bungee", cursive;
  color: #1a1a1a;
  line-height: 1;
  text-shadow: 
    -2px -2px 0 #fff, 
    2px -2px 0 #fff, 
    -2px 2px 0 #fff, 
    2px 2px 0 #fff;
`;

const RecordLabel = styled.span`
  font-size: clamp(12px, 1.6vw, 18px);
  font-family: "Bungee", cursive;
  color: #c41e3a;
  text-transform: uppercase;
`;

const RecordSeparator = styled.span`
  font-size: clamp(16px, 2vw, 24px);
  font-family: "Bungee", cursive;
  color: #666;
  margin: 0 4px;
`;

// Additional info row (like Birthplace in Abema)
const InfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
`;

const InfoValue = styled.span`
  font-size: clamp(11px, 1.4vw, 15px);
  color: #444;
  font-family: "Bungee", cursive;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;


// Center divider - styled like Abema's center section
const CenterDivider = styled.div`
  width: clamp(100px, 14vw, 160px);
  background: linear-gradient(180deg, rgba(248, 244, 235, 0.6) 0%, rgba(232, 224, 208, 0.6) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 20px 10px;
  position: relative;
  z-index: 5;
`;

// Top branding area
const BrandingArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const GameLogo = styled.div`
  font-size: clamp(14px, 2vw, 20px);
  font-family: "Bungee", cursive;
  color: #1a1a1a;
  text-shadow: 
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
  letter-spacing: 0.15em;
  text-align: center;
  animation: ${float} 3s ease-in-out infinite;
  
  &:nth-child(2) {
    animation-delay: 0.5s;
  }
`;

const VsText = styled.div`
  font-size: clamp(36px, 6vw, 60px);
  font-family: "Bungee", cursive;
  color: #c41e3a;
  text-shadow: 
    -3px -3px 0 #fff,
    3px -3px 0 #fff,
    -3px 3px 0 #fff,
    3px 3px 0 #fff,
    -3px 0 0 #fff,
    3px 0 0 #fff,
    0 -3px 0 #fff,
    0 3px 0 #fff;
  letter-spacing: 0.1em;
`;

// Bottom area with game title
const BottomArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const GameTitle = styled.div`
  font-size: clamp(12px, 1.5vw, 16px);
  color: #1a1a1a;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-align: center;
  font-family: "Bungee", cursive;
  text-shadow: 
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
`;

const MatchType = styled.div`
  font-size: clamp(10px, 1.2vw, 13px);
  color: #8b5a2b;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: "Bungee", cursive;
  text-shadow: 
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
`;

// Loading indicator - at bottom center of screen
const LoadingContainer = styled.div`
  position: absolute;
  bottom: 2%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 100;
`;

const LoadingBar = styled.div`
  width: 250px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const LoadingProgress = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700, #d4af37);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s linear infinite;
  width: ${props => props.$progress}%;
  transition: width 0.3s ease-out;
`;

const LoadingText = styled.div`
  color: #ffd700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-family: "Bungee", cursive;
  animation: ${pulse} 1.5s ease-in-out infinite;
  text-shadow: 
    -2px -2px 0 #000, 
    2px -2px 0 #000, 
    -2px 2px 0 #000, 
    2px 2px 0 #000;
`;

// Live indicator
const LiveIndicator = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #c41e3a;
  color: white;
  padding: 8px 18px;
  font-size: 14px;
  font-family: "Bungee", cursive;
  letter-spacing: 0.1em;
  border-radius: 4px;
  z-index: 100;
  animation: ${pulse} 2s ease-in-out infinite;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  text-shadow: 
    -2px -2px 0 #000, 
    2px -2px 0 #000, 
    -2px 2px 0 #000, 
    2px 2px 0 #000;
`;

const LiveDot = styled.div`
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
`;

// ============================================
// HELPER DATA
// ============================================
// Fun dojo names for players
const DOJO_NAMES = [
  "Ice Floe Dojo",
  "Blizzard Hall",
  "Glacier Peak",
  "Frostbite Stable",
  "Snowdrift Gym",
  "Penguin Palace",
  "Arctic Thunder",
  "Frozen Tundra",
];

// Fighting styles
const FIGHTING_STYLES = [
  "Pusher",
  "Grappler",
  "Technician",
  "Power",
  "Speed",
  "Balanced",
];

// Function to get consistent random value based on name
const getSeededValue = (name, array) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return array[Math.abs(hash) % array.length];
};

// Calculate rank based on wins
const getRank = (wins, losses) => {
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;
  
  if (wins >= 50 && winRate >= 0.7) return { title: "YOKOZUNA", number: "" };
  if (wins >= 30 && winRate >= 0.6) return { title: "OZEKI", number: "" };
  if (wins >= 20 && winRate >= 0.55) return { title: "SEKIWAKE", number: "" };
  if (wins >= 10) return { title: "KOMUSUBI", number: `#${Math.max(1, 10 - Math.floor(wins / 5))}` };
  if (wins >= 5) return { title: "MAEGASHIRA", number: `#${Math.max(1, 15 - wins)}` };
  if (wins >= 2) return { title: "JONIDAN", number: `#${Math.max(1, 50 - (wins * 10))}` };
  return { title: "JONOKUCHI", number: `#${Math.max(1, 80 - total)}` };
};

// ============================================
// COMPONENT
// ============================================
const PreMatchScreen = ({
  player1Name = "Player 1",
  player2Name = "Player 2",
  player1Color = SPRITE_BASE_COLOR,
  player2Color = "#DC143C",
  player1Record = { wins: 0, losses: 0 },
  player2Record = { wins: 0, losses: 0 },
  loadingProgress = 0,
  isLoading = true,
  isCPUMatch = false,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [player1Sprite, setPlayer1Sprite] = useState(pumo);
  const [player2Sprite, setPlayer2Sprite] = useState(pumo);
  const [spritesReady, setSpritesReady] = useState(false);
  
  // Derive additional info from player names
  const player1Dojo = getSeededValue(player1Name, DOJO_NAMES);
  const player2Dojo = getSeededValue(player2Name, DOJO_NAMES);
  const player1Style = getSeededValue(player1Name + "style", FIGHTING_STYLES);
  const player2Style = getSeededValue(player2Name + "style", FIGHTING_STYLES);
  const player1Rank = getRank(player1Record.wins, player1Record.losses);
  const player2Rank = getRank(player2Record.wins, player2Record.losses);

  // Recolor sprites based on player colors; only reveal images when both are ready (avoids flash of wrong color)
  useEffect(() => {
    let cancelled = false;
    setSpritesReady(false);

    const recolorSprites = async () => {
      const p1Promise =
        player1Color && player1Color !== SPRITE_BASE_COLOR
          ? recolorImage(pumo, BLUE_COLOR_RANGES, player1Color).catch((err) => {
              console.error("Failed to recolor player 1 sprite:", err);
              return pumo;
            })
          : Promise.resolve(pumo);

      const p2Promise =
        player2Color && player2Color !== SPRITE_BASE_COLOR
          ? recolorImage(pumo, BLUE_COLOR_RANGES, player2Color).catch((err) => {
              console.error("Failed to recolor player 2 sprite:", err);
              return pumo;
            })
          : Promise.resolve(pumo);

      const [p1, p2] = await Promise.all([p1Promise, p2Promise]);
      if (cancelled) return;
      setPlayer1Sprite(p1);
      setPlayer2Sprite(p2);
      setSpritesReady(true);
    };

    recolorSprites();
    return () => { cancelled = true; };
  }, [player1Color, player2Color]);

  // Smooth progress animation
  useEffect(() => {
    const target = Math.min(loadingProgress, 100);
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= target) {
          clearInterval(timer);
          return target;
        }
        return prev + 2;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [loadingProgress]);

  return (
    <ScreenContainer>
      <BlurredBackground />
      <DarkOverlay />
      
      <LiveIndicator>
        <LiveDot />
        LIVE
      </LiveIndicator>

      <MatchCard>
        {/* Decorative corner ornaments */}
        <CornerOrnament $position="top-left" />
        <CornerOrnament $position="top-right" />
        <CornerOrnament $position="bottom-left" />
        <CornerOrnament $position="bottom-right" />

        {/* Left Player (East) - facing right */}
        <PlayerPanel $side="left">
          <RankBanner $side="left">{player1Rank.title}</RankBanner>
          {player1Rank.number && <RankNumber $side="left">{player1Rank.number}</RankNumber>}
          
          <CharacterArea>
            <CharacterImageContainer>
              <CharacterImage src={player1Sprite} alt={player1Name} $flip={false} $ready={spritesReady} />
            </CharacterImageContainer>
          </CharacterArea>

          <HorizontalDivider />

          <PlayerInfoSection>
            <PlayerNameArea>
              <StableName>{player1Dojo}</StableName>
              <PlayerName>{player1Name}</PlayerName>
            </PlayerNameArea>
            
            <MawashiIndicator $color={player1Color} $gradient={SPECIAL_MAWASHI_GRADIENTS[player1Color]} />

            <RecordContainer>
              <RecordItem>
                <RecordNum>{player1Record.wins}</RecordNum>
                <RecordLabel>W</RecordLabel>
              </RecordItem>
              <RecordSeparator>-</RecordSeparator>
              <RecordItem>
                <RecordNum>{player1Record.losses}</RecordNum>
                <RecordLabel>L</RecordLabel>
              </RecordItem>
            </RecordContainer>
            
            <InfoRow>
              <InfoValue>{player1Style}</InfoValue>
            </InfoRow>
          </PlayerInfoSection>
        </PlayerPanel>

        {/* Center Divider */}
        <CenterDivider>
          <BrandingArea>
            <GameLogo>PUMO</GameLogo>
            <GameLogo>PUMO</GameLogo>
          </BrandingArea>
          
          <VsText>VS</VsText>
          
          <BottomArea>
            <GameTitle>MATCH</GameTitle>
            <MatchType>{isCPUMatch ? "VS CPU" : "PVP"}</MatchType>
          </BottomArea>
        </CenterDivider>

        {/* Right Player (West) - facing left (flipped) */}
        <PlayerPanel $side="right">
          <RankBanner $side="right">{player2Rank.title}</RankBanner>
          {player2Rank.number && <RankNumber $side="right">{player2Rank.number}</RankNumber>}
          
          <CharacterArea>
            <CharacterImageContainer>
              <CharacterImage src={player2Sprite} alt={player2Name} $flip={true} $ready={spritesReady} />
            </CharacterImageContainer>
          </CharacterArea>

          <HorizontalDivider />

          <PlayerInfoSection>
            <PlayerNameArea>
              <StableName>{player2Dojo}</StableName>
              <PlayerName>{player2Name}</PlayerName>
            </PlayerNameArea>
            
            <MawashiIndicator $color={player2Color} $gradient={SPECIAL_MAWASHI_GRADIENTS[player2Color]} />

            <RecordContainer>
              <RecordItem>
                <RecordNum>{player2Record.wins}</RecordNum>
                <RecordLabel>W</RecordLabel>
              </RecordItem>
              <RecordSeparator>-</RecordSeparator>
              <RecordItem>
                <RecordNum>{player2Record.losses}</RecordNum>
                <RecordLabel>L</RecordLabel>
              </RecordItem>
            </RecordContainer>
            
            <InfoRow>
              <InfoValue>{player2Style}</InfoValue>
            </InfoRow>
          </PlayerInfoSection>
        </PlayerPanel>
      </MatchCard>

      {/* Loading indicator at bottom of screen */}
      {isLoading && (
        <LoadingContainer>
          <LoadingBar>
            <LoadingProgress $progress={displayProgress} />
          </LoadingBar>
          <LoadingText>Preparing Match...</LoadingText>
        </LoadingContainer>
      )}
    </ScreenContainer>
  );
};

PreMatchScreen.propTypes = {
  player1Name: PropTypes.string,
  player2Name: PropTypes.string,
  player1Color: PropTypes.string,
  player2Color: PropTypes.string,
  player1Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  player2Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  loadingProgress: PropTypes.number,
  isLoading: PropTypes.bool,
  isCPUMatch: PropTypes.bool,
};

export default PreMatchScreen;
