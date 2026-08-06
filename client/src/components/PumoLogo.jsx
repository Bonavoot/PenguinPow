import PropTypes from "prop-types";
import styled from "styled-components";
import { FONT_DISPLAY, FONT_RENDER } from "./menuTheme";

/*
 * Brand mark — Bungee "PUMO" / "PUMO" stack + tall red bang.
 * Replaces the AI PNG so the logo stays crisp at any scale.
 *
 * Colors / proportions sampled from assets/pumo-logo.png:
 *   top fill  #4b4b50 · bottom fill #fff · bang #fa3232
 */

const LOGO_STROKE = `
  -webkit-text-stroke: clamp(4.5px, 0.7cqw, 12px) #000;
  paint-order: stroke fill;
`;

const Mark = styled.h1`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  margin: 0;
  /* Symmetric pad — asymmetric right pad was shifting the flex box
   * center away from the painted mark (rule / CONNECTING looked off). */
  padding: 0.08em 0.1em 0.07em;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) => p.$fontSize};
  font-weight: 400;
  line-height: 0.9;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  user-select: none;
  ${FONT_RENDER}
  filter: ${(p) => p.$filter};

  ${(p) =>
    p.$preset === "startup"
      ? `
    @media (max-width: 600px) {
      font-size: clamp(2.8rem, 14cqw, 4.6rem);
    }
  `
      : ""}
`;

const Stack = styled.span`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Word = styled.span`
  color: ${(p) => p.$color};
  ${LOGO_STROKE}
`;

/*
 * Stack line boxes are 1.8em (2 × lh 0.9), but Bungee's ! ink only fills
 * ~80% of the em — size up so the painted glyph spans the stack.
 *
 * scaleX does not affect layout. Without a compensating margin, the flex
 * item keeps the full unscaled advance and parents that center on the mark
 * (BrandRule, CONNECTING, etc.) sit right of the painted logo.
 * Bungee "!" advance is ~0.55em at this size (stroke included).
 */
const BANG_SCALE_X = 0.78;
const BANG_ADVANCE_EM = 0.55;

const Bang = styled.span`
  display: block;
  margin-left: -0.02em;
  margin-right: calc(${BANG_ADVANCE_EM}em * (${BANG_SCALE_X} - 1));
  color: #fa3232;
  font-size: 2.25em;
  line-height: 1;
  transform: scaleX(${BANG_SCALE_X});
  transform-origin: left center;
  ${LOGO_STROKE}
`;

const DEFAULT_MENU_FILTER = `
  drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))
  drop-shadow(0 10px 20px rgba(0, 0, 0, 0.22))
`;

const DEFAULT_SNOW_FILTER = `
  drop-shadow(0 4px 0 rgba(15, 29, 46, 0.22))
  drop-shadow(0 10px 22px rgba(15, 29, 46, 0.28))
`;

const SIZE_PRESETS = {
  menu: "clamp(3.55rem, 7.6cqw, 5.5rem)",
  startup: "clamp(3.55rem, 9.6cqw, 6.4rem)",
};

const FILTER_PRESETS = {
  menu: DEFAULT_MENU_FILTER,
  startup: DEFAULT_SNOW_FILTER,
};

function PumoLogo({ size = "menu", fontSize, filter, className }) {
  return (
    <Mark
      className={className}
      $preset={size}
      $fontSize={fontSize || SIZE_PRESETS[size] || SIZE_PRESETS.menu}
      $filter={filter || FILTER_PRESETS[size] || FILTER_PRESETS.menu}
      aria-label="Pumo Pumo!"
    >
      <Stack>
        <Word $color="#4b4b50">PUMO</Word>
        <Word $color="#ffffff">PUMO</Word>
      </Stack>
      <Bang aria-hidden>!</Bang>
    </Mark>
  );
}

PumoLogo.propTypes = {
  size: PropTypes.oneOf(["menu", "startup"]),
  fontSize: PropTypes.string,
  filter: PropTypes.string,
  className: PropTypes.string,
};

export default PumoLogo;
