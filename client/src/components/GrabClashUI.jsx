import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

const GrabClashContainer = styled.div`
  position: absolute;
  top: 50px; /* Same height as PowerMeter */
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: ${props => props.isVisible ? 'block' : 'none'};
`;

const ClashMeter = styled.div`
  width: 300px;
  height: 40px;
  background: #121213;
  border: 3px solid #ecf0f1;
  border-radius: 8px;
  position: relative;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
`;

const ClashLine = styled.div`
  position: absolute;
  top: 50%;
  left: ${props => props.position}%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 32px;
  background: linear-gradient(to bottom, #f1c40f, #f39c12);
  border-radius: 3px;
  box-shadow: 0 0 10px rgba(241, 196, 15, 0.6);
  transition: left 0.1s ease-out;
`;

const winnerFlash = keyframes`
  0%, 100% {
    background: #00ff00;
    opacity: 1;
  }
  50% {
    background: #00cc00;
    opacity: 0.7;
  }
`;

const Player1Zone = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 50%;
  height: 100%;
  background: transparent;
  border-radius: 5px 0 0 5px;
  
  ${props => props.isWinner && css`
    animation: ${winnerFlash} 0.2s infinite;
  `}
`;

const Player2Zone = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  background: transparent;
  border-radius: 0 5px 5px 0;
  
  ${props => props.isWinner && css`
    animation: ${winnerFlash} 0.2s infinite;
  `}
`;



const CenterLine = styled.div`
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 2px;
  height: 100%;
  background: rgba(236, 240, 241, 0.5);
`;

const Timer = styled.div`
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  font-weight: bold;
  color: #e74c3c;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
`;

