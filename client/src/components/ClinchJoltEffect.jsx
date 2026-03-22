import { useEffect, useState, useRef, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./ClinchJoltEffect.css";

const LINE_INDICES = [0, 1, 2, 3, 4];
const SPARK_INDICES = [0, 1, 2, 3, 4];
const PARTICLE_INDICES = [0, 1, 2, 3];

const JoltEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100}%;
  bottom: ${props => (props.$y / 720) * 100}%;
  width: 2.0cqw;
  height: 2.0cqw;
  transform: translate(-50%, 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
`;

const ClinchJoltEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedJoltsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);

  const EFFECT_DURATION = 450;

  useEffect(() => {
    if (!position || !position.joltId) return;
    if (processedJoltsRef.current.has(position.joltId)) return;

    processedJoltsRef.current.add(position.joltId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.direction || 1,
      isMutual: position.isMutual || false,
    };

    setActiveEffects(prev => [...prev, newEffect]);

    const tid = setTimeout(() => {
      setActiveEffects(prev => prev.filter(e => e.id !== effectId));
      processedJoltsRef.current.delete(position.joltId);
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [position?.joltId, position?.x, position?.y, position?.direction, position?.isMutual]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map(effect => {
        const ringTiltSigned = effect.facing === -1 ? "55deg" : "-55deg";
        const mutualClass = effect.isMutual ? "mutual-jolt" : "";

        return (
          <JoltEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div
              className={`clinch-jolt-wrapper ${mutualClass}`}
              style={{ "--jolt-ring-tilt-signed": ringTiltSigned }}
            >
              <div className="jolt-ring" />
              <div className="jolt-shockwave-secondary" />
              <div className="clinch-jolt-speed-lines">
                {LINE_INDICES.map(i => (
                  <div key={i} className="clinch-jolt-speed-line" />
                ))}
              </div>
              <div className="clinch-jolt-sparks">
                {SPARK_INDICES.map(i => (
                  <div key={i} className="jolt-spark" />
                ))}
              </div>
              <div className="clinch-jolt-particles">
                {PARTICLE_INDICES.map(i => (
                  <div key={i} className="jolt-particle" />
                ))}
              </div>
            </div>
          </JoltEffectContainer>
        );
      })}
    </>
  );
};

ClinchJoltEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    joltId: PropTypes.string,
    direction: PropTypes.number,
    isMutual: PropTypes.bool,
  }),
};

export default memo(ClinchJoltEffect, (prevProps, nextProps) => {
  if (!prevProps.position && !nextProps.position) return true;
  if (!prevProps.position || !nextProps.position) return false;
  return prevProps.position.joltId === nextProps.position.joltId;
});
