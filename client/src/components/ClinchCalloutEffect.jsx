import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoAnnouncementBanner, {
  ANNOUNCEMENT_DURATION_MS,
} from "./SumoAnnouncementBanner";

/**
 * ClinchCalloutEffect - Side banners that surface the invisible clinch mind
 * game as it resolves:
 *   counter_throw  — you threw an opponent mid-push (lands only)
 *   resisted       — held Plant stuffed a technique
 *   deep_grip      — you earned Deep Grip advantage
 * (Perfect Brace is a hype stamp via PerfectBraceEffect, not this rail.)
 */
const CALLOUT_CONFIG = {
  counter_throw: { text: "COUNTER THROW", type: "counterthrow" },
  resisted: { text: "RESISTED", type: "tech" },
  deep_grip: { text: "DEEP GRIP", type: "deepgrip" },
};

const ClinchCalloutEffect = ({ callout }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);
  const EFFECT_DURATION = ANNOUNCEMENT_DURATION_MS;

  useEffect(() => {
    if (!callout || !callout.calloutId) return;
    if (!CALLOUT_CONFIG[callout.type]) return;
    if (processedRef.current.has(callout.calloutId)) return;

    processedRef.current.add(callout.calloutId);
    const effectId = ++effectIdCounter.current;

    setActiveEffects((prev) => [
      ...prev,
      {
        id: effectId,
        type: callout.type,
        playerNumber: callout.playerNumber || 1,
      },
    ]);

    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedRef.current.delete(callout.calloutId);
    }, EFFECT_DURATION);
    pendingTimeouts.current.push(tid);
  }, [callout?.calloutId, callout?.type, callout?.playerNumber]);

  useEffect(() => {
    return () => {
      pendingTimeouts.current.forEach(clearTimeout);
      setActiveEffects([]);
    };
  }, []);

  const hudEl = document.getElementById("game-hud-callouts");
  if (!hudEl) return null;

  return createPortal(
    <>
      {activeEffects.map((effect) => {
        const config = CALLOUT_CONFIG[effect.type];
        return (
          <SumoAnnouncementBanner
            key={effect.id}
            text={config.text}
            type={config.type}
            isLeftSide={effect.playerNumber === 1}
          />
        );
      })}
    </>,
    hudEl
  );
};

ClinchCalloutEffect.propTypes = {
  callout: PropTypes.shape({
    calloutId: PropTypes.string,
    type: PropTypes.oneOf(["counter_throw", "resisted", "deep_grip"]),
    playerNumber: PropTypes.number,
  }),
};

export default memo(ClinchCalloutEffect);
