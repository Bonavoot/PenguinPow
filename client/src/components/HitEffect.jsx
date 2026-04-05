import React, { useEffect, useState, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

const SLAP_LINE_INDICES = [0, 1, 2, 3, 4];
const CHARGED_LINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
const SLAP_SPARK_INDICES = [0, 1, 2, 3, 4, 5];
const CHARGED_SPARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
const SLAP_PARTICLE_INDICES = [0, 1, 2, 3];
const CHARGED_PARTICLE_INDICES = [0, 1, 2, 3, 4, 5];
const TERTIARY_RING_INDICES = [0, 1];

const HitEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -8 : -3)}%;
  bottom: ${props => (props.$y / 720) * 100}%;
  width: 2.47cqw;
  height: 2.47cqw;
  transform: translate(-50%, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
`;

const ImpactFrame = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
`;

const HitEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const [impactFrame, setImpactFrame] = useState(null);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const impactFrameTimeoutRef = useRef(null);
  const gameSceneRef = useRef(null);

  const EFFECT_DURATION_SLAP = 550;
  const EFFECT_DURATION_CHARGED = 800;

  const hitIdentifier = useMemo(() => {
    if (!position) return null;
    return position.hitId || position.timestamp;
  }, [position?.hitId, position?.timestamp]);

  useEffect(() => {
    if (!position || !hitIdentifier) return;
    if (processedHitsRef.current.has(hitIdentifier)) return;

    processedHitsRef.current.add(hitIdentifier);

    const effectId = ++effectIdCounter.current;
    const attackType = position.attackType || 'slap';
    const isCounterHit = position.isCounterHit || false;
    const isPunish = position.isPunish || false;

    const isCinematic = position.cinematicKill || false;
    const cinematicMs = position.cinematicHitstopMs || 0;

    const isBurstHit = position.isBurstHit || false;

    const isHeavy = attackType === 'charged' || isBurstHit || isCinematic;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      attackType,
      isBurstHit,
      isCounterHit,
      isPunish,
      frozen: isCinematic,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    if (isCinematic) {
      setImpactFrame('cinematic');
      if (impactFrameTimeoutRef.current) clearTimeout(impactFrameTimeoutRef.current);
      impactFrameTimeoutRef.current = setTimeout(() => {
        setImpactFrame(null);
        impactFrameTimeoutRef.current = null;
      }, 90);
    }

    if (isCinematic || attackType === 'charged') {
      if (!gameSceneRef.current) {
        gameSceneRef.current = document.querySelector('.game-scene');
      }
      const scene = gameSceneRef.current;
      if (scene) {
        scene.classList.add('hit-chromatic');
        const chromDuration = isCinematic ? 200 : 100;
        const chromTid = setTimeout(() => scene.classList.remove('hit-chromatic'), chromDuration);
        pendingTimeouts.current.push(chromTid);
      }
    }

    if (isCinematic && cinematicMs > 0) {
      const unfreezeId = setTimeout(() => {
        setActiveEffects((prev) =>
          prev.map((e) => e.id === effectId ? { ...e, frozen: false } : e)
        );
      }, cinematicMs);
      pendingTimeouts.current.push(unfreezeId);
    }

    const extraTime = isCinematic ? cinematicMs : 0;
    const duration = (isHeavy ? EFFECT_DURATION_CHARGED : EFFECT_DURATION_SLAP) + extraTime;
    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(hitIdentifier);
    }, duration);
    pendingTimeouts.current.push(tid);
  }, [hitIdentifier, position?.x, position?.y, position?.facing, position?.attackType, position?.isCounterHit, position?.isPunish, position?.cinematicKill]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      if (impactFrameTimeoutRef.current) clearTimeout(impactFrameTimeoutRef.current);
      setActiveEffects([]);
      setImpactFrame(null);
    };
  }, []);

  return (
    <>
      {impactFrame && createPortal(
        <ImpactFrame
          className={`impact-frame impact-frame--${impactFrame}`}
        />,
        document.getElementById("game-hud") || document.body
      )}
      {activeEffects.map((effect) => {
        const isCharged = effect.attackType === 'charged';
        const isBurst = effect.isBurstHit && !isCharged;
        const isHeavy = isCharged || isBurst;
        const hitTypeClass = isCharged ? 'charged-hit' : 'slap-hit';
        const burstHitClass = isBurst ? 'burst-hit' : '';
        const counterHitClass = effect.isCounterHit ? 'counter-hit' : '';
        const punishHitClass = effect.isPunish ? 'punish-hit' : '';
        const frozenClass = effect.frozen ? 'cinematic-frozen' : '';
        const ringTiltSigned = effect.facing === -1 ? "55deg" : "-55deg";
        const knockDir = effect.facing === 1 ? 1 : -1;
        
        const lineIndices = isHeavy ? CHARGED_LINE_INDICES : SLAP_LINE_INDICES;
        const sparkIndices = isHeavy ? CHARGED_SPARK_INDICES : SLAP_SPARK_INDICES;
        const particleIndices = isHeavy ? CHARGED_PARTICLE_INDICES : SLAP_PARTICLE_INDICES;

        return (
          <HitEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div
              className={`hit-ring-wrapper ${hitTypeClass} ${burstHitClass} ${counterHitClass} ${punishHitClass} ${frozenClass}`}
              style={{
                "--charged-ring-tilt-signed": ringTiltSigned,
                "--slap-ring-tilt-signed": ringTiltSigned,
                "--knock-dir": knockDir,
              }}
            >
              {/* L1: Bloom glow (blurred underlayer for fake bloom) */}
              <div className="hit-bloom-glow" />
              {/* L2: Core flash + expanding ring */}
              <div className="hit-ring" />
              {/* L3: Held white-hot core during hitstop */}
              <div className="hit-held-core" />
              {/* L4: Secondary shockwave */}
              <div className="hit-shockwave-secondary" />
              {/* L5: Tertiary rings (staggered) */}
              {isHeavy && TERTIARY_RING_INDICES.map((i) => (
                <div key={i} className={`hit-tertiary-ring hit-tertiary-ring--${i}`} />
              ))}
              {/* L6: Directional energy streak */}
              <div className="hit-directional-streak" />
              {/* L7: Manga-style radial speed lines */}
              <div className="hit-speed-lines">
                {lineIndices.map((i) => (
                  <div key={i} className="hit-speed-line" />
                ))}
              </div>
              {/* L8: Energy sparks (elongated) */}
              <div className="spark-particles">
                {sparkIndices.map((i) => (
                  <div key={i} className="spark" />
                ))}
              </div>
              {/* L9: Debris particles */}
              <div className="hit-particles">
                {particleIndices.map((i) => (
                  <div key={i} className="particle" />
                ))}
              </div>
              {/* L10: Afterglow haze (slow lingering fade) */}
              <div className="hit-afterglow" />
            </div>
          </HitEffectContainer>
        );
      })}
    </>
  );
};

HitEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
    attackType: PropTypes.string,
    hitId: PropTypes.string,
    timestamp: PropTypes.number,
    isCounterHit: PropTypes.bool,
    isPunish: PropTypes.bool,
  }),
};

// Memoize to prevent re-renders when parent updates but position hasn't changed
export default memo(HitEffect, (prevProps, nextProps) => {
  // Only re-render if the position reference or its identifying properties change
  if (!prevProps.position && !nextProps.position) return true;
  if (!prevProps.position || !nextProps.position) return false;
  
  // Compare by hitId/timestamp to detect new hits
  return (
    prevProps.position.hitId === nextProps.position.hitId &&
    prevProps.position.timestamp === nextProps.position.timestamp
  );
});
