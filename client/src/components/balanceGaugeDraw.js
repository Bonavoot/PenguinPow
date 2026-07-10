/**
 * Canvas renderer for the in-game balance (stance) gauge.
 *
 * Readability model — the track is a LABELED SCALE, not just a fill:
 *
 *   Territory (painted faintly in the empty well, always visible):
 *     0–15   red    → KILL zone   (a throw here ends the round)
 *     15–50  gold   → THROW zone  (a throw/pull lands)
 *     50–60  amber  → GRIP zone   (only a throw threat when Deep Grip is live)
 *     50/60–100 ice → SAFE zone
 *
 *   Gates (persistent notches drawn ON TOP of fill + well so the player can
 *   always read "how far am I from the next line?"):
 *     kill gate  @ 15  (vermillion)
 *     throw gate @ 50  (gold)
 *     grip gate  @ 60  (amber, only while Deep Grip threatens this player)
 *
 *   Fill color still snaps to the current zone (ice / gold / red) so the
 *   at-a-glance read is unchanged; the marks + territory add the margin
 *   information the old bar was missing.
 *
 * Deep Grip: while the opponent holds it (deepGripT > 0) THIS player's
 * throw-land line slides 50 → 60, the 50–60 band lights amber, and the
 * grip gate fades in. The DEEP GRIP / EXPOSED text label is a DOM chip
 * owned by BalanceGauge.jsx.
 */

import { C } from "./menuTheme";

export const KILL_THRESHOLD = 0.15;
export const THROW_THRESHOLD = 0.5;
export const DEEP_GRIP_THROW_THRESHOLD = 0.6;

const INK = "#080a12";
const CREAM = "rgba(245, 236, 217, 0.38)";

let icePatternCache = null;
let goldPatternCache = null;
let killPatternCache = null;

function buildFillTile(top, mid, bot, sheen) {
  const tw = 64;
  const th = 14;
  const tile = document.createElement("canvas");
  tile.width = tw;
  tile.height = th;
  const t = tile.getContext("2d");

  const grad = t.createLinearGradient(0, 0, 0, th);
  grad.addColorStop(0, top);
  grad.addColorStop(0.5, mid);
  grad.addColorStop(1, bot);
  t.fillStyle = grad;
  t.fillRect(0, 0, tw, th);

  const s = t.createLinearGradient(0, 0, 0, th * 0.5);
  s.addColorStop(0, sheen);
  s.addColorStop(1, "rgba(255,255,255,0)");
  t.fillStyle = s;
  t.fillRect(0, 0, tw, th * 0.5);

  return tile;
}

function getIcePattern(ctx) {
  if (!icePatternCache) {
    icePatternCache = ctx.createPattern(
      buildFillTile(C.iceBright, C.ice, C.iceMid, "rgba(245,252,255,0.38)"),
      "repeat"
    );
  }
  return icePatternCache;
}

function getGoldPattern(ctx) {
  if (!goldPatternCache) {
    goldPatternCache = ctx.createPattern(
      buildFillTile("#f3dd7a", C.gold, "#9a7a18", "rgba(255,245,200,0.32)"),
      "repeat"
    );
  }
  return goldPatternCache;
}

function getKillPattern(ctx) {
  if (!killPatternCache) {
    killPatternCache = ctx.createPattern(
      buildFillTile("#f07868", C.vermillionBright, C.vermillionDeep, "rgba(255,210,190,0.28)"),
      "repeat"
    );
  }
  return killPatternCache;
}

function thresholdX(trackX, trackW, threshold, isRight) {
  const fromKillEdge = isRight ? 1 - threshold : threshold;
  return trackX + trackW * fromKillEdge;
}

