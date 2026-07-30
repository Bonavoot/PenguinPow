import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoAnnouncementBanner, {
  ANNOUNCEMENT_DURATION_MS,
} from "./SumoAnnouncementBanner";

/**
 * GoredBannerEffect — "MATADOR BREAK" side-rail callout when a strike hits
 * someone during a live / whiffed MATADOR (grab-line parry).
 *
 * Orange plaque (success MATADOR is gold stamp). Hero seat — same band as
 * COUNTER HIT: you punished their matador.
 */
const GoredBannerEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = ANNOUNCEMENT_DURATION_MS;

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
          <SumoAnnouncementBanner
            key={effect.id}
            text={"MATADOR BREAK"}
            type="matadorbreak"
            isLeftSide={isLeftSide}
          />
        );
      })}
    </>,
    hudEl
  );
};

GoredBannerEffect.propTypes = {
  position: PropTypes.shape({
    counterId: PropTypes.string,
    playerNumber: PropTypes.number,
  }),
};

export default memo(GoredBannerEffect);
