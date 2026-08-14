import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoHypeStamp, { HYPE_DURATION_MS } from "./SumoHypeStamp";

/**
 * PerfectBraceEffect — PERFECT BRACE hype mark (same combo-counter
 * register as PERFECT parry). Fired when a timed Plant beats a throw/pull.
 */
const PerfectBraceEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = HYPE_DURATION_MS;

  useEffect(() => {
    if (!position || !position.braceId) return;
    if (processedRef.current.has(position.braceId)) return;

    processedRef.current.add(position.braceId);
    const effectId = ++effectIdCounter.current;

    setActiveEffects((prev) => [
      ...prev,
      {
        id: effectId,
        playerNumber: position.playerNumber || 1,
      },
    ]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedRef.current.delete(position.braceId);
    }, EFFECT_DURATION);
  }, [position?.braceId, position?.playerNumber]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  const hudEl = document.getElementById("game-hud-callouts");
  if (!hudEl) return null;

  return createPortal(
    <>
      {activeEffects.map((effect) => (
        <SumoHypeStamp
          key={effect.id}
          type="perfectbrace"
          isLeftSide={effect.playerNumber === 1}
        />
      ))}
    </>,
    hudEl
  );
};

PerfectBraceEffect.propTypes = {
  position: PropTypes.shape({
    braceId: PropTypes.string,
    playerNumber: PropTypes.number,
  }),
};

export default memo(PerfectBraceEffect);
