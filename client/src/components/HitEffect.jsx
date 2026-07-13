import React, { useEffect, useState, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

// Fixed container (sized to the largest tier) so every hit shares one
// center point — same approach as RawParryEffectContainer.
const HitEffectContainer = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100 + (props.$facing === 1 ? -8 : -3)}%;
  bottom: ${props => (props.$y / 720) * 100}%;
  width: 3.85cqw;
  height: 3.85cqw;
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

    const isArmorBreak = position.isArmorBreak || false;
    const isPowered = position.isPowered || false;

    const isHeavy = attackType === 'charged' || isCinematic;

    const newEffect = {
      id: effectId,
      x: position.x,
      y: position.y,
      facing: position.facing || 1,
      attackType,
      isCounterHit,
      isPunish,
      isArmorBreak,
      isPowered,
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

    // PERF (freeze fix): the full-scene "chromatic" color punch was REMOVED.
    // It added `filter:` to two full-viewport layers (.game-scene + .game-actors)
    // on every charged/counter/punish hit — forcing the browser to allocate
    // offscreen GPU buffers, filter them for ~100ms, then tear down, EVERY hit.
    // That per-hit layer thrash was the recurring charged-hit hiccup (slaps never
    // got it, which is why slaps never hiccuped). It was only a subtle ~100ms
    // saturate/contrast/brightness bump — the actual impact reads (impact ring,
    // shockwave, spark burst, impact flash, camera shake + zoom punch, hitstop)
    // all remain. Cinematic kills keep the bespoke `.ko-grade-punch` grade and
    // perfect parries keep their cyan flash (both in Game.jsx) — those are rare,
    // not per-hit, so they don't cause the repeating hiccup.

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
  }, [hitIdentifier, position?.x, position?.y, position?.facing, position?.attackType, position?.isCounterHit, position?.isPunish, position?.isArmorBreak, position?.cinematicKill]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      pendingTimeouts.current = [];
      if (impactFrameTimeoutRef.current) clearTimeout(impactFrameTimeoutRef.current);
      setActiveEffects([]);
      setImpactFrame(null);
    };
  }, []);

  // TEMP: the old CSS hit rings (slap / charged / burst / powered / counter /
  // punish) are fully suppressed — every hit now renders the new sprite-sheet
  // burst (SlapHitSpriteEffect). Only the cinematic KO screen-flash portal
  // remains here. `activeEffects` is still tracked so the cinematic freeze
  // bookkeeping keeps working; it just isn't drawn as a ring anymore.
  return (
    <>
      {impactFrame && createPortal(
        <ImpactFrame
          className={`impact-frame impact-frame--${impactFrame}`}
        />,
        document.getElementById("game-hud") || document.body
      )}
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
