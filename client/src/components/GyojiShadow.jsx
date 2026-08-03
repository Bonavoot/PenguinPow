import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import IceReflection from "./IceReflection";
import {
  GYOJI_FOOT_BOTTOM_PCT,
  GYOJI_LEFT_PCT,
  GYOJI_WIDTH_PCT,
} from "./gyojiLayout";

const GYOJI_WIDTH = `${GYOJI_WIDTH_PCT}%`;

// Lift under the sandals — too low reads "in front of him" on the ice plane;
// too high mashes into the kimono as a blob.
const GYOJI_REFLECTION_RAISE_PCT = 3.6;

// Quieter than fighters (0.28) — supporting cast, not a second focal point.
const GYOJI_REFLECTION_OPACITY = 0.15;
// Slightly taller foreshorten than fighters so a front-facing figure still
// reads as a reflection puddle instead of a flat oval smudge.
const GYOJI_REFLECTION_SQUASH = 0.4;

/**
 * Ice reflection under the gyoji — same treatment as fighters, quieter and
 * planted under the feet. Portaled into `.ice-reflection-clip` so it stays on
 * the ice and stacks under the sprite.
 */
const GyojiShadow = ({ src }) => {
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
      bottomPct={GYOJI_FOOT_BOTTOM_PCT + GYOJI_REFLECTION_RAISE_PCT}
      anchorLeftEdge
      opacity={GYOJI_REFLECTION_OPACITY}
      squash={GYOJI_REFLECTION_SQUASH}
      zIndex={1}
    />
  );

  return iceClipHost ? createPortal(node, iceClipHost) : node;
};

GyojiShadow.propTypes = {
  gyojiState: PropTypes.string.isRequired,
  src: PropTypes.string,
};

export default GyojiShadow;
