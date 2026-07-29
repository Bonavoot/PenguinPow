/**
 * Canvas renderer for the in-game balance (stance / posture) gauge.
 *
 * Posture is composure for throws & grabs — not stamina. Kept deliberately
 * quieter and thinner than the jade stamina bar, with two persistent gates:
 *
 *   0–15   vermillion → KILL   (throw/pull ends the round)
 *   15–50  gold       → THROW  (throw/pull lands)
 *   50–60  amber      → GRIP   (lit only while Deep Grip threatens)
 *   50/60–100 ice     → SAFE
 *
 * Fill is smooth (no plate seams). Gates are capped notches — kill in
 * vermillion, throw in gold — so they read without shouting over stamina.
 */

import { C } from "./menuTheme";

export const KILL_THRESHOLD = 0.15;
export const THROW_THRESHOLD = 0.5;
export const DEEP_GRIP_THROW_THRESHOLD = 0.6;

const INK = "#080a12";

function thresholdX(trackX, trackW, threshold, isRight) {
  const fromKillEdge = isRight ? 1 - threshold : threshold;
  return trackX + trackW * fromKillEdge;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawZoneBand(ctx, trackX, trackW, trackY, trackH, aFrac, bFrac, isRight, color, alpha) {
  const xa = thresholdX(trackX, trackW, aFrac, isRight);
  const xb = thresholdX(trackX, trackW, bFrac, isRight);
  const left = Math.min(xa, xb);
  const w = Math.abs(xb - xa);
  if (w < 0.5) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(left, trackY, w, trackH);
  ctx.restore();
}

/** Smooth composure fill — liquid ice / gold / vermillion, no seams. */
function drawComposureFill(ctx, fx, fy, fw, fh, zone) {
  if (fw < 0.5 || fh < 0.5) return;

  let tip;
  let mid;
  let deep;
  let lip;
  if (zone === "kill") {
    tip = "#ff8a7a";
    mid = C.vermillionBright;
    deep = C.vermillionDeep;
    lip = "rgba(255, 220, 200, 0.22)";
  } else if (zone === "throw") {
    tip = "#ffe08a";
    mid = C.gold;
    deep = C.goldDeep;
    lip = "rgba(255, 248, 220, 0.24)";
  } else {
    tip = C.postureBright;
    mid = C.posture;
    deep = C.postureDeep;
    lip = "rgba(230, 248, 255, 0.22)";
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();

  const body = ctx.createLinearGradient(0, fy, 0, fy + fh);
  body.addColorStop(0, tip);
  body.addColorStop(0.42, mid);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.fillRect(fx, fy, fw, fh);

  const lipG = ctx.createLinearGradient(0, fy, 0, fy + fh * 0.45);
  lipG.addColorStop(0, lip);
  lipG.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = lipG;
  ctx.fillRect(fx, fy, fw, fh * 0.45);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(fx, fy + fh - Math.max(1.5, fh * 0.2), fw, Math.max(1.5, fh * 0.2));

  ctx.restore();
}

/**
 * Threshold notch — thin vertical gate with dark underlay + top/bottom caps.
 * Same language as the original markers; color carries kill vs throw.
 */
function drawThresholdNotch(ctx, x, trackY, trackH, color, alpha) {
  if (alpha <= 0.01) return;
  const px = Math.round(x);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(px - 1.5, trackY, 3, trackH);
  ctx.fillStyle = color;
  ctx.fillRect(px - 0.5, trackY, 1.5, trackH);
  ctx.fillRect(px - 2, trackY - 0.5, 5, 2);
  ctx.fillRect(px - 2, trackY + trackH - 1.5, 5, 2);
  ctx.restore();
}

function drawShimmer(ctx, fx, fy, fw, fh, phase, isRight) {
  if (fw < 4) return;
  const sweepW = fw * 0.36;
  const travel = fw + sweepW;
  const offset = ((phase * 0.28) % 1) * travel;
  const sx = isRight ? fx + fw - offset : fx + offset - sweepW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  const g = ctx.createLinearGradient(sx, 0, sx + sweepW, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.48, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.18)");
  g.addColorStop(0.52, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();
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

/** Tip-slap posture drain — sharp vermillion bite so spacing reward reads now. */
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
    balance,
    isRight,
    danger,
    gainT,
    drainT,
    time,
    deepGripT = 0,
  } = opts;

  ctx.clearRect(0, 0, width, height);

  const padY = 2;
  const trackH = height - padY * 2;
  const trackY = padY;
  const trackX = 0;
  const trackW = width;

  if (trackW < 8 || trackH < 5) return;

  const pct = Math.max(0, Math.min(100, balance)) / 100;
  const dg = Math.max(0, Math.min(1, deepGripT));
  const throwLand =
    THROW_THRESHOLD + (DEEP_GRIP_THROW_THRESHOLD - THROW_THRESHOLD) * dg;
  const inKill = pct < KILL_THRESHOLD;
  const inThrow = pct <= throwLand && !inKill;
  const zone = inKill ? "kill" : inThrow ? "throw" : "safe";

  // Recessed well
  roundRectPath(ctx, trackX, trackY, trackW, trackH, 2);
  ctx.fillStyle = INK;
  ctx.fill();

  const wellShade = ctx.createLinearGradient(0, trackY, 0, trackY + trackH);
  wellShade.addColorStop(0, "rgba(0,0,0,0.45)");
  wellShade.addColorStop(0.45, "rgba(0,0,0,0.06)");
  wellShade.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = wellShade;
  ctx.fill();

  // Quiet territory tint in the empty well
  ctx.save();
  roundRectPath(ctx, trackX, trackY, trackW, trackH, 2);
  ctx.clip();
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, 0, KILL_THRESHOLD, isRight, "rgb(150, 28, 22)", 0.4);
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, KILL_THRESHOLD, THROW_THRESHOLD, isRight, "rgb(150, 116, 26)", 0.22);
  drawZoneBand(
    ctx, trackX, trackW, trackY, trackH,
    THROW_THRESHOLD, DEEP_GRIP_THROW_THRESHOLD, isRight,
    "rgb(196, 132, 32)", 0.08 + 0.38 * dg
  );
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, DEEP_GRIP_THROW_THRESHOLD, 1, isRight, "rgb(48, 96, 120)", 0.12);
  ctx.restore();

  const inset = 1.25;
  const innerX = trackX + inset;
  const innerY = trackY + inset;
  const innerW = trackW - inset * 2;
  const innerH = trackH - inset * 2;
  const fillW = Math.max(0, innerW * pct);
  const fillX = isRight ? innerX + innerW - fillW : innerX;

  if (fillW > 0.5) {
    ctx.save();
    roundRectPath(ctx, innerX, innerY, innerW, innerH, 1.5);
    ctx.clip();
    drawComposureFill(ctx, fillX, innerY, fillW, innerH, zone);

    if (inKill) {
      const kp = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(time * 7.2));
      ctx.fillStyle = `rgba(238, 81, 65, ${kp})`;
      ctx.fillRect(fillX, innerY, fillW, innerH);
    }

    drawShimmer(ctx, fillX, innerY, fillW, innerH, time, isRight);
    ctx.restore();
  }

  if (fillW > 0.5 && gainT != null) {
    ctx.save();
    roundRectPath(ctx, innerX, innerY, innerW, innerH, 1.5);
    ctx.clip();
    drawGainVfx(ctx, fillX, innerY, fillW, innerH, gainT, isRight);
    ctx.restore();
  }

  if (fillW > 0.5 && drainT != null) {
    ctx.save();
    roundRectPath(ctx, innerX, innerY, innerW, innerH, 1.5);
    ctx.clip();
    drawDrainVfx(ctx, fillX, innerY, fillW, innerH, drainT, isRight);
    ctx.restore();
  }

  // Gates on top of fill + well
  const killX = thresholdX(trackX, trackW, KILL_THRESHOLD, isRight);
  const throwX = thresholdX(trackX, trackW, throwLand, isRight);
  const gripX = thresholdX(trackX, trackW, DEEP_GRIP_THROW_THRESHOLD, isRight);
  const baseThrowX = thresholdX(trackX, trackW, THROW_THRESHOLD, isRight);

  drawThresholdNotch(ctx, killX, trackY, trackH, "rgba(238, 81, 65, 0.95)", 0.95);
  if (dg > 0.05) {
    drawThresholdNotch(ctx, baseThrowX, trackY, trackH, "rgba(232, 197, 71, 0.55)", 0.45);
  }
  drawThresholdNotch(ctx, throwX, trackY, trackH, "rgba(232, 197, 71, 0.95)", 0.9);
  drawThresholdNotch(ctx, gripX, trackY, trackH, "rgba(255, 178, 64, 1)", dg);

  // Quiet frame — subordinate to stamina chrome
  const dangerActive = danger && (gainT == null || gainT > 0.8);
  const pulse = dangerActive
    ? 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(time * 8.05))
    : 1;

  let borderColor = "rgba(245, 236, 217, 0.32)";
  if (dangerActive) {
    borderColor = `rgba(${Math.round(216 + 22 * pulse)},${Math.round(59 + 22 * pulse)},${Math.round(39 + 26 * pulse)},${0.75 + 0.2 * pulse})`;
  } else if (dg > 0.5) {
    borderColor = `rgba(255, 178, 64, ${0.35 + 0.3 * dg})`;
  } else if (inThrow) {
    borderColor = "rgba(232, 197, 71, 0.42)";
  }

  roundRectPath(ctx, trackX + 0.5, trackY + 0.5, trackW - 1, trackH - 1, 2);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  roundRectPath(ctx, trackX + 1.25, trackY + 1.25, trackW - 2.5, trackH - 2.5, 1.5);
  ctx.strokeStyle = "rgba(8, 10, 18, 0.7)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
}
