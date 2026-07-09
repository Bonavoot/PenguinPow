import { memo, forwardRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import { C } from "./menuTheme";

/*
 * Grip-up prompt for the local player while grabbed without a grip.
 *   Normal grab:   [M2] GRIP!  — press Mouse2 to establish your grip
 *   Counter-grab:  CLAMPED!    — arms pinned; grip is granted automatically
 *                                when the clamp releases
 *
 * Visual language matches the rest of the callout family:
 *   - Bungee + sumi stencil stroke + hard color shelf (SumoAnnouncementBanner
 *     headline recipe, scaled down)
 *   - keycap chip uses the HUD GASSED-stamp plate recipe (solid ink plate,
 *     deep border, inset hairline)
 *   - CLAMPED wears the countergrab pink/purple theme; the clamp crackle
 *     particles carry the energy, so the text itself stays steady.
 *
 * Position is driven imperatively by GameFighter's rAF interpolation loop
 * (same as the fighter sprite) via the forwarded ref — the attrs formula
 * below only sets the initial frame and must mirror the rAF write exactly.
 */

const promptPulse = keyframes`
  0%, 100% {
    transform: skewX(-4deg) scale(1);
  }
  50% {
    transform: skewX(-4deg) scale(1.07);
  }
`;

const stampIn = keyframes`
  0% {
    opacity: 0;
    transform: skewX(-4deg) scale(1.6);
  }
  60% {
    opacity: 1;
    transform: skewX(-4deg) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: skewX(-4deg) scale(1);
  }
`;

const EffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 + 2}%`,
    bottom: `${(props.$y / 720) * 100 + 27}%`,
    transform: "translateX(-50%)",
    zIndex: 1002,
    pointerEvents: "none",
    opacity: props.$isActive ? 1 : 0,
    transition: "opacity 0.1s ease-out",
    willChange: "left, bottom",
  },
}))`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4cqw;
`;

/* Inner motion wrapper — the outer container's transform is owned by the
   positioning system (translateX centering), so entrance/pulse animation
   lives one level down where it can't fight the rAF position writes. */
const PromptMotion = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4cqw;
  animation:
    ${stampIn} 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    ${promptPulse} 0.9s ease-in-out 0.22s infinite;
`;

/* Input chip — GASSED-stamp plate recipe: solid ink, deep border, inset
   hairline. Reads as game chrome, not a web keycap. */
const KeyCap = styled.div`
  font-family: "Bungee", cursive;
  font-size: 0.95cqw;
  color: ${C.cream};
  background: ${C.inkPanelStrong};
  border: 1.5px solid rgba(245, 236, 217, 0.35);
  border-radius: 2px;
  padding: 0.14cqw 0.4cqw;
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(245, 236, 217, 0.12);
`;

/* Headline — the banner MainText recipe at prompt scale: colored Bungee,
   sumi stencil stroke, hard deep-color shelf beneath the glyphs. */
const PromptText = styled.div`
  font-family: "Bungee", cursive;
  font-size: 1.25cqw;
  color: ${(props) => (props.$clamped ? "#ff4477" : "#ffd94d")};
  letter-spacing: 0.04em;
  line-height: 0.9;
  text-shadow:
    -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
    0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
    -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
    -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
    0 2px 0 ${(props) => (props.$clamped ? "#5e2bb3" : "#a07020")},
    0 4px 6px rgba(0, 0, 0, 0.45);
`;

const GripPromptEffect = forwardRef(function GripPromptEffect(
  { x, y, isActive, isClamped },
  ref
) {
  if (!isActive || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <EffectContainer ref={ref} $x={x} $y={y} $isActive={isActive}>
      <PromptMotion key={isClamped ? "clamped" : "grip"}>
        {!isClamped && <KeyCap>M2</KeyCap>}
        <PromptText $clamped={isClamped}>
          {isClamped ? "CLAMPED!" : "GRIP!"}
        </PromptText>
      </PromptMotion>
    </EffectContainer>
  );
});

GripPromptEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  isClamped: PropTypes.bool,
};

export default memo(GripPromptEffect);
