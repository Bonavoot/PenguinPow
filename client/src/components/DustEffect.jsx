import { useEffect, useState, useRef } from "react";

const getRandomShape = () => {
  const shapes = [
    "clip-path: polygon(50% 0%, 80% 40%, 100% 50%, 80% 60%, 50% 100%, 20% 60%, 0% 50%, 20% 40%)",
    "clip-path: polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)",
    "clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
    "clip-path: none",
  ];
  return shapes[Math.floor(Math.random() * shapes.length)];
};

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
          size: Math.random() * 8 + 8,
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
        <div
          key={particle.id}
          style={{
            position: "absolute",
            left: `${(particle.x / 1280) * 100}%`,
            bottom: `${(particle.y / 720) * 100}%`,
            width: `${(particle.size / 1280) * 100}%`,
            height: `${(particle.size / 720) * 100}%`,
            backgroundColor: "rgba(151, 127, 17, 0.8)",
            animation: `dust-rise-${
              particle.id % 2 ? "a" : "b"
            } 1s ease-out forwards`,
            zIndex: 100,
            pointerEvents: "none",
            transform: `
              translateX(${facing === 1 ? "0%" : "-100%"})
              rotate(${particle.rotation}deg)
              scale(${particle.initialScale})
            `,
            willChange: "transform, opacity",
            [particle.shape.split(":")[0]]: particle.shape.split(":")[1],
          }}
        />
      ))}
    </>
  );
};

export default DustEffect;
