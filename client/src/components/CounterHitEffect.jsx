import { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";

/**
 * CounterHitEffect - Shows the "COUNTER HIT" side banner when a player's
 * active frames hit an opponent during their attack startup frames.
 * 
 * The visual hit effect (orange burst) is handled by HitEffect.jsx.
 * This component only handles the side text banner display.
 */
const CounterHitEffect = ({ position }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedHitsRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const EFFECT_DURATION = 1500; // Duration for the banner

  useEffect(() => {
    if (!position || !position.counterId) return;

    if (processedHitsRef.current.has(position.counterId)) {
      return;
    }

    processedHitsRef.current.add(position.counterId);
    const effectId = ++effectIdCounter.current;

    const newEffect = {
      id: effectId,
      playerNumber: position.playerNumber || 1,
    };

    setActiveEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedHitsRef.current.delete(position.counterId);
    }, EFFECT_DURATION);
  }, [position?.counterId, position?.playerNumber]);

  useEffect(() => {
    return () => {
      setActiveEffects([]);
    };
  }, []);

  return (
    <>
      {activeEffects.map((effect) => {
        // Player 1's text appears on the LEFT, Player 2's text appears on the RIGHT
        const isLeftSide = effect.playerNumber === 1;
        
        return (
          <SumoAnnouncementBanner
            key={effect.id}
            text={"COUNTER\nHIT"}
            type="counterhit"
            isLeftSide={isLeftSide}
          />
        );
      })}
    </>
  );
};

CounterHitEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    counterId: PropTypes.string,
    playerNumber: PropTypes.number,
    timestamp: PropTypes.number,
  }),
};

export default CounterHitEffect;
