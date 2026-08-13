/**
 * Canvas renderer for the in-game balance (stance / posture) gauge.
 *
 * Zero is the cliff — like stamina emptying. Fill color ramps
 * ice → gold → vermillion as composure drains, and that ramp is the
 * whole read: no threshold notches, no painted kill/throw bands.
 *
 * Draws the INTERIOR only. The frame is a CSS border on GaugeShell so it
 * is the same opaque-cream-over-keyline declaration as the stamina bar
 * (and so it isn't stroked at sub-CSS-pixel widths on hi-dpi displays,
 * which is what made this gauge nearly invisible).
 *
 * The fill is segmented rather than smooth — dark dividers cut it into
 * cells so posture reads as a resource with discrete states you can
 * count at a glance, rather than as a generic progress bar.
 */

import { C, HUD } from "./menuTheme";

export const KILL_THRESHOLD = 0.15;
/** @deprecated Clinch Flow — throws no longer use a land threshold */
export const THROW_THRESHOLD = 0.15;
/** @deprecated Clinch Flow — Deep Grip no longer raises a land threshold */
export const DEEP_GRIP_THROW_THRESHOLD = 0.15;
const DANGER_SOFT = 0.4; // warm fill tint below this — "you're getting soft"

const INK = HUD.well;

/** Cells the posture track is divided into. */
const SEGMENTS = 5;

/** Zone palette — reads at a glance without any well paint. */
function zoneColors(zone) {
  if (zone === "kill") {
    return {
      tip: "#ff9a8c",
      mid: C.vermillionBright,
      deep: C.vermillionDeep,
      edge: "#ffd2c3",
    };
  }
  if (zone === "throw") {
    return {
      tip: "#ffe59a",
      mid: C.gold,
      deep: C.goldDeep,
      edge: "#fff4c8",
    };
  }
  return {
    tip: "#b8e0f2",
    mid: C.postureBright,
    deep: C.postureMid,
    edge: "#f5fcff",
  };
}

/** Flat composure fill — one horizontal hue ramp, no lip, no floor shade. */
function drawComposureFill(ctx, fx, fy, fw, fh, colors, isRight) {
  if (fw < 0.5 || fh < 0.5) return;
  const body = ctx.createLinearGradient(
    isRight ? fx + fw : fx,
    0,
    isRight ? fx : fx + fw,
    0
  );
  body.addColorStop(0, colors.tip);
  body.addColorStop(0.55, colors.mid);
  body.addColorStop(1, colors.deep);
  ctx.fillStyle = body;
  ctx.fillRect(fx, fy, fw, fh);
}

/** Crisp leading tip — the eye lands here; posture level is unmistakable. */
function drawLeadingTip(ctx, fx, fy, fw, fh, isRight, edgeColor, px) {
  if (fw < px) return;
  const tipW = px * 1.5;
  const tipX = isRight ? fx + fw - tipW : fx;
  ctx.fillStyle = edgeColor;
  ctx.fillRect(tipX, fy, tipW, fh);
}

/** Segment dividers — dark keylines cutting the full height of the track. */
function drawSegments(ctx, x, y, w, h, px) {
  const lineW = Math.max(1, Math.round(px));
  ctx.fillStyle = "rgba(4, 6, 12, 0.7)";
  for (let i = 1; i < SEGMENTS; i++) {
    const sx = Math.round(x + (w * i) / SEGMENTS - lineW / 2);
    ctx.fillRect(sx, y, lineW, h);
  }
}

function drawGainVfx(ctx, fx, fy, fw, fh, gainT, isRight) {
  if (gainT == null || gainT < 0 || gainT > 1) return;
  const flash =
    gainT < 0.18
      ? gainT / 0.18
      : gainT < 0.6
        ? 1 - (gainT - 0.18) * 0.35
        : Math.max(0, 1 - (gainT - 0.6) / 0.4);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  ctx.fillStyle = `rgba(220,228,238,${0.38 * flash})`;
  ctx.fillRect(fx, fy, fw, fh);
  const sweepP = Math.min(1, gainT / 0.55);
  const sweepW = fw * 0.42;
  const sweepX = isRight
    ? fx + fw * (1 - sweepP) - sweepW * 0.5
    : fx + fw * sweepP - sweepW * 0.5;
  const sg = ctx.createLinearGradient(sweepX, 0, sweepX + sweepW, 0);
  sg.addColorStop(0, "rgba(255,255,255,0)");
  sg.addColorStop(0.5, `rgba(245,248,252,${0.65 * flash})`);
  sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();
}

