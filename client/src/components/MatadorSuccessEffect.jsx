import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoHypeStamp, { HYPE_DURATION_MS } from "./SumoHypeStamp";

/**
 * MatadorSuccessEffect — "MATADOR" hype mark when a grab-line parry lands
 * (instant pull). Peer to PERFECT on the combo-counter band.
 * Gold rail; MATADOR BREAK (orange combat slab) is the opposite RPS punish.
 */
const MatadorSuccessEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = HYPE_DURATION_MS;

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedRef.current.has(position.counterId)) return;

    processedRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      playerNumber: position.playerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedRef.current.delete(position.counterId);
    }, EFFECT_DURATION);
  }, [position?.counterId, position?.playerNumber]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  const hudEl = document.getElementById("game-hud-callouts");
  if (!hudEl) return null;

  return createPortal(
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.playerNumber === 1;
        return (
          <SumoHypeStamp
            key={effect.id}
            type="matador"
            text={"MATADOR"}
            isLeftSide={isLeftSide}
          />
        );
      })}
    </>,
    hudEl
  );
};

MatadorSuccessEffect.propTypes = {
  position: PropTypes.shape({
    counterId: PropTypes.string,
    playerNumber: PropTypes.number,
  }),
};

export default memo(MatadorSuccessEffect);
