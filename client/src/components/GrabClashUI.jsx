import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

// Animations
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 200, 0, 0.6), 0 0 40px rgba(255, 150, 0, 0.4), inset 0 0 20px rgba(255, 200, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 200, 0, 0.9), 0 0 60px rgba(255, 150, 0, 0.6), inset 0 0 30px rgba(255, 200, 0, 0.3);
  }
`;

const shakeIntense = keyframes`
  0%, 100% { transform: translateX(-50%) rotate(0deg); }
  10% { transform: translateX(-50%) rotate(-1deg) translateY(-2px); }
  20% { transform: translateX(-50%) rotate(1deg) translateY(1px); }
  30% { transform: translateX(-50%) rotate(-1deg) translateY(-1px); }
  40% { transform: translateX(-50%) rotate(1deg) translateY(2px); }
  50% { transform: translateX(-50%) rotate(-1deg) translateY(-2px); }
  60% { transform: translateX(-50%) rotate(1deg) translateY(1px); }
  70% { transform: translateX(-50%) rotate(-1deg) translateY(-1px); }
  80% { transform: translateX(-50%) rotate(1deg) translateY(2px); }
  90% { transform: translateX(-50%) rotate(-1deg) translateY(-1px); }
`;

const flashMash = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
`;

const winnerExplosion = keyframes`
  0% {
    background: linear-gradient(90deg, #00ff00, #00cc00);
    box-shadow: 0 0 30px rgba(0, 255, 0, 0.8);
  }
  50% {
    background: linear-gradient(90deg, #88ff88, #00ff00);
    box-shadow: 0 0 60px rgba(0, 255, 0, 1);
  }
  100% {
    background: linear-gradient(90deg, #00ff00, #00cc00);
    box-shadow: 0 0 30px rgba(0, 255, 0, 0.8);
  }
`;

const loserDim = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.2; }
`;

const arrowBounce = keyframes`
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
`;

const arrowBounceLeft = keyframes`
  0%, 100% { transform: translateX(0) scaleX(-1); }
  50% { transform: translateX(-5px) scaleX(-1); }
`;

const GrabClashContainer = styled.div`
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  gap: 8px;
  animation: ${shakeIntense} 0.15s infinite linear;
`;

const MashTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: #ffcc00;
  text-shadow: 
    -3px -3px 0 #000, 3px -3px 0 #000, 
    -3px 3px 0 #000, 3px 3px 0 #000,
    0 0 20px rgba(255, 200, 0, 0.9),
    0 0 40px rgba(255, 150, 0, 0.6);
  letter-spacing: 0.15em;
  animation: ${flashMash} 0.3s infinite;
  white-space: nowrap;
`;

const ClashMeterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PlayerArrow = styled.div`
  font-size: 24px;
  color: ${props => props.$side === 'left' ? '#3498db' : '#e74c3c'};
  text-shadow: 0 0 10px ${props => props.$side === 'left' ? 'rgba(52, 152, 219, 0.8)' : 'rgba(231, 76, 60, 0.8)'};
  animation: ${props => props.$side === 'left' ? arrowBounceLeft : arrowBounce} 0.4s infinite;
  
  ${props => props.$isWinner && css`
    color: #00ff00;
    text-shadow: 0 0 20px rgba(0, 255, 0, 1);
    font-size: 28px;
  `}
  
  ${props => props.$isLoser && css`
    opacity: 0.3;
    animation: none;
  `}
`;

const ClashMeter = styled.div`
  width: clamp(250px, 35vw, 400px);
  height: 35px;
  background: linear-gradient(180deg, #1a1a2e, #0f0f1a);
  border: 3px solid #ffcc00;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  animation: ${pulseGlow} 0.5s infinite;
`;

const Player1Fill = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: ${props => props.$fillPercent}%;
  height: 100%;
  background: linear-gradient(90deg, #2980b9, #3498db, #5dade2);
  border-radius: 17px 0 0 17px;
  transition: width 0.1s ease-out;
  box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.3);
  
  ${props => props.$isWinner && css`
    animation: ${winnerExplosion} 0.2s infinite;
  `}
  
  ${props => props.$isLoser && css`
    animation: ${loserDim} 0.3s infinite;
    opacity: 0.4;
  `}
`;

const Player2Fill = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  width: ${props => props.$fillPercent}%;
  height: 100%;
  background: linear-gradient(270deg, #c0392b, #e74c3c, #ec7063);
  border-radius: 0 17px 17px 0;
  transition: width 0.1s ease-out;
  box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.3);
  
  ${props => props.$isWinner && css`
    animation: ${winnerExplosion} 0.2s infinite;
  `}
  
  ${props => props.$isLoser && css`
    animation: ${loserDim} 0.3s infinite;
    opacity: 0.4;
  `}
`;

const CenterLine = styled.div`
  position: absolute;
  left: 50%;
  top: -5px;
  transform: translateX(-50%);
  width: 4px;
  height: calc(100% + 10px);
  background: linear-gradient(180deg, #fff, #ffcc00, #fff);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  z-index: 5;
`;

const ClashIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: ${props => props.$position}%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 45px;
  background: linear-gradient(180deg, #fff, #ffcc00, #ffa500);
  border-radius: 6px;
  box-shadow: 0 0 15px rgba(255, 200, 0, 0.9), 0 0 30px rgba(255, 150, 0, 0.6);
  transition: left 0.08s ease-out;
  z-index: 10;
  
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #ffcc00;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid #ffcc00;
  }
