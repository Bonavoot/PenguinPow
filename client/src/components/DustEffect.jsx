import { useEffect, useState, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

const getRandomShape = () => {
  const shapes = [
    "clip-path: polygon(50% 0%, 80% 40%, 100% 50%, 80% 60%, 50% 100%, 20% 60%, 0% 50%, 20% 40%)",
    "clip-path: polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)",
    "clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
    "clip-path: none",
  ];
  return shapes[Math.floor(Math.random() * shapes.length)];
};

const DustParticle = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    width: `${(props.$size / 1280) * 100}%`,
    height: `${(props.$size / 720) * 100}%`,
    backgroundColor: "rgba(151, 127, 17, 0.8)",
    animation: `dust-rise-${props.$id % 2 ? "a" : "b"} 1s ease-out forwards`,
    zIndex: 100,
    pointerEvents: "none",
    transform: `
      translateX(${props.$facing === 1 ? "0%" : "-100%"})
      rotate(${props.$rotation}deg)
      scale(${props.$initialScale})
    `,
    willChange: "transform, opacity",
    [props.$shape.split(":")[0]]: props.$shape.split(":")[1],
  },
}))``;

const DustEffect = ({ playerX, playerY, facing }) => {
  const [particles, setParticles] = useState([]);
  const lastX = useRef(playerX);
  const lastUpdateTime = useRef(Date.now());

  useEffect(() => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime.current;

    if (timeDiff > 50 && lastX.current !== playerX) {
      setParticles((current) => {
        const newParticles = [...current];
        if (newParticles.length > 7) {
          newParticles.shift();
        }

        const xOffset = facing === 1 ? 160 : 147;
        const rotation = Math.random() * 360;
        const initialScale = 0.8 + Math.random() * 0.4;

        newParticles.push({
          id: Date.now(),
          x: playerX + xOffset + (Math.random() * -55 - 10),
          y: playerY + 25 + (Math.random() * 10 - 5),
          size: Math.random() * 7.5 + 7.5,
          rotation,
          shape: getRandomShape(),
          initialScale,
          moveDirection: Math.random() * 60 - 30,
        });

        return newParticles;
      });

      lastUpdateTime.current = currentTime;
    }

    lastX.current = playerX;
  }, [playerX, playerY, facing]);

  useEffect(() => {
    const cleanup = setTimeout(() => {
      setParticles((current) => current.filter((p) => Date.now() - p.id < 800));
    }, 800);

    return () => clearTimeout(cleanup);
  }, [particles]);

  return (
    <>
      {particles.map((particle) => (
        <DustParticle
          key={particle.id}
          $x={particle.x}
          $y={particle.y}
          $size={particle.size}
          $rotation={particle.rotation}
          $shape={particle.shape}
          $initialScale={particle.initialScale}
          $facing={facing}
          $id={particle.id}
        />
      ))}
    </>
  );
};

DustEffect.propTypes = {
  playerX: PropTypes.number.isRequired,
  playerY: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
};

export default DustEffect;
