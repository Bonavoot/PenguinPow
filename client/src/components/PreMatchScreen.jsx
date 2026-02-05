import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Import penguin sprites
import pumo2 from "../assets/pumo2.png";
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
  background: 
    linear-gradient(180deg, rgba(248, 244, 235, 0.95) 0%, rgba(232, 224, 208, 0.95) 100%);
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
      radial-gradient(ellipse 80px 40px at 10% 15%, rgba(255, 255, 255, 0.4) 0%, transparent 70%),
      radial-gradient(ellipse 60px 30px at 5% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 70%),
      radial-gradient(ellipse 70px 35px at 90% 15%, rgba(255, 255, 255, 0.4) 0%, transparent 70%),
      radial-gradient(ellipse 50px 25px at 95% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 70%),
      radial-gradient(ellipse 90px 45px at 8% 85%, rgba(255, 255, 255, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 70px 35px at 92% 85%, rgba(255, 255, 255, 0.35) 0%, transparent 70%);
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
  font-weight: bold;
  letter-spacing: 2px;
  border: 2px solid #ffd700;
  border-radius: 4px;
  box-shadow: 
    0 3px 10px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  z-index: 10;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

// Rank number badge - smaller secondary badge
const RankNumber = styled.div`
  position: absolute;
  top: 50px;
  ${props => props.$side === 'left' ? 'left: 12px;' : 'right: 12px;'}
  background: linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%);
  color: #d4af37;
  padding: 6px 14px;
  font-size: clamp(11px, 1.4vw, 14px);
  font-weight: bold;
  letter-spacing: 1px;
  border: 1px solid #d4af37;
  border-radius: 3px;
  z-index: 10;
`;

// Character display area - takes up most of the panel
const CharacterArea = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  overflow: visible;
  padding-top: 60px;
`;

// Character image container - positioned to extend below info section
const CharacterImageContainer = styled.div`
  position: absolute;
  bottom: -15%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  overflow: visible;
  z-index: 1;
`;

const CharacterImage = styled.img`
  width: 85%;
  height: auto;
  object-fit: contain;
  transform: ${props => props.$flip ? 'scaleX(1)' : 'scaleX(-1)'};
  filter: drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.4));
`;

// Info section at bottom of player panel - styled like Abema
const PlayerInfoSection = styled.div`
  background: linear-gradient(180deg, #f8f4eb 0%, #e8e0d0 100%);
  padding: 20px 15px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-top: 4px solid #8b5a2b;
  position: relative;
  z-index: 5;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #d4af37;
  }
`;

// Player name area - larger and more prominent
const PlayerNameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
  width: 100%;
`;

const PlayerTitle = styled.div`
  font-size: clamp(9px, 1.1vw, 11px);
  color: #666;
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-bottom: 4px;
  font-weight: 500;
`;

const PlayerName = styled.div`
  font-size: clamp(22px, 3.5vw, 36px);
  font-weight: 900;
  color: #1a1a1a;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
  font-family: 'Arial Black', sans-serif;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
  line-height: 1.1;
`;

// Mawashi color indicator - styled like a belt
const MawashiIndicator = styled.div`
  width: 70%;
  height: 10px;
  background: ${props => props.$color || '#888'};
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
    background: ${props => props.$color || '#888'};
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
  font-weight: 900;
  color: #1a1a1a;
  font-family: 'Arial Black', sans-serif;
  line-height: 1;
`;

const RecordLabel = styled.span`
  font-size: clamp(12px, 1.6vw, 18px);
  font-weight: 700;
  color: #333;
`;

const RecordSeparator = styled.span`
  font-size: clamp(16px, 2vw, 24px);
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
  font-weight: 600;
  letter-spacing: 0.5px;
`;

// Dojo/Stable name - like the Japanese stable names
const DojoName = styled.div`
  position: absolute;
  bottom: 8px;
  ${props => props.$side === 'left' ? 'left: 10px;' : 'right: 10px;'}
  font-size: clamp(9px, 1.1vw, 12px);
  color: #666;
  letter-spacing: 1px;
  font-weight: 500;
`;

// Center divider - styled like Abema's center section
const CenterDivider = styled.div`
  width: clamp(100px, 14vw, 160px);
  background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 50%, #1a1a1a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 20px 10px;
  position: relative;
  z-index: 5;
  border-left: 2px solid #d4af37;
  border-right: 2px solid #d4af37;
`;

// Top branding area
const BrandingArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const GameLogo = styled.div`
  font-size: clamp(14px, 2vw, 20px);
  font-weight: 900;
  color: #d4af37;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-family: 'Arial Black', sans-serif;
  letter-spacing: 2px;
  text-align: center;
  animation: ${float} 3s ease-in-out infinite;
`;