`;

const InputCounters = styled.div`
  display: flex;
  justify-content: space-between;
  width: clamp(250px, 35vw, 400px);
  margin-top: 4px;
`;

const InputCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 1.5vw, 1.2rem);
  color: ${props => props.$side === 'left' ? '#3498db' : '#e74c3c'};
  text-shadow: 
    -2px -2px 0 #000, 2px -2px 0 #000, 
    -2px 2px 0 #000, 2px 2px 0 #000,
    0 0 10px ${props => props.$side === 'left' ? 'rgba(52, 152, 219, 0.6)' : 'rgba(231, 76, 60, 0.6)'};
  
  ${props => props.$isWinner && css`
    color: #00ff00;
    text-shadow: 
      -2px -2px 0 #000, 2px -2px 0 #000, 
      -2px 2px 0 #000, 2px 2px 0 #000,
      0 0 15px rgba(0, 255, 0, 0.9);
  `}
`;

const TimerBar = styled.div`
  width: clamp(250px, 35vw, 400px);
  height: 6px;
  background: #1a1a2e;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
`;

const TimerFill = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background: linear-gradient(90deg, #e74c3c, #f39c12, #f1c40f);
  border-radius: 3px;
  transition: width 0.05s linear;
  box-shadow: 0 0 10px rgba(241, 196, 15, 0.6);
`;

const GrabClashUI = ({ socket, player1, player2 }) => {
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
  const spatialLayoutRef = useRef({ leftPlayerId: null, rightPlayerId: null });

  useEffect(() => {
    if (!socket) return;

    const handleGrabClashStart = (data) => {
      console.log('🥊 CLIENT: Grab clash started:', data);
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
      
      let newLeftPlayerId, newRightPlayerId;
      if (player1Pos.x < player2Pos.x) {
        newLeftPlayerId = data.player1Id;
        newRightPlayerId = data.player2Id;
      } else {
        newLeftPlayerId = data.player2Id;
        newRightPlayerId = data.player1Id;
      }
      
      setLeftPlayerId(newLeftPlayerId);
      setRightPlayerId(newRightPlayerId);
      
      spatialLayoutRef.current = {
        leftPlayerId: newLeftPlayerId,
        rightPlayerId: newRightPlayerId
      };
      
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
      setPlayer1Inputs(data.player1Inputs);
      setPlayer2Inputs(data.player2Inputs);
    };

    const handleGrabClashEnd = (data) => {
      console.log('🥊 CLIENT: Grab clash ended:', data);
      
      const refLeftPlayerId = spatialLayoutRef.current.leftPlayerId;
      const winnerIsLeft = data.winnerId === refLeftPlayerId;
      const winnerSideValue = winnerIsLeft ? 'left' : 'right';
      
      setWinnerSide(winnerSideValue);
      
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
    };
  }, [socket]);

  // Calculate fill percentages for the tug-of-war bar
  const totalInputs = player1Inputs + player2Inputs;
  let leftFillPercent = 50;
  let rightFillPercent = 50;
  let indicatorPosition = 50;
  
  if (totalInputs > 0 && leftPlayerId && rightPlayerId) {
    const leftPlayerInputs = leftPlayerId === player1Id ? player1Inputs : player2Inputs;
    const rightPlayerInputs = rightPlayerId === player1Id ? player1Inputs : player2Inputs;
    
    // Calculate percentages - each side fills from their edge toward center
    const leftRatio = leftPlayerInputs / totalInputs;
    const rightRatio = rightPlayerInputs / totalInputs;
    
    // Fill percentages (0-50% each, meeting in the middle)
    leftFillPercent = leftRatio * 50;
    rightFillPercent = rightRatio * 50;
    
    // Indicator moves based on who's winning (15% to 85%)
    indicatorPosition = 50 + ((rightRatio - leftRatio) * 35);
  }

  const leftInputs = leftPlayerId === player1Id ? player1Inputs : player2Inputs;
  const rightInputs = rightPlayerId === player1Id ? player1Inputs : player2Inputs;

  const timerPercent = (timeLeft / duration) * 100;

  return (
    <GrabClashContainer $isVisible={isVisible}>
      <MashTitle>⚡ MASH TO WIN! ⚡</MashTitle>
      <ClashMeterContainer>
        <PlayerArrow 
          $side="left" 
          $isWinner={winnerSide === 'left'}
          $isLoser={winnerSide === 'right'}
        >
          ➤
        </PlayerArrow>
        <ClashMeter>
          <Player1Fill 
            $fillPercent={leftFillPercent * 2} 
            $isWinner={winnerSide === 'left'}
            $isLoser={winnerSide === 'right'}
          />
          <Player2Fill 
            $fillPercent={rightFillPercent * 2} 
            $isWinner={winnerSide === 'right'}
            $isLoser={winnerSide === 'left'}
          />
          <CenterLine />
          <ClashIndicator $position={indicatorPosition} />
        </ClashMeter>
        <PlayerArrow 
          $side="right"
          $isWinner={winnerSide === 'right'}
          $isLoser={winnerSide === 'left'}
        >
          ➤
        </PlayerArrow>
      </ClashMeterContainer>
      <InputCounters>
        <InputCount $side="left" $isWinner={winnerSide === 'left'}>
          {leftInputs}
        </InputCount>
        <InputCount $side="right" $isWinner={winnerSide === 'right'}>
          {rightInputs}
        </InputCount>
      </InputCounters>
      <TimerBar>
        <TimerFill $percent={timerPercent} />
      </TimerBar>
    </GrabClashContainer>
  );
};

export default GrabClashUI;
