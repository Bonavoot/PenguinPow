import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import IceReflection from "./IceReflection";
import {
  GYOJI_FOOT_BOTTOM_PCT,
  GYOJI_LEFT_PCT,
  GYOJI_WIDTH_PCT,
} from "./gyojiLayout";

const GYOJI_WIDTH = `${GYOJI_WIDTH_PCT}%`;

// Quieter than fighters (0.44) — supporting cast, not a second focal point.
const GYOJI_REFLECTION_OPACITY = 0.15;
const GYOJI_REFLECTION_SQUASH = 0.5;

/**
 * Transparent padding under the painted sandals, as % of the 720-tall arena.
 * Measured from opaque sole pixels in the 960² sheets (idle is cropped
 * tighter to the tabi than ready / win). Raise = pad × (1 + squash) plus a
 * small receding-ice nudge so the flipped soles sit under the real ones.
 */
const GYOJI_SOLE_PAD_ARENA_PCT = {
  idle: 0.51,
  ready: 1.37,
  player1Win: 1.26,
  player2Win: 1.29,
};
const GYOJI_REFLECTION_PLANE_NUDGE_PCT = {
  idle: 1.25,
  ready: 0,
  player1Win: 0.2,
  player2Win: 0.2,
};

function reflectionRaisePct(pose) {
  const pad =
    GYOJI_SOLE_PAD_ARENA_PCT[pose] ?? GYOJI_SOLE_PAD_ARENA_PCT.idle;
  const nudge =
    GYOJI_REFLECTION_PLANE_NUDGE_PCT[pose] ??
    GYOJI_REFLECTION_PLANE_NUDGE_PCT.idle;
  return pad * (1 + GYOJI_REFLECTION_SQUASH) + nudge;
}

/**
 * Ice reflection under the gyoji — same mirror as fighters, quieter and
 * planted under the feet. No contact sparkles (supporting cast). Portaled
 * into `.ice-reflection-clip`.
 */
const GyojiShadow = ({ pose = "idle", src }) => {
  if (!src) return null;

  const iceClipHost =
    typeof document !== "undefined"
      ? document.querySelector(".ice-reflection-clip")
      : null;

  const node = (
    <IceReflection
      x={640}
      y={0}
      facing={1}
      src={src}
      width={GYOJI_WIDTH}
      leftPct={GYOJI_LEFT_PCT}
      bottomPct={GYOJI_FOOT_BOTTOM_PCT + reflectionRaisePct(pose)}
      anchorLeftEdge
      opacity={GYOJI_REFLECTION_OPACITY}
      squash={GYOJI_REFLECTION_SQUASH}
      zIndex={1}
      contactFx={false}
    />
  );

  return iceClipHost ? createPortal(node, iceClipHost) : node;
};

GyojiShadow.propTypes = {
  pose: PropTypes.string,
  src: PropTypes.string,
};

export default GyojiShadow;
