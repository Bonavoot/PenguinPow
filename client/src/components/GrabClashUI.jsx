import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

// Subtle tension animation
const tensionPulse = keyframes`
  0%, 100% {
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.01);
  }
`;

// Indicator glow pulse
const indicatorPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }
  50% {
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
  }
`;

// Winner flash
const winnerFlash = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
`;

// Title entrance
const titleEnter = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Mash text pulse animation
const mashPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
`;

const GrabClashContainer = styled.div`
  position: absolute;
  left: ${props => props.$x ? `${(props.$x / 1280) * 100}%` : '50%'};
  /* ADJUST THE +18 VALUE to move UI up/down (higher number = higher on screen) */
  bottom: ${props => props.$y ? `${(props.$y / 720) * 100 + 30}%` : '50%'};
  transform: translate(-50%, -50%);
  z-index: 1000;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  gap: 6px;
  animation: ${tensionPulse} 0.3s infinite ease-in-out;
`;

// Header container for title and instruction
const ClashHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  animation: ${titleEnter} 0.2s ease-out;
`;

// Clean, bold title with Japanese-inspired styling
const ClashTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.75rem, 1.8cqw, 1.1rem);
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.15em;
`;

// Mash instruction - prominent and animated
const MashInstruction = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.8cqw, 1.8rem);
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 8px 24px;
  background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
  border: 2px solid #d4af37;
  border-bottom: 3px solid #b8960c;
  position: relative;
  animation: ${mashPulse} 0.25s infinite ease-in-out;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
  }
`;

const ClashMeterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
`;

// Player side indicators - clean triangular markers
const PlayerMarker = styled.div`
  width: 0;
  height: 0;
  border-top: 12px solid transparent;
  border-bottom: 12px solid transparent;
  ${props => props.$side === 'left' 
    ? 'border-left: 14px solid;' 
    : 'border-right: 14px solid;'}
  border-${props => props.$side}-color: ${props => {
    // Determine color based on which player is on which side
    const isPlayer1Side = (props.$side === 'left' && !props.$isPlayer1OnLeft) || 
                          (props.$side === 'right' && props.$isPlayer1OnLeft);
    return isPlayer1Side ? '#00BFFF' : '#FF6B6B'; /* Cyan for P1, Red for P2 */
  }};
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
  transition: all 0.2s ease;
  
  ${props => props.$isWinner && css`
    border-${props.$side}-color: ${props.$isLocalPlayerWinner 
      ? '#00ff00' /* Bright green for local player win */
      : '#ff0000' /* Red for opponent win */
    };
    filter: drop-shadow(0 0 8px ${props.$isLocalPlayerWinner 
      ? 'rgba(0, 255, 0, 0.8)' 
      : 'rgba(255, 0, 0, 0.8)'
    });
    animation: ${winnerFlash} 0.15s infinite;
  `}
  
  ${props => props.$isLoser && css`
    opacity: 0.3;
  `}
`;

// Main meter frame with traditional-inspired styling
const ClashMeterFrame = styled.div`
  width: clamp(240px, 32cqw, 380px);
  height: 32px;
  background: #0d0d0d;
  border: 3px solid #3a3a3a;
  border-top-color: #4a4a4a;
  border-bottom-color: #2a2a2a;
  position: relative;
  overflow: hidden;
  
  /* Inner shadow for depth */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    z-index: 3;
  }
  
  /* Gold accent line at top */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%);
    z-index: 4;
  }