/** Posture drain — sharp vermillion bite so every chip reads now. */
function drawDrainVfx(ctx, fx, fy, fw, fh, drainT, isRight) {
  if (drainT == null || drainT < 0 || drainT > 1) return;
  const flash =
    drainT < 0.12
      ? drainT / 0.12
      : drainT < 0.45
        ? 1
        : Math.max(0, 1 - (drainT - 0.45) / 0.55);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  ctx.fillStyle = `rgba(255, 120, 90,${0.42 * flash})`;
  ctx.fillRect(fx, fy, fw, fh);
  const sweepP = Math.min(1, drainT / 0.4);
  const sweepW = fw * 0.5;
  const sweepX = isRight
    ? fx + fw * sweepP - sweepW * 0.5
    : fx + fw * (1 - sweepP) - sweepW * 0.5;
  const sg = ctx.createLinearGradient(sweepX, 0, sweepX + sweepW, 0);
  sg.addColorStop(0, "rgba(255,200,160,0)");
  sg.addColorStop(0.5, `rgba(255, 210, 170,${0.7 * flash})`);
  sg.addColorStop(1, "rgba(255,200,160,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 */
export function drawBalanceGauge(ctx, opts) {
  const {
    width,
    height,
    dpr = 1,
    balance,
    isRight,
    gainT,
    drainT,
    time,
    deepGripT = 0,
  } = opts;

  ctx.clearRect(0, 0, width, height);
  if (width < 8 || height < 5) return;

  // One CSS pixel in backing-store units.
  const px = Math.max(1, dpr);

  const pct = Math.max(0, Math.min(100, balance)) / 100;
  const dg = Math.max(0, Math.min(1, deepGripT));
  const inKill = pct < KILL_THRESHOLD;
  const inDanger = !inKill && pct < DANGER_SOFT;
  const zone = inKill ? "kill" : inDanger ? "throw" : "safe";
  const colors = zoneColors(zone);

  // The fill runs flush to the CSS border, same as the stamina bar —
  // there is no inset track, so a full gauge hides the well entirely.
  //
  // Anchored to the CENTER-facing edge, which is the direction the
  // stamina bar above it drains. These used to run opposite ways on the
  // same wing: stamina emptied outward while posture emptied inward, so
  // at low values the two remaining fills sat at opposite ends of the
  // column and neither could be read against the other.
  const fillW = Math.max(0, width * pct);
  const fillX = isRight ? 0 : width - fillW;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  // Deep Grip warms the empty well so the threat reads before the fill does.
  if (dg > 0.05) {
    ctx.fillStyle = `rgba(255, 178, 64, ${0.06 + 0.12 * dg})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (fillW > 0.5) {
    drawComposureFill(ctx, fillX, 0, fillW, height, colors, isRight);

    if (inKill) {
      const kp = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(time * 7.2));
      ctx.fillStyle = `rgba(238, 81, 65, ${kp})`;
      ctx.fillRect(fillX, 0, fillW, height);
    }

    drawLeadingTip(ctx, fillX, 0, fillW, height, isRight, colors.edge, px);

    if (gainT != null) {
      drawGainVfx(ctx, fillX, 0, fillW, height, gainT, isRight);
    }
    if (drainT != null) {
      drawDrainVfx(ctx, fillX, 0, fillW, height, drainT, isRight);
    }
  }

  drawSegments(ctx, 0, 0, width, height, px);

  // Inner half of the keyline pair. GaugeShell's CSS border is the cream
  // stroke; this is the ink contour inside it, matching the stamina bar
  // and the game's black-outlined art. Drawn last so the fill can't
  // paint over it, and scaled by dpr so it stays one CSS pixel.
  const line = Math.max(1, Math.round(px));
  ctx.fillStyle = "rgba(3, 5, 10, 0.92)";
  ctx.fillRect(0, 0, width, line);
  ctx.fillRect(0, height - line, width, line);
  ctx.fillRect(0, 0, line, height);
  ctx.fillRect(width - line, 0, line, height);
}
