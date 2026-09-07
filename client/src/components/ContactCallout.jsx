import { useEffect, useRef, useState, memo } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import { FONT_DISPLAY, FONT_RENDER } from "./menuTheme";
import { CALLOUT_PIGMENT, withSpacedBang } from "./calloutPrimitives";

/*
 * ContactCallout — a contact-level word (COUNTER HIT / PUNISH / MATADOR
 * BREAK) that lives ON THE BODY it describes, not on the HUD.
 *
 * Why: the HUD rail put the word on the owner's HUD side for 1.5 s, so it sat
 * on the far side of the screen from the fighters, outlived the exchange it
 * described, and stacked with the next one. A contact callout is a caption
 * for ONE hit: it appears at the struck fighter's head on the impact frame,
 * pops, and is gone before the next slap cycle finishes (~0.65 s).
 *
 * Rendered inline in the actors layer (same coordinate contract as HitEffect):
 * left/bottom are map-percent; the label rides with the fighter's shove via
 * the position handed in at spawn (a caption should stay where the hit was).
 */

export const CONTACT_CALLOUT_MS = 650;
// Fighter sprite is ~157 map px tall; sit the word just above the crown.
export const CONTACT_CALLOUT_HEAD_OFFSET_PX = 168;

const LABELS = {
  counterhit: "COUNTER HIT",
  punish: "PUNISH",
  matadorbreak: "MATADOR BREAK",
};

const INK = {
  counterhit: CALLOUT_PIGMENT.counterhit,
  punish: CALLOUT_PIGMENT.punish,
  matadorbreak: CALLOUT_PIGMENT.matadorbreak,
};

const pop = keyframes`
  0%   { opacity: 0; transform: translate(-50%, 0) scale(1.35); }
  14%  { opacity: 1; transform: translate(-50%, -2px) scale(0.96); }
  26%  { opacity: 1; transform: translate(-50%, -3px) scale(1); }
  62%  { opacity: 1; transform: translate(-50%, -6px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -16px) scale(0.98); }
`;

const Anchor = styled.div`
  position: absolute;
  left: ${(p) => (p.$x / 1280) * 100}%;
  bottom: ${(p) => (p.$y / 720) * 100}%;
  transform: translate(-50%, 0);
  z-index: 103;
  pointer-events: none;
  white-space: nowrap;
  will-change: transform, opacity;
  animation: ${pop} ${CONTACT_CALLOUT_MS}ms cubic-bezier(0.2, 0.9, 0.25, 1) forwards;
`;

const Word = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.55cqw, 1.35rem);
  letter-spacing: 0.08em;
  line-height: 1;
  color: ${(p) => INK[p.$type] || CALLOUT_PIGMENT.counterhit};
  -webkit-text-stroke: clamp(1.2px, 0.16cqw, 2.2px) rgba(5, 7, 12, 0.96);
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(5, 7, 12, 0.9);
  ${FONT_RENDER}
`;

const ContactCallout = ({ callout }) => {
  const [active, setActive] = useState([]);
  const seenRef = useRef(new Set());
  const seedRef = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!callout || !callout.id) return;
    if (seenRef.current.has(callout.id)) return;
    seenRef.current.add(callout.id);
    const id = ++seedRef.current;
    const entry = {
      id,
      type: callout.type in LABELS ? callout.type : "counterhit",
      x: callout.x,
      y: callout.y,
    };
    // One word per type at a time: a restrike replaces the live one so the
    // same caption never stacks on itself.
    setActive((prev) => [...prev.filter((e) => e.type !== entry.type), entry]);
    const tid = setTimeout(() => {
      setActive((prev) => prev.filter((e) => e.id !== id));
      seenRef.current.delete(callout.id);
    }, CONTACT_CALLOUT_MS);
    timersRef.current.push(tid);
  }, [callout?.id, callout?.type, callout?.x, callout?.y]);

  // Round boundary: the owner bumps `epoch` to sweep every live word.
  useEffect(() => {
    setActive([]);
  }, [callout?.epoch]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  if (active.length === 0) return null;
  return (
    <>
      {active.map((e) => (
        <Anchor key={e.id} $x={e.x} $y={e.y}>
          <Word $type={e.type}>{withSpacedBang(LABELS[e.type])}</Word>
        </Anchor>
      ))}
    </>
  );
};

ContactCallout.propTypes = {
  callout: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.oneOf(["counterhit", "punish", "matadorbreak"]),
    x: PropTypes.number,
    y: PropTypes.number,
    epoch: PropTypes.number,
  }),
};

export default memo(ContactCallout);