`;

const PlayerFill = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${props => props.$side === 'left' ? 'left: 2px;' : 'right: 2px;'}
  /* Always stay at 50% width */
  width: calc(50% - 2px);
  background: ${props => {
    // Determine color based on which player is on which side
    const isPlayer1Side = (props.$side === 'left' && !props.$isPlayer1OnLeft) || 
                          (props.$side === 'right' && props.$isPlayer1OnLeft);
    return isPlayer1Side
      ? 'linear-gradient(180deg, #00BFFF 0%, #0099CC 50%, #007799 100%)' /* Cyan for Player 1 */
      : 'linear-gradient(180deg, #FF6B6B 0%, #EE5555 50%, #CC4444 100%)'; /* Red for Player 2 */
  }};
  ${props => props.$side === 'left' 
    ? 'border-radius: 2px 0 0 2px;' 
    : 'border-radius: 0 2px 2px 0;'}
  
  /* Highlight stripe */
  &::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 4px;
    right: 4px;
    height: 6px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.25) 0%, transparent 100%);
    border-radius: 2px;
  }
  
  ${props => props.$isWinner && css`
    background: ${props.$isLocalPlayerWinner 
      ? 'linear-gradient(180deg, #00ff00 0%, #00dd00 50%, #00bb00 100%)' /* Bright green for local player win */
      : 'linear-gradient(180deg, #ff0000 0%, #dd0000 50%, #bb0000 100%)' /* Red for opponent win */
    };
  `}
  
  ${props => props.$isLoser && css`
    opacity: 0.35;
  `}
`;

// Center divider line
const CenterDivider = styled.div`
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 2px;
  height: 100%;
  background: #555;
  z-index: 2;
  
  &::before, &::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 2px;
    background: #666;
  }
  
  &::before { top: 0; }
  &::after { bottom: 0; }
`;

// Position indicator - clean vertical bar
const PositionIndicator = styled.div`
  position: absolute;
  top: -4px;
  left: ${props => props.$position}%;
  transform: translateX(-50%);
  width: 6px;
  height: calc(100% + 8px);
  background: linear-gradient(180deg, #fff 0%, #e0e0e0 50%, #fff 100%);
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  transition: left 0.08s ease-out;
  z-index: 10;
  animation: ${indicatorPulse} 0.4s infinite ease-in-out;
`;

// Stats row below meter
const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: clamp(240px, 32cqw, 380px);
  padding: 0 4px;
`;

const InputDisplay = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.4cqw, 1.1rem);
  color: ${props => {
    // Determine color based on which player is on which side
    const isPlayer1Side = (props.$side === 'left' && !props.$isPlayer1OnLeft) || 
                          (props.$side === 'right' && props.$isPlayer1OnLeft);
    return isPlayer1Side ? '#00BFFF' : '#FF6B6B'; /* Cyan for P1, Red for P2 */
  }};
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  min-width: 40px;
  text-align: ${props => props.$side === 'left' ? 'left' : 'right'};
  transition: all 0.15s ease;
  
  ${props => props.$isWinner && css`
    color: ${props.$isLocalPlayerWinner 
      ? '#00ff00' /* Bright green for local player win */
      : '#ff0000' /* Red for opponent win */
    };
    text-shadow: 0 0 8px ${props.$isLocalPlayerWinner 
      ? 'rgba(0, 255, 0, 0.6)' 
      : 'rgba(255, 0, 0, 0.6)'
    }, 1px 1px 2px rgba(0, 0, 0, 0.8);
  `}
`;

// Compact timer bar
const TimerContainer = styled.div`
  width: clamp(240px, 32cqw, 380px);
  height: 4px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 2px;
  overflow: hidden;
`;

const TimerProgress = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background: ${props => props.$percent > 30 
    ? 'linear-gradient(90deg, #d4af37, #f4d03f)' 
    : 'linear-gradient(90deg, #d94a4a, #ff6b6b)'};
  transition: width 0.05s linear;
