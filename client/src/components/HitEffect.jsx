import React, { useEffect, useState, useRef, useMemo, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

// Pre-create indices to avoid array recreation on every render
const SLAP_LINE_INDICES = [0, 1, 2, 3, 4];
const CHARGED_LINE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
const SLAP_SPARK_INDICES = [0, 1, 2, 3, 4, 5];
const CHARGED_SPARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];
const SLAP_PARTICLE_INDICES = [0, 1, 2, 3];
const CHARGED_PARTICLE_INDICES = [0, 1, 2, 3, 4, 5];

/* Fixed size (charged-hit size) so slap and charged share the same center – slap ring centered inside charged ring */
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

const HitEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  
  const EFFECT_DURATION_SLAP = 400;
  const EFFECT_DURATION_CHARGED = 600;

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

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      attackType,
      isCounterHit,
      isPunish,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    const duration = attackType === 'charged' ? EFFECT_DURATION_CHARGED : EFFECT_DURATION_SLAP;
    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(hitIdentifier);
    }, duration);
  }, [hitIdentifier, position?.x, position?.y, position?.facing, position?.attackType, position?.isCounterHit, position?.isPunish]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        const isCharged = effect.attackType === 'charged';
        const hitTypeClass = isCharged ? 'charged-hit' : 'slap-hit';
        const counterHitClass = effect.isCounterHit ? 'counter-hit' : '';
        const punishHitClass = effect.isPunish ? 'punish-hit' : '';
        // Mirror faux-3D tilt direction by facing for ring-based effects.
        const ringTiltSigned = effect.facing === -1 ? "55deg" : "-55deg";
        
        const lineIndices = isCharged ? CHARGED_LINE_INDICES : SLAP_LINE_INDICES;
        const sparkIndices = isCharged ? CHARGED_SPARK_INDICES : SLAP_SPARK_INDICES;
        const particleIndices = isCharged ? CHARGED_PARTICLE_INDICES : SLAP_PARTICLE_INDICES;

        return (
          <HitEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div
              className={`hit-ring-wrapper ${hitTypeClass} ${counterHitClass} ${punishHitClass}`}
              style={{
                "--charged-ring-tilt-signed": ringTiltSigned,
                "--slap-ring-tilt-signed": ringTiltSigned,
              }}
            >
              {/* Core flash + expanding ring */}
              <div className="hit-ring" />
              {/* Secondary shockwave (visible for charged, hidden for slap via CSS) */}
              <div className="hit-shockwave-secondary" />
              {/* Manga-style radial speed lines */}
              <div className="hit-speed-lines">
                {lineIndices.map((i) => (
                  <div key={i} className="hit-speed-line" />
                ))}
              </div>
              {/* Energy sparks */}
              <div className="spark-particles">
                {sparkIndices.map((i) => (
                  <div key={i} className="spark" />
                ))}
              </div>
              {/* Debris particles */}
              <div className="hit-particles">
                {particleIndices.map((i) => (
                  <div key={i} className="particle" />
                ))}
              </div>
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
