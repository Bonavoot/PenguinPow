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
  width: 4cqw;
  height: 4cqw;
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
  const gameActorsRef = useRef(null);

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
    const isArmorBreak = position.isArmorBreak || false;
    const isPowered = position.isPowered || false;

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

    // Chromatic burst on .game-scene: charged + cinematic always get it; counter/punish
    // ALSO get it (regardless of attack type) so reads like "you got caught lacking" pop visually.
    // The wrestlers now live in .game-actors (a separate camera layer above the
    // player-info HUD), so punch BOTH layers in lockstep or the players wouldn't aberrate.
    if (isCinematic || attackType === 'charged' || isCounterHit || isPunish) {
      if (!gameSceneRef.current) {
        gameSceneRef.current = document.querySelector('.game-scene');
      }
      if (!gameActorsRef.current) {
        gameActorsRef.current = document.querySelector('.game-actors');
      }
      const layers = [gameSceneRef.current, gameActorsRef.current].filter(Boolean);
      if (layers.length) {
        layers.forEach((el) => el.classList.add('hit-chromatic'));
        // Punish gets a noticeably longer chromatic tail — it's the "learn from this" hit.
        const chromDuration = isCinematic ? 200 : (isPunish ? 160 : (isCounterHit ? 130 : 100));
        const chromTid = setTimeout(
          () => layers.forEach((el) => el.classList.remove('hit-chromatic')),
          chromDuration
        );
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
        const hitTypeClass = isCharged ? 'charged-hit' : (isBurst ? 'burst-hit' : 'slap-hit');
        const counterHitClass = effect.isCounterHit ? 'counter-hit' : '';
        const punishHitClass = effect.isPunish ? 'punish-hit' : '';
        // Charged attack shattering grab armor — recolor the hit glow to
        // white/yellow to visually link it to the glass-shard armor break.
        const armorBreakClass = effect.isArmorBreak ? 'armor-break' : '';
        // POWER power-up — recolor the NORMAL white hit glow to red. Counter,
        // punish, and armor-break keep their own special reads (they take
        // precedence), so this only paints the plain confirms red.
        const poweredClass =
          effect.isPowered &&
          !effect.isCounterHit &&
          !effect.isPunish &&
          !effect.isArmorBreak
            ? 'powered-hit'
            : '';
        const frozenClass = effect.frozen ? 'cinematic-frozen' : '';
        // Faux-3D tilt — signed by facing so the ring plane angles toward the
        // struck side (same rotateY trick the raw-parry ring uses).
        const ringTiltSigned = effect.facing === -1 ? '55deg' : '-55deg';

        // Hit VFX is a white-hot sibling of the raw-parry glow: a tilted
        // glowing ring + inner flash, a soft bloom, a held core, and an
        // afterglow — clean and simple, NOT a stacked blob. A thin dark
        // keyline (in CSS) keeps the white shapes readable over the
        // penguins' white bellies. The fast directional IMPACT SPARKS that
        // fly out through the ring are emitted on the canvas particle engine
        // (hitSparkSlap / hitSparkBurst / hitSparkCharged) for real motion.
        // Counter / punish / armor-break recolor the glow for special reads.
        return (
          <HitEffectContainer
            key={effect.id}
            $x={effect.x}
            $y={effect.y}
            $facing={effect.facing}
          >
            <div
              className={`hit-ring-wrapper ${hitTypeClass} ${counterHitClass} ${punishHitClass} ${armorBreakClass} ${poweredClass} ${frozenClass}`}
              style={{ "--hit-ring-tilt-signed": ringTiltSigned }}
            >
              <div className="hit-bloom-glow" />
              <div
                className="hit-ring"
                style={{ transform: effect.facing === 1 ? "scaleX(-1)" : "scaleX(1)" }}
              />
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