`;

const GrabClashUI = ({ socket, player1, player2, localId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [player1Inputs, setPlayer1Inputs] = useState(0);
  const [player2Inputs, setPlayer2Inputs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2000);
  const [duration, setDuration] = useState(2000);
  const [player1Id, setPlayer1Id] = useState(null);
  const [player2Id, setPlayer2Id] = useState(null);
  const [leftPlayerId, setLeftPlayerId] = useState(null);
  const [rightPlayerId, setRightPlayerId] = useState(null);
  const [winnerSide, setWinnerSide] = useState(null);
  const [winnerId, setWinnerId] = useState(null);
  const [uiPosition, setUiPosition] = useState({ x: null, y: null });
  const [isPlayer1OnLeft, setIsPlayer1OnLeft] = useState(true); // Track if player1 is on left side
  const spatialLayoutRef = useRef({ leftPlayerId: null, rightPlayerId: null });
  const clashTimerRef = useRef(null);
  const clashEndTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleGrabClashStart = (data) => {
      setIsVisible(true);
      setPlayer1Inputs(0);
      setPlayer2Inputs(0);
      setTimeLeft(data.duration);
      setDuration(data.duration);
      setPlayer1Id(data.player1Id);
      setPlayer2Id(data.player2Id);
      setWinnerSide(null);
      
      const player1Pos = data.player1Position;
      const player2Pos = data.player2Position;
      
      // ===== ADJUST THESE VALUES TO POSITION THE CLASH UI =====
      // Horizontal offset when Player 1 is on the LEFT side
      // (positive = right toward player2, negative = left away from player2)
      const X_OFFSET_PLAYER1_LEFT = 165;
      
      // Horizontal offset when Player 1 is on the RIGHT side
      // (positive = right away from player2, negative = left toward player2)
      const X_OFFSET_PLAYER1_RIGHT = 35;
      
      // Vertical offset from player1 (positive = up, negative = down)
      // Typical value: 0 for same height as players
      const Y_OFFSET = 0;
      // ========================================================
      
      // Determine which offset to use based on player positions
      const player1IsOnLeft = player1Pos.x < player2Pos.x;
      const xOffset = player1IsOnLeft ? X_OFFSET_PLAYER1_LEFT : X_OFFSET_PLAYER1_RIGHT;
      
      // Position UI relative to player1
      const uiX = player1Pos.x + xOffset;
      const uiY = player1Pos.y + Y_OFFSET;
      
      // Store the game coordinates directly (like RawParryEffect does)
      setUiPosition({
        x: uiX,
        y: uiY
      });
      
      let newLeftPlayerId, newRightPlayerId;
      if (player1Pos.x < player2Pos.x) {
        newLeftPlayerId = data.player1Id;
        newRightPlayerId = data.player2Id;
        setIsPlayer1OnLeft(true); // Player 1 is on the left side
      } else {
        newLeftPlayerId = data.player2Id;
        newRightPlayerId = data.player1Id;
        setIsPlayer1OnLeft(false); // Player 1 is on the right side
      }
      
      setLeftPlayerId(newLeftPlayerId);
      setRightPlayerId(newRightPlayerId);
      
      spatialLayoutRef.current = {
        leftPlayerId: newLeftPlayerId,
        rightPlayerId: newRightPlayerId
      };
      
      if (clashTimerRef.current) clearInterval(clashTimerRef.current);
      const startTime = Date.now();
      clashTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, data.duration - elapsed);
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          clearInterval(clashTimerRef.current);
          clashTimerRef.current = null;
        }
      }, 50);
    };

    const handleGrabClashProgress = (data) => {
      setPlayer1Inputs(data.player1Inputs);
      setPlayer2Inputs(data.player2Inputs);
    };

    const handleGrabClashEnd = (data) => {
      const refLeftPlayerId = spatialLayoutRef.current.leftPlayerId;
      const winnerIsLeft = data.winnerId === refLeftPlayerId;
      const winnerSideValue = winnerIsLeft ? 'left' : 'right';
      
      setWinnerSide(winnerSideValue);
      setWinnerId(data.winnerId);
      
      if (clashEndTimeoutRef.current) clearTimeout(clashEndTimeoutRef.current);
      clashEndTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setPlayer1Inputs(0);
        setPlayer2Inputs(0);
        setTimeLeft(2000);
        setPlayer1Id(null);
        setPlayer2Id(null);
        setLeftPlayerId(null);
        setRightPlayerId(null);
        setWinnerSide(null);
        setWinnerId(null);
        setUiPosition({ x: null, y: null });
        setIsPlayer1OnLeft(true);
        spatialLayoutRef.current = { leftPlayerId: null, rightPlayerId: null };
      }, 600);
    };

    const handleGrabClashCancelled = () => {
      setIsVisible(false);
      setPlayer1Inputs(0);
      setPlayer2Inputs(0);
      setTimeLeft(2000);
      setPlayer1Id(null);
      setPlayer2Id(null);
      setLeftPlayerId(null);
      setRightPlayerId(null);
      setWinnerSide(null);
      setWinnerId(null);
      setUiPosition({ x: null, y: null });
      setIsPlayer1OnLeft(true);
      spatialLayoutRef.current = { leftPlayerId: null, rightPlayerId: null };
    };

    socket.on('grab_clash_start', handleGrabClashStart);
    socket.on('grab_clash_progress', handleGrabClashProgress);
    socket.on('grab_clash_end', handleGrabClashEnd);
    socket.on('grab_clash_cancelled', handleGrabClashCancelled);

    return () => {
      socket.off('grab_clash_start', handleGrabClashStart);
      socket.off('grab_clash_progress', handleGrabClashProgress);
      socket.off('grab_clash_end', handleGrabClashEnd);
      socket.off('grab_clash_cancelled', handleGrabClashCancelled);
      if (clashTimerRef.current) clearInterval(clashTimerRef.current);
      if (clashEndTimeoutRef.current) clearTimeout(clashEndTimeoutRef.current);
    };
  }, [socket]);

  // Calculate position for the moving indicator line
  const totalInputs = player1Inputs + player2Inputs;
  let indicatorPosition = 50; // Start at center
  
  if (totalInputs > 0 && leftPlayerId && rightPlayerId) {
    const leftPlayerInputs = leftPlayerId === player1Id ? player1Inputs : player2Inputs;
    const rightPlayerInputs = rightPlayerId === player1Id ? player1Inputs : player2Inputs;
    
    const leftRatio = leftPlayerInputs / totalInputs;
    const rightRatio = rightPlayerInputs / totalInputs;
    
    // Indicator moves based on who's winning (20% to 80%)
    indicatorPosition = 50 + ((rightRatio - leftRatio) * 30);
  }

  const leftInputs = leftPlayerId === player1Id ? player1Inputs : player2Inputs;
  const rightInputs = rightPlayerId === player1Id ? player1Inputs : player2Inputs;
  const timerPercent = (timeLeft / duration) * 100;

  return (
    <GrabClashContainer 
      $isVisible={isVisible}
      $x={uiPosition.x}
      $y={uiPosition.y}
    >
      <ClashHeader>
        <ClashTitle>CLASH</ClashTitle>
        <MashInstruction>MASH!</MashInstruction>
      </ClashHeader>
      <ClashMeterContainer>
        <PlayerMarker 
          $side="left" 
          $isPlayer1OnLeft={isPlayer1OnLeft}
          $isWinner={winnerSide === 'left'}
          $isLoser={winnerSide === 'right'}
          $isLocalPlayerWinner={winnerId === localId}
        />
        <ClashMeterFrame>
          <PlayerFill 
            $side="left"
            $isPlayer1OnLeft={isPlayer1OnLeft}
            $isWinner={winnerSide === 'left'}
            $isLoser={winnerSide === 'right'}
            $isLocalPlayerWinner={winnerId === localId}
          />
          <PlayerFill 
            $side="right"
            $isPlayer1OnLeft={isPlayer1OnLeft}
            $isWinner={winnerSide === 'right'}
            $isLoser={winnerSide === 'left'}
            $isLocalPlayerWinner={winnerId === localId}
          />
          <CenterDivider />
          <PositionIndicator $position={indicatorPosition} />
        </ClashMeterFrame>
        <PlayerMarker 
          $side="right"
          $isPlayer1OnLeft={isPlayer1OnLeft}
          $isWinner={winnerSide === 'right'}
          $isLoser={winnerSide === 'left'}
          $isLocalPlayerWinner={winnerId === localId}
        />
      </ClashMeterContainer>
      <StatsRow>
        <InputDisplay $side="left" $isPlayer1OnLeft={isPlayer1OnLeft} $isWinner={winnerSide === 'left'} $isLocalPlayerWinner={winnerId === localId}>
          {leftInputs}
        </InputDisplay>
        <InputDisplay $side="right" $isPlayer1OnLeft={isPlayer1OnLeft} $isWinner={winnerSide === 'right'} $isLocalPlayerWinner={winnerId === localId}>
          {rightInputs}
        </InputDisplay>
      </StatsRow>
      <TimerContainer>
        <TimerProgress $percent={timerPercent} />
      </TimerContainer>
    </GrabClashContainer>
  );
};

export default GrabClashUI;
