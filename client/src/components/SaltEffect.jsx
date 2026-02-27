import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

const SaltContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    width: "15.56%",
    height: "auto",
    pointerEvents: "none",
    zIndex: 999,
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: `scaleX(${props.$facing})`,
  },
}))``;

const SaltParticle = styled.div`
  position: absolute;
  width: calc(0.3cqw * (16 / 9));
  height: calc(0.3cqw * (16 / 9));
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.96) 32%,
    rgba(248, 252, 255, 0.82) 62%,
    rgba(255, 255, 255, 0) 100%
  );
  border-radius: 50%;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
`;

const SaltEffect = ({
  isActive,
  playerFacing,
  playerX,
  playerY,
  xOffset = 0,
  yOffset = 0,
}) => {
  const [particleSlots, setParticleSlots] = useState([]);
  const particlesRef = useRef([]);
  const lastActiveState = useRef(false);
  const lastUpdateTime = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const domRefs = useRef([]);

  useEffect(() => {
    if (isActive && !lastActiveState.current) {
      const baseAngle = playerFacing === 1 ? 135 : 40;
      const velocityScale = 1;
      const baseIdx = particlesRef.current.length;

      const newParticles = [];
      for (let i = 0; i < 20; i++) {
        const angle =
          (baseAngle + (Math.random() * 80 - 40)) * (Math.PI / 180);
        const baseSpeed = 8 + Math.random() * 7;
        const speed = baseSpeed * velocityScale;
        const scale = 0.7 + Math.random() * 0.6;

        newParticles.push({
          x:
            ((playerX + xOffset + (playerFacing === 1 ? -20 : 1000)) / 1280) *
            100,
          y: ((playerY + yOffset) / 720) * 100,
          velocityX: Math.cos(angle) * speed * (playerFacing === 1 ? 1 : -1),
          velocityY: Math.sin(angle) * speed,
          opacity: 0.94 + Math.random() * 0.06,
          maxLife: 1200 + Math.random() * 400,
          life: 1200 + Math.random() * 400,
          scale,
          blur: Math.random() * 0.08,
          alive: true,
        });
      }

      particlesRef.current = particlesRef.current.concat(newParticles);
      // Tell React to mount new DOM elements (one render per burst, not per frame)
      setParticleSlots((prev) => {
        const next = new Array(particlesRef.current.length);
        for (let i = 0; i < next.length; i++) next[i] = i;
        return next;
      });
      domRefs.current.length = particlesRef.current.length;
    }
    lastActiveState.current = isActive;
  }, [isActive, playerFacing, playerX, playerY, xOffset, yOffset]);

  const setDomRef = useCallback((idx, el) => {
    domRefs.current[idx] = el;
  }, []);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!lastUpdateTime.current) {
        lastUpdateTime.current = timestamp;
      }

      const deltaTime = timestamp - lastUpdateTime.current;

      if (deltaTime >= 16) {
        const particles = particlesRef.current;
        let aliveCount = 0;
        const dtFactor = deltaTime / 16;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.alive) continue;

          p.velocityY += -0.5 * dtFactor;
          p.x += p.velocityX * dtFactor;
          p.y += p.velocityY * dtFactor;
          p.opacity -= deltaTime / p.maxLife;
          p.scale *= 0.99;
          p.blur += 0.1;
          p.life -= deltaTime;

          if (p.life <= 0 || p.opacity <= 0) {
            p.alive = false;
            const el = domRefs.current[i];
            if (el) el.style.opacity = "0";
            continue;
          }

          aliveCount++;

          const el = domRefs.current[i];
          if (el) {
            el.style.transform = `translate(${p.x}px, ${-p.y}px) scale(${p.scale})`;
            el.style.opacity = p.opacity;
            el.style.filter = `brightness(1.18) contrast(1.15) blur(${p.blur}px)`;
          }
        }

        if (aliveCount === 0 && particles.length > 0) {
          particlesRef.current = [];
          domRefs.current = [];
          setParticleSlots([]);
        }

        lastUpdateTime.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (particleSlots.length === 0) return null;

  return (
    <SaltContainer
      ref={containerRef}
      $x={playerX}
      $y={playerY}
      $facing={playerFacing}
    >
      {particleSlots.map((idx) => (
        <SaltParticle key={idx} ref={(el) => setDomRef(idx, el)} />
      ))}
    </SaltContainer>
  );
};

SaltEffect.propTypes = {
  isActive: PropTypes.bool.isRequired,
  playerFacing: PropTypes.number.isRequired,
  playerX: PropTypes.number.isRequired,
  playerY: PropTypes.number.isRequired,
  xOffset: PropTypes.number,
  yOffset: PropTypes.number,
};

export default SaltEffect;
