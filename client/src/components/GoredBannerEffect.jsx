import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoAnnouncementBanner, {
  ANNOUNCEMENT_DURATION_MS,
} from "./SumoAnnouncementBanner";

/**
 * GoredBannerEffect — "GORED" side banner when a strike hits someone during
 * a live / whiffed MATADOR (grab-line parry). The grab-line counterpart to
 * CLAMPED: special RPS punish callout, not a normal COUNTER HIT / PUNISH.
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
            text={"GORED"}
            type="gored"
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
