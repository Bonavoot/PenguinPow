import { useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import envelope from "../assets/envelope.png";

// 3D depth layers - MORE dramatic depth differences
const DEPTH_LAYERS = [
  { depth: 0.1, probability: 0.12 },
  { depth: 0.25, probability: 0.15 },
  { depth: 0.4, probability: 0.18 },
  { depth: 0.55, probability: 0.2 },
  { depth: 0.7, probability: 0.15 },
  { depth: 0.85, probability: 0.12 },
  { depth: 1.0, probability: 0.08 },
];

// Ground level calculation
const getGroundLevel = (depth, screenHeight) => {
  const minGround = screenHeight * 0.15;
  const maxGround = screenHeight * 1.1;
  return minGround + depth * (maxGround - minGround);
};

// Performance settings
const MAX_SNOWFLAKES = 15;
const MAX_ENVELOPES = 25;

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
`;

// Base snowflake style - no dynamic props, transforms applied via JS
const SnowflakeElement = styled.div`
  position: absolute;
  will-change: transform, opacity;
  backface-visibility: hidden;
  border-radius: 50%;
`;

const SnowEffect = ({ mode = "snow", winner = null, playerIndex = null }) => {
  const containerRef = useRef(null);
  const particlesRef = useRef([]);
  const elementsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);

  const shouldShowEnvelopes =
    mode === "envelope" &&
    winner &&
    ((winner.fighter === "player 1" && playerIndex === 0) ||
      (winner.fighter === "player 2" && playerIndex === 1));

  const getRandomDepth = useCallback(() => {
    const random = Math.random();
    let cumulativeProbability = 0;
    for (const { depth, probability } of DEPTH_LAYERS) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) return depth;
    }
    return 0.5;
  }, []);

  const createParticleData = useCallback((initialY = -10) => {
    const depth = getRandomDepth();
    const isEnvelope = shouldShowEnvelopes;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Scale based on depth
    const depthScale = isEnvelope
      ? 0.15 + depth * depth * 1.85
      : 0.3 + depth * 1.0;

    // Speed based on depth
    const baseSpeed = isEnvelope
      ? (0.3 + depth * depth * 2.5) * (0.85 + Math.random() * 0.3)
      : (0.4 + depth * 2.5) * (0.8 + Math.random() * 0.4);

    // Opacity based on depth
    const depthOpacity = isEnvelope
      ? 0.2 + depth * 0.75
      : 0.5 + depth * 0.5;

    // Horizontal drift
    const horizontalDrift = (Math.random() - 0.5) * (0.1 + depth * 0.8);

    // X position
    let xPos;
    if (depth > 0.8) {
      xPos = Math.random() * (screenW + 200) - 100;
    } else if (depth > 0.5) {
      xPos = Math.random() * (screenW + 60) - 30;
    } else {
      const center = screenW / 2;
      const spread = screenW * (0.3 + depth * 0.5);
      xPos = center + (Math.random() - 0.5) * spread;
    }

    return {
      x: xPos,
      y: initialY,
      velocityX: horizontalDrift,
      velocityY: baseSpeed,
      opacity: depthOpacity,
      scale: depthScale,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * (isEnvelope ? 3 : 0.5) * (0.3 + depth),
      depth,
      groundLevel: getGroundLevel(depth, screenH),
      isEnvelope,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmplitude: isEnvelope ? 0.3 + depth * 1.5 : 0,
      swayFrequency: isEnvelope ? 0.6 + Math.random() * 1.0 : 0,
    };
  }, [getRandomDepth, shouldShowEnvelopes]);

  // Create DOM elements once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing elements
    container.innerHTML = '';
    elementsRef.current = [];
    particlesRef.current = [];

    const maxParticles = shouldShowEnvelopes ? MAX_ENVELOPES : MAX_SNOWFLAKES;

    for (let i = 0; i < maxParticles; i++) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.willChange = 'transform, opacity';
      el.style.backfaceVisibility = 'hidden';
      
      if (shouldShowEnvelopes) {
        el.style.width = '40px';
        el.style.height = '60px';
        el.style.background = `url(${envelope}) no-repeat center center`;
        el.style.backgroundSize = 'contain';
      } else {
        el.style.width = '5px';
        el.style.height = '5px';
        el.style.background = 'rgba(255, 255, 255, 0.9)';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 0 2px 1px rgba(255, 255, 255, 0.25)';
      }

      container.appendChild(el);
      elementsRef.current.push(el);
      
      // Stagger initial Y positions
      const initialY = -10 - Math.random() * window.innerHeight * 0.8;
      particlesRef.current.push(createParticleData(initialY));
    }

    return () => {
      container.innerHTML = '';
      elementsRef.current = [];
      particlesRef.current = [];
    };
  }, [shouldShowEnvelopes, createParticleData]);

  // Animation loop - NO React state updates!
  useEffect(() => {
    const animate = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      
      // Throttle to ~30fps
      if (deltaTime < 33) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      lastTimeRef.current = timestamp;
      const time = timestamp / 1000;
      const timeFactor = deltaTime / 16;
      const screenW = window.innerWidth;

      particlesRef.current.forEach((particle, i) => {
        const el = elementsRef.current[i];
        if (!el) return;

        // Calculate sway for envelopes
        let swayX = 0;
        if (particle.isEnvelope) {
          const primarySway = Math.sin(time * particle.swayFrequency + particle.swayPhase) * particle.swayAmplitude;
          const secondarySway = Math.sin(time * particle.swayFrequency * 2.3 + particle.swayPhase) * particle.swayAmplitude * 0.3;
          swayX = primarySway + secondarySway;
        }

        // Update position
        particle.y += particle.velocityY * timeFactor;
        particle.x += particle.velocityX * timeFactor + swayX;
        particle.rotation += particle.rotationSpeed * timeFactor;

        // Reset if below ground
        if (particle.y >= particle.groundLevel) {
          Object.assign(particle, createParticleData(-10));
        }

        // Wrap horizontally
        const buffer = 50 + particle.depth * 50;
        if (particle.x < -buffer) particle.x = screenW + buffer;
        if (particle.x > screenW + buffer) particle.x = -buffer;

        // Apply transform directly to DOM - NO React re-render!
        el.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) scale(${particle.scale}) rotate(${particle.rotation}deg)`;
        el.style.opacity = particle.opacity;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [createParticleData]);

  return <SnowContainer ref={containerRef} />;
};

export default SnowEffect;
