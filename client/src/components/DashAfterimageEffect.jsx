import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const SAMPLE_INTERVAL_MS = 45;
const STARTUP_SKIP_MS = 22;
const GHOST_FADE_MS = 140;
const MAX_GHOSTS = 5;
const GHOST_START_OPACITY = 0.35;

const ghostFade = keyframes`
  0% {
    opacity: var(--ghost-start-opacity, 0.35);
  }
  100% {
    opacity: 0;
  }
`;

const GhostSprite = styled.img.attrs((props) => {
  const facingScale = props.$facing === 1 ? 1 : -1;
  const trailOffsetPct = props.$dodgeDirection * -1.1;
  const atRopesNudge =
    props.$isAtTheRopes && props.$fighter === "player 1"
      ? props.$x < 640
        ? -5
        : 5
      : 0;

  return {
    style: {
      left: `calc(${((props.$x + atRopesNudge) / 1280) * 100}% + ${trailOffsetPct}%)`,
      bottom: `${(props.$y / 720) * 100}%`,
      translate: "-50%",
      transform: `scaleX(${facingScale * 1.12}) scaleY(0.88)`,
      "--ghost-start-opacity": String(props.$startOpacity ?? GHOST_START_OPACITY),
    },
  };
})`
  position: absolute;
  width: min(12.30%, 379px);
  height: auto;
  transform-origin: center bottom;
  z-index: 97;
  pointer-events: none;
  filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000);
  will-change: opacity;
  animation: ${ghostFade} ${GHOST_FADE_MS}ms ease-out forwards;
`;

function DashAfterimageEffect({
  isDodging,
  spriteSrc,
  facing,
  dodgeDirection,
  getPosition,
  isAtTheRopes,
  fighter,
}) {
  const [ghosts, setGhosts] = useState([]);
  const wasDodgingRef = useRef(false);
  const dashStartTimeRef = useRef(0);
  const sampleIntervalRef = useRef(null);
  const getPositionRef = useRef(getPosition);
  const facingRef = useRef(facing);
  const dodgeDirectionRef = useRef(dodgeDirection);
  const ghostIdRef = useRef(0);

  getPositionRef.current = getPosition;
  facingRef.current = facing;
  dodgeDirectionRef.current = dodgeDirection;

  useEffect(() => {
    if (isDodging && !wasDodgingRef.current) {
      dashStartTimeRef.current = performance.now();
      setGhosts([]);
    }
    wasDodgingRef.current = isDodging;
  }, [isDodging]);

  useEffect(() => {
    if (!isDodging || !spriteSrc) {
      if (sampleIntervalRef.current) {
        clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }
      return undefined;
    }

    const spawnGhost = () => {
      if (performance.now() - dashStartTimeRef.current < STARTUP_SKIP_MS) {
        return;
      }

      const pos = getPositionRef.current?.();
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
        return;
      }

      const id = ++ghostIdRef.current;
      const startOpacity = GHOST_START_OPACITY;

      setGhosts((prev) => {
        const next = [
          ...prev,
          {
            id,
            x: pos.x,
            y: pos.y,
            facing: facingRef.current,
            dodgeDirection: dodgeDirectionRef.current ?? facingRef.current ?? 1,
            startOpacity,
          },
        ];
        return next.length > MAX_GHOSTS ? next.slice(-MAX_GHOSTS) : next;
      });

      window.setTimeout(() => {
        setGhosts((prev) => prev.filter((ghost) => ghost.id !== id));
      }, GHOST_FADE_MS + 20);
    };

    spawnGhost();
    sampleIntervalRef.current = window.setInterval(spawnGhost, SAMPLE_INTERVAL_MS);

    return () => {
      if (sampleIntervalRef.current) {
        clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }
    };
  }, [isDodging, spriteSrc]);

  if (!spriteSrc || ghosts.length === 0) {
    return null;
  }

  return (
    <>
      {ghosts.map((ghost) => (
        <GhostSprite
          key={ghost.id}
          src={spriteSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          $x={ghost.x}
          $y={ghost.y}
          $facing={ghost.facing}
          $dodgeDirection={ghost.dodgeDirection}
          $isAtTheRopes={isAtTheRopes}
          $fighter={fighter}
          $startOpacity={ghost.startOpacity}
        />
      ))}
    </>
  );
}

DashAfterimageEffect.propTypes = {
  isDodging: PropTypes.bool.isRequired,
  spriteSrc: PropTypes.string,
  facing: PropTypes.number.isRequired,
  dodgeDirection: PropTypes.number,
  getPosition: PropTypes.func.isRequired,
  isAtTheRopes: PropTypes.bool,
  fighter: PropTypes.string,
};

export default DashAfterimageEffect;