function traceTrackOutline(ctx, x, y, w, h) {
  const c = Math.min(2, h * 0.14);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function strokeTrackOutline(ctx, x, y, w, h, color, lineWidth) {
  traceTrackOutline(ctx, x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Paint a faint territory band in the empty well between two balance
 * fractions. Drawn behind the fill, so only the currently-empty portion
 * of the track shows the tint — that gives the player a persistent map of
 * where the danger territory sits regardless of the current fill level.
 */
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

/**
 * Persistent gate marker — a thin vertical line at a threshold with a dark
 * underlay (so it reads on light ice fill) and small caps top + bottom (so
 * it reads as a deliberate gate, not a stray pixel). Drawn on top of both
 * the fill and the well.
 */
function drawThresholdNotch(ctx, x, trackY, trackH, color, alpha) {
  if (alpha <= 0.01) return;
  const px = Math.round(x);
  ctx.save();
  ctx.globalAlpha = alpha;
  // Dark backing so the mark survives on top of the bright ice fill.
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(px - 1.5, trackY, 3, trackH);
  // Colored hairline.
  ctx.fillStyle = color;
  ctx.fillRect(px - 0.5, trackY, 1.5, trackH);
  // Caps — a stubby serif top and bottom sells the "gate" read.
  ctx.fillRect(px - 2, trackY - 0.5, 5, 2);
  ctx.fillRect(px - 2, trackY + trackH - 1.5, 5, 2);
  ctx.restore();
}

function drawShimmer(ctx, fx, fy, fw, fh, phase, isRight) {
  if (fw < 4) return;
  const sweepW = fw * 0.36;
  const travel = fw + sweepW;
  const offset = ((phase * 0.32) % 1) * travel;
  const sx = isRight ? fx + fw - offset : fx + offset - sweepW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  const g = ctx.createLinearGradient(sx, 0, sx + sweepW, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.48, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.22)");
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
  ctx.fillStyle = `rgba(200,235,255,${0.45 * flash})`;
  ctx.fillRect(fx, fy, fw, fh);
  const sweepP = Math.min(1, gainT / 0.55);
  const sweepW = fw * 0.42;
  const sweepX = isRight
    ? fx + fw * (1 - sweepP) - sweepW * 0.5
    : fx + fw * sweepP - sweepW * 0.5;
  const sg = ctx.createLinearGradient(sweepX, 0, sweepX + sweepW, 0);
  sg.addColorStop(0, "rgba(255,255,255,0)");
  sg.addColorStop(0.5, `rgba(245,252,255,${0.75 * flash})`);
  sg.addColorStop(1, "rgba(255,255,255,0)");
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
    time,
    deepGripT = 0,
  } = opts;

  ctx.clearRect(0, 0, width, height);

  const padY = 2;
  const trackH = height - padY * 2;
  const trackY = padY;
  const trackX = 0;
  const trackW = width;

  if (trackW < 8 || trackH < 6) return;

  const pct = Math.max(0, Math.min(100, balance)) / 100;
  const dg = Math.max(0, Math.min(1, deepGripT));
  const throwLand =
    THROW_THRESHOLD + (DEEP_GRIP_THROW_THRESHOLD - THROW_THRESHOLD) * dg;
  const inKill = pct < KILL_THRESHOLD;
  const inThrow = pct <= throwLand && !inKill;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(trackX, trackY + trackH + 1, trackW, 2);

  // Recessed well
  ctx.fillStyle = INK;
  traceTrackOutline(ctx, trackX, trackY, trackW, trackH);
  ctx.fill();

  const wellShadow = ctx.createLinearGradient(0, trackY, 0, trackY + trackH);
  wellShadow.addColorStop(0, "rgba(0,0,0,0.45)");
  wellShadow.addColorStop(0.4, "rgba(0,0,0,0.05)");
  wellShadow.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = wellShadow;
  ctx.fillRect(trackX, trackY, trackW, trackH);

  // ── Territory bands ──────────────────────────────────────────────
  // Painted in the empty well (behind fill) so the track is a persistent
  // labeled scale. Clipped to the track outline so tints don't bleed past
  // the rounded corners.
  ctx.save();
  traceTrackOutline(ctx, trackX, trackY, trackW, trackH);
  ctx.clip();
  // KILL territory (0–15) — deep red so the "death" strip reads even empty.
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, 0, KILL_THRESHOLD, isRight, "rgb(150,26,20)", 0.42);
  // THROW territory (15–50) — gold.
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, KILL_THRESHOLD, THROW_THRESHOLD, isRight, "rgb(150,116,26)", 0.26);
  // GRIP-extension territory (50–60) — amber, brightens with Deep Grip.
  drawZoneBand(
    ctx, trackX, trackW, trackY, trackH,
    THROW_THRESHOLD, DEEP_GRIP_THROW_THRESHOLD, isRight,
    "rgb(196,132,32)", 0.10 + 0.42 * dg
  );
  // SAFE territory (grip line–100) — faint ice so "home" territory reads.
  drawZoneBand(ctx, trackX, trackW, trackY, trackH, DEEP_GRIP_THROW_THRESHOLD, 1, isRight, "rgb(40,96,132)", 0.14);
  ctx.restore();

  // Fill
  const inset = 1.25;
  const innerX = trackX + inset;
  const innerY = trackY + inset;
  const innerW = trackW - inset * 2;
  const innerH = trackH - inset * 2;
  const fillW = Math.max(0, innerW * pct);
  const fillX = isRight ? innerX + innerW - fillW : innerX;

  if (fillW > 0.5) {
    ctx.save();
    traceTrackOutline(ctx, innerX, innerY, innerW, innerH);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(fillX, innerY, fillW, innerH);
    ctx.clip();

    if (inKill) {
      ctx.fillStyle = getKillPattern(ctx);
    } else if (inThrow) {
      ctx.fillStyle = getGoldPattern(ctx);
    } else {
      ctx.fillStyle = getIcePattern(ctx);
    }
    ctx.fillRect(fillX - 8, innerY, fillW + 16, innerH);

    if (inKill) {
      const kp = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(time * 7.2));
      ctx.fillStyle = `rgba(238,81,65,${kp})`;
      ctx.fillRect(fillX, innerY, fillW, innerH);
    }

    drawShimmer(ctx, fillX, innerY, fillW, innerH, time, isRight);

    const fillDepth = ctx.createLinearGradient(0, innerY + innerH * 0.4, 0, innerY + innerH);
    fillDepth.addColorStop(0, "rgba(0,0,0,0)");
    fillDepth.addColorStop(1, "rgba(0,16,32,0.28)");
    ctx.fillStyle = fillDepth;
    ctx.fillRect(fillX, innerY, fillW, innerH);

    ctx.restore();
  }

  if (fillW > 0.5 && gainT != null) {
    ctx.save();
    traceTrackOutline(ctx, innerX, innerY, innerW, innerH);
    ctx.clip();
    drawGainVfx(ctx, fillX, innerY, fillW, innerH, gainT, isRight);
    ctx.restore();
  }

  // ── Persistent threshold gates ───────────────────────────────────
  // Drawn on top of fill + well so distance-to-danger is always legible.
  const killX = thresholdX(trackX, trackW, KILL_THRESHOLD, isRight);
  const throwX = thresholdX(trackX, trackW, THROW_THRESHOLD, isRight);
  const gripX = thresholdX(trackX, trackW, DEEP_GRIP_THROW_THRESHOLD, isRight);
  drawThresholdNotch(ctx, killX, trackY, trackH, "rgba(238,81,65,0.95)", 0.9);
  drawThresholdNotch(ctx, throwX, trackY, trackH, "rgba(232,197,71,0.95)", 0.85);
  // Grip gate only materializes while Deep Grip threatens this player.
  drawThresholdNotch(ctx, gripX, trackY, trackH, "rgba(255,178,64,1)", dg);

  // Frame
  const dangerActive = danger && (gainT == null || gainT > 0.8);
  const pulse = dangerActive
    ? 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(time * 8.05))
    : 1;

  let borderColor = CREAM;
  if (dangerActive) {
    borderColor = `rgba(${Math.round(216 + 22 * pulse)},${Math.round(59 + 22 * pulse)},${Math.round(39 + 26 * pulse)},${0.8 + 0.2 * pulse})`;
  } else if (dg > 0.5) {
    // Under active Deep Grip threat the frame goes amber — matches the lit
    // grip gate + band so the whole gauge reads "extended throw range".
    borderColor = `rgba(255,178,64,${0.4 + 0.35 * dg})`;
  } else if (inThrow) {
    borderColor = "rgba(232,197,71,0.45)";
  }

  if (dangerActive) {
    strokeTrackOutline(
      ctx,
      trackX,
      trackY,
      trackW,
      trackH,
      `rgba(238,81,65,${0.18 * pulse})`,
      2.4
    );
  }

  strokeTrackOutline(ctx, trackX + 0.5, trackY + 0.5, trackW - 1, trackH - 1, borderColor, 1.2);
  strokeTrackOutline(
    ctx,
    trackX + 1.5,
    trackY + 1.5,
    trackW - 3,
    trackH - 3,
    "rgba(8,10,18,0.85)",
    1
  );
}