const SubBrand = styled.div`
  font-size: clamp(8px, 1vw, 10px);
  color: #888;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const VsText = styled.div`
  font-size: clamp(36px, 6vw, 60px);
  font-weight: 900;
  color: #d4af37;
  text-shadow: 
    3px 3px 6px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(212, 175, 55, 0.3);
  font-family: 'Arial Black', sans-serif;
`;

// Center info labels container
const CenterInfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
`;

const CenterLabel = styled.div`
  background: linear-gradient(180deg, #c41e3a 0%, #9d1a2d 100%);
  color: white;
  padding: 6px 12px;
  font-size: clamp(9px, 1.2vw, 12px);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  border: 1px solid #d4af37;
  border-radius: 2px;
  width: 85%;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const CenterLabelAlt = styled(CenterLabel)`
  background: linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%);
  border-color: #666;
`;

// Bottom area with game title
const BottomArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const GameTitle = styled.div`
  font-size: clamp(10px, 1.3vw, 14px);
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
  font-weight: bold;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
`;

const MatchType = styled.div`
  font-size: clamp(8px, 1vw, 10px);
  color: #666;
  text-transform: uppercase;
  letter-spacing: 2px;
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
  color: #d4af37;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 3px;
  animation: ${pulse} 1.5s ease-in-out infinite;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
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
  font-weight: bold;
  letter-spacing: 2px;
  border-radius: 4px;
  z-index: 100;
  animation: ${pulse} 2s ease-in-out infinite;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
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
  return { title: "JONIDAN", number: `#${Math.max(1, 20 - total)}` };
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
  const [player1Sprite, setPlayer1Sprite] = useState(pumo2);
  const [player2Sprite, setPlayer2Sprite] = useState(pumo2);
  
  // Derive additional info from player names
  const player1Dojo = getSeededValue(player1Name, DOJO_NAMES);
  const player2Dojo = getSeededValue(player2Name, DOJO_NAMES);
  const player1Style = getSeededValue(player1Name + "style", FIGHTING_STYLES);
  const player2Style = getSeededValue(player2Name + "style", FIGHTING_STYLES);
  const player1Rank = getRank(player1Record.wins, player1Record.losses);
  const player2Rank = getRank(player2Record.wins, player2Record.losses);

  // Recolor sprites based on player colors
  useEffect(() => {
    const recolorSprites = async () => {
      // Player 1 sprite - recolor if not base color (blue)
      if (player1Color && player1Color !== SPRITE_BASE_COLOR) {
        try {
          const recolored = await recolorImage(pumo2, BLUE_COLOR_RANGES, player1Color);
          setPlayer1Sprite(recolored);
        } catch (err) {
          console.error("Failed to recolor player 1 sprite:", err);
          setPlayer1Sprite(pumo2);
        }
      } else {
        setPlayer1Sprite(pumo2);
      }
      
      // Player 2 sprite - always recolor (default is red, sprites are blue)
      if (player2Color && player2Color !== SPRITE_BASE_COLOR) {
        try {
          const recolored = await recolorImage(pumo2, BLUE_COLOR_RANGES, player2Color);
          setPlayer2Sprite(recolored);
        } catch (err) {
          console.error("Failed to recolor player 2 sprite:", err);
          setPlayer2Sprite(pumo2);
        }
      } else {
        setPlayer2Sprite(pumo2);
      }
    };
    
    recolorSprites();
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
              <CharacterImage src={player1Sprite} alt={player1Name} $flip={false} />
            </CharacterImageContainer>
          </CharacterArea>

          <PlayerInfoSection>
            <DojoName $side="left">{player1Dojo}</DojoName>
            
            <PlayerNameArea>
              <PlayerTitle>Fighter</PlayerTitle>
              <PlayerName>{player1Name}</PlayerName>
            </PlayerNameArea>
            
            <MawashiIndicator $color={player1Color} />

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
            <SubBrand>PENGUIN POW</SubBrand>
          </BrandingArea>
          
          <VsText>VS</VsText>
          
          <CenterInfoContainer>
            <CenterLabel>RECORD</CenterLabel>
            <CenterLabelAlt>STYLE</CenterLabelAlt>
          </CenterInfoContainer>
          
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
              <CharacterImage src={player2Sprite} alt={player2Name} $flip={true} />
            </CharacterImageContainer>
          </CharacterArea>

          <PlayerInfoSection>
            <DojoName $side="right">{player2Dojo}</DojoName>
            
            <PlayerNameArea>
              <PlayerTitle>{isCPUMatch ? "CPU" : "Fighter"}</PlayerTitle>
              <PlayerName>{player2Name}</PlayerName>
            </PlayerNameArea>
            
            <MawashiIndicator $color={player2Color} />

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