const GrabClashUI = ({ socket, player1, player2 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [player1Inputs, setPlayer1Inputs] = useState(0);
  const [player2Inputs, setPlayer2Inputs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2000);
  const [player1Id, setPlayer1Id] = useState(null);
  const [player2Id, setPlayer2Id] = useState(null);
  const [leftPlayerId, setLeftPlayerId] = useState(null);
  const [rightPlayerId, setRightPlayerId] = useState(null);
  const [winnerSide, setWinnerSide] = useState(null); // 'left' or 'right'
  const spatialLayoutRef = useRef({ leftPlayerId: null, rightPlayerId: null }); // Persistent storage

  useEffect(() => {
    if (!socket) return;

    const handleGrabClashStart = (data) => {
      console.log('🥊 CLIENT: Grab clash started:', data);
      setIsVisible(true);
      setPlayer1Inputs(0);
      setPlayer2Inputs(0);
      setTimeLeft(data.duration);
      setPlayer1Id(data.player1Id);
      setPlayer2Id(data.player2Id);
      
      // Determine left and right players based on their positions
      const player1Pos = data.player1Position;
      const player2Pos = data.player2Position;
      
      let newLeftPlayerId, newRightPlayerId;
      if (player1Pos.x < player2Pos.x) {
        // Player 1 is on the left, Player 2 is on the right
        newLeftPlayerId = data.player1Id;
        newRightPlayerId = data.player2Id;
      } else {
        // Player 2 is on the left, Player 1 is on the right
        newLeftPlayerId = data.player2Id;
        newRightPlayerId = data.player1Id;
      }
      
      setLeftPlayerId(newLeftPlayerId);
      setRightPlayerId(newRightPlayerId);
      
      // Store in persistent ref so it doesn't get cleared
      spatialLayoutRef.current = {
        leftPlayerId: newLeftPlayerId,
        rightPlayerId: newRightPlayerId
      };
      
      console.log('🥊 CLIENT: UI state updated - visible:', true, 'player1Id:', data.player1Id, 'player2Id:', data.player2Id);
      console.log('🥊 CLIENT: Positions - player1:', player1Pos, 'player2:', player2Pos);
      console.log('🥊 CLIENT: Layout - leftPlayerId:', newLeftPlayerId, 'rightPlayerId:', newRightPlayerId);
      console.log('🥊 CLIENT: Stored in ref - leftPlayerId:', spatialLayoutRef.current.leftPlayerId, 'rightPlayerId:', spatialLayoutRef.current.rightPlayerId);
      
      // Start countdown timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, data.duration - elapsed);
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          clearInterval(timer);
        }
      }, 50);
    };

    const handleGrabClashProgress = (data) => {
      console.log('🥊 CLIENT: Received grab clash progress:', data);
      setPlayer1Inputs(data.player1Inputs);
      setPlayer2Inputs(data.player2Inputs);
    };

    const handleGrabClashEnd = (data) => {
      console.log('🥊 CLIENT: Grab clash ended:', data);
      console.log('🥊 CLIENT: Final inputs - Winner:', data.winnerId, 'WinnerInputs:', data.winnerInputs, 'LoserInputs:', data.loserInputs);
      console.log('🥊 CLIENT: Current layout state - leftPlayerId:', leftPlayerId, 'rightPlayerId:', rightPlayerId);
      console.log('🥊 CLIENT: Persistent layout ref - leftPlayerId:', spatialLayoutRef.current.leftPlayerId, 'rightPlayerId:', spatialLayoutRef.current.rightPlayerId);
      
      // Use the persistent ref instead of state that might be cleared
      const refLeftPlayerId = spatialLayoutRef.current.leftPlayerId;
      const refRightPlayerId = spatialLayoutRef.current.rightPlayerId;
      
      // Determine which side won using the ref values
      const winnerIsLeft = data.winnerId === refLeftPlayerId;
      const winnerSideValue = winnerIsLeft ? 'left' : 'right';
      
      console.log('🥊 CLIENT: Winner determination - winnerId:', data.winnerId, 'refLeftPlayerId:', refLeftPlayerId, 'winnerIsLeft:', winnerIsLeft, 'winnerSide:', winnerSideValue);
      
      setWinnerSide(winnerSideValue);
      
      // Flash green for 0.5 seconds, then hide
      setTimeout(() => {
        setIsVisible(false);
        setPlayer1Inputs(0);
        setPlayer2Inputs(0);
        setTimeLeft(2000);
        setPlayer1Id(null);
        setPlayer2Id(null);
        setLeftPlayerId(null);
        setRightPlayerId(null);
        setWinnerSide(null);
        // Clear the ref as well
        spatialLayoutRef.current = { leftPlayerId: null, rightPlayerId: null };
        console.log('🥊 CLIENT: UI hidden after grab clash');
      }, 500);
    };

    socket.on('grab_clash_start', handleGrabClashStart);
    socket.on('grab_clash_progress', handleGrabClashProgress);
    socket.on('grab_clash_end', handleGrabClashEnd);

    return () => {
      socket.off('grab_clash_start', handleGrabClashStart);
      socket.off('grab_clash_progress', handleGrabClashProgress);
      socket.off('grab_clash_end', handleGrabClashEnd);
    };
  }, [socket]);

  // Calculate line position based on spatial layout (0-100%)
  const totalInputs = player1Inputs + player2Inputs;
  let linePosition = 50; // Start in center
  
  if (totalInputs > 0 && leftPlayerId && rightPlayerId) {
    // Get inputs for left and right players based on spatial positions
    const leftPlayerInputs = leftPlayerId === player1Id ? player1Inputs : player2Inputs;
    const rightPlayerInputs = rightPlayerId === player1Id ? player1Inputs : player2Inputs;
    
    // Calculate ratio based on left player inputs
    const leftPlayerRatio = leftPlayerInputs / totalInputs;
    // Map from 0-1 to 85-15 (left player having more inputs moves line left)
    // Reversed: 0 = line at 85% (right), 1 = line at 15% (left)
    linePosition = 85 - (leftPlayerRatio * 70);
  }

  const formatTime = (ms) => {
    return (ms / 1000).toFixed(1);
  };

  // Debug logging for winner side
  if (winnerSide) {
    console.log('🥊 CLIENT: Rendering with winnerSide:', winnerSide, 'Player1Zone isWinner:', winnerSide === 'left', 'Player2Zone isWinner:', winnerSide === 'right');
  }

  return (
    <GrabClashContainer isVisible={isVisible}>
      <Timer>{formatTime(timeLeft)}s</Timer>
      <ClashMeter>
        <Player1Zone isWinner={winnerSide === 'left'} />
        <Player2Zone isWinner={winnerSide === 'right'} />
        <CenterLine />
        <ClashLine position={linePosition} />
      </ClashMeter>
    </GrabClashContainer>
  );
};

export default GrabClashUI; 