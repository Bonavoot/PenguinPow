import { useEffect, useState, useRef, memo } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import SumoAnnouncementBanner, {
  ANNOUNCEMENT_DURATION_MS,
} from "./SumoAnnouncementBanner";
import { announcementVisibleMs } from "./sumoAnnouncementTiming";

/**
 * ClinchCalloutEffect - Side banners that surface the invisible clinch mind
 * game as it resolves:
 *   counter_throw  — you threw an opponent mid-push (lands only)
 *   resisted       — held Plant stuffed a technique
 *   deep_grip      — you earned Deep Grip advantage
 * (Perfect Brace is a hype stamp via PerfectBraceEffect, not this rail.)
 *
 * RESISTED fires inside a live clinch loop: the beat is 100ms hitstop + 550ms
 * attacker Open, so the clinch can resume in well under a second. It reads as
 * one banner per exchange, so it retires with the beat it describes rather than
 * narrating the next one. COUNTER THROW / DEEP GRIP end an exchange instead of
 * punctuating one, and keep the standard length.
 *
 * The requested duration is a target for the HOLD, not the time on screen — the
 * shared minimum hold and slide-away exit run past it — so the visible end is
 * measured, not assumed.
 */
const RESISTED_BEAT_MS = 650; // 100ms hitstop + 550ms attacker Open

const CALLOUT_CONFIG = {
  counter_throw: { text: "COUNTER THROW", type: "counterthrow" },
  resisted: { text: "RESISTED", type: "tech", durationMs: RESISTED_BEAT_MS },
  deep_grip: { text: "DEEP GRIP", type: "deepgrip" },
};

const ClinchCalloutEffect = ({ callout }) => {
  const [activeEffects, setActiveEffects] = useState([]);
  const processedRef = useRef(new Set());
  const effectIdCounter = useRef(0);
  const pendingTimeouts = useRef([]);

  useEffect(() => {
    if (!callout || !callout.calloutId) return;
    const config = CALLOUT_CONFIG[callout.type];
    if (!config) return;
    if (processedRef.current.has(callout.calloutId)) return;

    processedRef.current.add(callout.calloutId);
    const effectId = ++effectIdCounter.current;
    const durationMs = config.durationMs || ANNOUNCEMENT_DURATION_MS;

    setActiveEffects((prev) => [
      ...prev,
      {
        id: effectId,
        type: callout.type,
        playerNumber: callout.playerNumber || 1,
        durationMs,
      },
    ]);

    // Unmount only after the slide-away has actually finished, or the plaque
    // pops off the rail instead of leaving.
    const unmountAtMs = announcementVisibleMs(durationMs / 1000) + 32;
    const tid = setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
      processedRef.current.delete(callout.calloutId);
    }, unmountAtMs);
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
            duration={effect.durationMs / 1000}
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
