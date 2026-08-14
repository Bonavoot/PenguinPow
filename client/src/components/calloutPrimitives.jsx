import PropTypes from "prop-types";
import { useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { HUD } from "./menuTheme";

/*
 * Shared geometry + copy for combat slabs and hype marks.
 *
 * Combat chrome copies UiPlayerInfo BarFrame + BarTrack, on a parallelogram:
 *   1px ink (box-shadow keyline)
 *   HUD.stroke cream (the border)
 *   1px ink inset (BarTrack border)
 *   pigment fill
 *
 * Drawn in pixel space so those widths stay even on the slant. A stretched
 * 0–100 viewBox made cream fat on the horizontals and vanish on the rakes.
 */

export const CALLOUT_KEYLINE = HUD.keyline;
export const CALLOUT_CREAM = HUD.heroType;

export const withSpacedBang = (text) => {
  if (typeof text !== "string") return text;
  if (/\u00A0!+\s*$/.test(text) || /\s!+\s*$/.test(text)) {
    return text.replace(/\s*!+\s*$/, "\u00A0!");
  }
  return `${text.replace(/\s*!+\s*$/, "")}\u00A0!`;
};

export const parallelogramPoints = (slant = 8, insetX = 2.4, insetY = 8) => {
  return `${insetX + slant},${insetY} ${100 - insetX},${insetY} ${100 - insetX - slant},${100 - insetY} ${insetX},${100 - insetY}`;
};

/*
 * Pixel-space parallelogram. `slant` is the top-edge x-shift in px.
 * `d` is a perpendicular inset in px — same width on horizontals and rakes.
 *
 * Horizontal inset is (L + slant) / h, not L / h. Shrinking the top and
 * bottom by `d` already closes the rake gap; using only L/h made the
 * sides ~30% thinner than the stamina-bar cream.
 */
const paraPx = (w, h, slant, d) => {
  const innerH = h - 2 * d;
  if (w <= 2 || innerH <= 1) return null;
  const L = Math.hypot(slant, h) || h;
  const hx = ((L + slant) / h) * d;
  const innerSlant = slant * (innerH / h);
  const top = d;
  const bot = h - d;
  const lt = hx + innerSlant;
  const lb = hx;
  const rt = w - hx;
  const rb = w - hx - innerSlant;
  if (lt >= rt || lb >= rb) return null;
  return `${lt},${top} ${rt},${top} ${rb},${bot} ${lb},${bot}`;
};

const Root = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

/* Same rule as UiPlayerInfo BarFrame: `border: ${HUD.stroke} solid …`.
   We read the computed border-top-width so cream is that exact pixel size. */
const StrokeProbe = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  border: ${HUD.stroke} solid transparent;
`;

const FillSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  pointer-events: none;
`;

export const CalloutParallelogram = ({
  color,
  slant = 8,
  strokeWidth = 2,
  insetY = 8,
  chrome = false,
}) => {
  const svgRef = useRef(null);
  const probeRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0, cream: 0 });

  useLayoutEffect(() => {
    if (!chrome) return undefined;
    const svg = svgRef.current;
    const probe = probeRef.current;
    if (!svg || !probe) return undefined;

    const sync = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const cream = parseFloat(getComputedStyle(probe).borderTopWidth);
      setBox({
        w: width,
        h: height,
        cream: Number.isFinite(cream) && cream > 0 ? cream : 1.6,
      });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [chrome]);

  if (!chrome) {
    const pts = parallelogramPoints(slant, 2.4, insetY);
    return (
      <FillSvg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon
          points={pts}
          fill={color}
          stroke={strokeWidth > 0 ? CALLOUT_KEYLINE : "none"}
          strokeWidth={strokeWidth}
          strokeLinejoin="miter"
          strokeMiterlimit={2.2}
          vectorEffect="non-scaling-stroke"
        />
      </FillSvg>
    );
  }

  const { w, h, cream } = box;
  const slantPx = w * (slant / 100);
  /* Outer 1px ink, cream, inner 1px ink — same stack as BarFrame + BarTrack. */
  const outerInk = 1;
  const innerInk = 1;
  const d0 = 1;
  const d1 = d0 + outerInk;
  const d2 = d1 + cream;
  const d3 = d2 + innerInk;

  const p0 = w > 0 ? paraPx(w, h, slantPx, d0) : null;
  const p1 = w > 0 ? paraPx(w, h, slantPx, d1) : null;
  const p2 = w > 0 ? paraPx(w, h, slantPx, d2) : null;
  const p3 = w > 0 ? paraPx(w, h, slantPx, d3) : null;
  const ready = cream > 0 && p0 && p1 && p2 && p3;
  const viewBox = w > 0 ? `0 0 ${w} ${h}` : "0 0 1 1";

  return (
    <Root>
      <StrokeProbe ref={probeRef} aria-hidden />
      <FillSvg ref={svgRef} viewBox={viewBox} aria-hidden>
        {ready && (
          <>
            <polygon points={p0} fill={CALLOUT_KEYLINE} />
            <polygon points={p1} fill={HUD.chrome} />
            <polygon points={p2} fill={CALLOUT_KEYLINE} />
            <polygon points={p3} fill={color} />
          </>
        )}
      </FillSvg>
    </Root>
  );
};

CalloutParallelogram.propTypes = {
  color: PropTypes.string.isRequired,
  slant: PropTypes.number,
  strokeWidth: PropTypes.number,
  insetY: PropTypes.number,
  chrome: PropTypes.bool,
};
