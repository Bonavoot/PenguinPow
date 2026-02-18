import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";

/**
 * PunishBannerEffect - Shows the "PUNISH" side banner only when a player
 * hits an opponent during their recovery frames. No hit effect at the impact point.
 */
const PunishBannerEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1500;

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedRef.current.has(position.counterId)) return;

    processedRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      grabberPlayerNumber: position.grabberPlayerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedRef.current.delete(position.counterId);
    }, EFFECT_DURATION);
  }, [position?.counterId, position?.grabberPlayerNumber]);

  useEffect(() => {
    return () => setActiveEffects([]);
  }, []);

  const hudEl = document.getElementById('game-hud');
  if (!hudEl) return null;

  return createPortal(
    <>
      {activeEffects.map((effect) => {
        const isLeftSide = effect.grabberPlayerNumber === 1;
        return (
          <SumoAnnouncementBanner
            key={effect.id}
            text={"PUNISH"}
            type="punish"
            isLeftSide={isLeftSide}
          />
        );
      })}
    </>,
    hudEl
  );
};

PunishBannerEffect.propTypes = {
  position: PropTypes.shape({
    counterId: PropTypes.string,
    grabberPlayerNumber: PropTypes.number,
  }),
};

export default PunishBannerEffect;
