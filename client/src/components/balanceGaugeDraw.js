/**
 * Canvas renderer for the in-game balance (stance) gauge.
 * Procedural art — no CSS gradient stacks, no repeating stripe hacks.
 */

import { C } from "./menuTheme";

// Zone thresholds — must match UiPlayerInfo gameplay constants
export const KILL_ZONE_END = 0.14;
export const DIVIDER_END = 0.16;
export const THROW_ZONE_END = 0.5;
export const SEGMENT_COUNT = 10;

const INK = "#080a12";
const INK_MID = "#0e1218";
const CREAM = "rgba(245, 236, 217, 0.32)";
const CREAM_BRIGHT = "rgba(245, 252, 255, 0.95)";

/** Mix two #rrggbb hex colors; t = 0 → a, t = 1 → b */
function mixHex(a, b, t) {
  const parse = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const lerp = (x, y) => Math.round(x + (y - x) * t);
  const r = lerp(ar, br);
  const g = lerp(ag, bg);
  const bl = lerp(ab, bb);
  return `rgb(${r}, ${g}, ${bl})`;
}

const ZONE_KILL = mixHex(C.vermillionBright, C.ink, 0.3);
const ZONE_THROW = mixHex(C.gold, C.ink, 0.26);

let fillPatternCache = null;

/** Frost-crystal fill tile — painted once, tiled inside the ice fill */
function getFillPattern(ctx) {
  if (fillPatternCache) return fillPatternCache;

  const tw = 64;
  const th = 16;
  const tile = document.createElement("canvas");
  tile.width = tw;
  tile.height = th;
  const t = tile.getContext("2d");

  const grad = t.createLinearGradient(0, 0, 0, th);
  grad.addColorStop(0, C.iceBright);
  grad.addColorStop(0.45, C.ice);
  grad.addColorStop(1, C.iceMid);
  t.fillStyle = grad;
  t.fillRect(0, 0, tw, th);

  // Soft top sheen
  const sheen = t.createLinearGradient(0, 0, 0, th * 0.55);
  sheen.addColorStop(0, "rgba(245, 252, 255, 0.42)");
  sheen.addColorStop(1, "rgba(245, 252, 255, 0)");
  t.fillStyle = sheen;
  t.fillRect(0, 0, tw, th * 0.55);

  // Frost speckles — scattered dots, not scan lines
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 28; i++) {
    const fx = rand() * tw;
    const fy = rand() * th;
    const fr = 0.4 + rand() * 1.1;
    t.fillStyle = `rgba(255, 255, 255, ${0.08 + rand() * 0.14})`;
    t.beginPath();
    t.arc(fx, fy, fr, 0, Math.PI * 2);
    t.fill();
  }

  fillPatternCache = ctx.createPattern(tile, "repeat");
  return fillPatternCache;
}

function zoneColorAt(normalizedFromLeft, isRight) {
  // Kill/throw zones sit on the anchor edge (opposite the fill drain direction).
  // P1 fills from left → danger on left; P2 fills from right → danger on right.
  const distFromKillEdge = isRight
    ? 1 - normalizedFromLeft
    : normalizedFromLeft;

  if (distFromKillEdge < KILL_ZONE_END) return ZONE_KILL;
  if (distFromKillEdge < DIVIDER_END) return INK;
  if (distFromKillEdge < THROW_ZONE_END) return ZONE_THROW;
  return INK_MID;
}

function drawZoneBackground(ctx, x, y, w, h, isRight) {
  const steps = 48;
  const slice = w / steps;
  for (let i = 0; i < steps; i++) {
    const normalizedFromLeft = (i + 0.5) / steps;
    ctx.fillStyle = zoneColorAt(normalizedFromLeft, isRight);
    ctx.fillRect(x + i * slice, y, slice + 0.5, h);
  }
}

function drawSegmentTicks(ctx, x, y, w, h, isRight) {
  const killDividerPos = isRight ? 0.85 : 0.15;
  const throwDividerPos = 0.5;

  ctx.save();
  for (let i = 1; i < SEGMENT_COUNT; i++) {
    const posFromLeft = i / SEGMENT_COUNT;
    const px = x + w * posFromLeft;
    const nearKill = Math.abs(posFromLeft - killDividerPos) < 0.07;
    const nearThrow = Math.abs(posFromLeft - throwDividerPos) < 0.07;
    ctx.strokeStyle = nearKill
      ? "rgba(8, 10, 18, 0.9)"
      : nearThrow
        ? "rgba(0, 0, 0, 0.45)"
        : "rgba(0, 0, 0, 0.22)";
    ctx.lineWidth = nearKill ? 1.25 : i % 5 === 0 ? 1 : 0.65;
    ctx.beginPath();
    ctx.moveTo(px, y + 1);
    ctx.lineTo(px, y + h - 1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Symmetric chamfered frame — identical on both ends for P1 and P2 */
function traceTrackOutline(ctx, x, y, w, h) {
  const c = Math.min(2, h * 0.14);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function fillTrackWell(ctx, x, y, w, h) {
  traceTrackOutline(ctx, x, y, w, h);
  ctx.fill();
}

function strokeTrackOutline(ctx, x, y, w, h, color, lineWidth) {
  traceTrackOutline(ctx, x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawLeadingMarker(ctx, edgeX, y, h, pointingRight, minX, maxX) {
  const mh = h * 0.72;
  const my = y + (h - mh) * 0.5;
  const mw = Math.max(3, h * 0.28);

  ctx.save();
  // Hard clip — tip and glow must never paint past the track well
  ctx.beginPath();
  ctx.rect(minX, y, maxX - minX, h);
  ctx.clip();

  ctx.beginPath();
  if (pointingRight) {
    const tipX = Math.min(edgeX + 0.5, maxX - 0.5);
    ctx.moveTo(tipX - mw, my);
    ctx.lineTo(tipX, my + mh * 0.5);
    ctx.lineTo(tipX - mw, my + mh);
  } else {
    const tipX = Math.max(edgeX - 0.5, minX + 0.5);
    ctx.moveTo(tipX + mw, my);
    ctx.lineTo(tipX, my + mh * 0.5);
    ctx.lineTo(tipX + mw, my + mh);
  }
  ctx.closePath();

  const mg = ctx.createLinearGradient(edgeX - mw, my, edgeX + mw, my + mh);
  mg.addColorStop(0, CREAM_BRIGHT);
  mg.addColorStop(1, "rgba(220, 240, 255, 0.85)");
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.restore();
}

function drawShimmer(ctx, fx, fy, fw, fh, phase, isRight) {
  if (fw < 4) return;
  const sweepW = fw * 0.38;
  const travel = fw + sweepW;
  const offset = ((phase * 0.35) % 1) * travel;
  const sx = isRight ? fx + fw - offset : fx + offset - sweepW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();

  const g = ctx.createLinearGradient(sx, 0, sx + sweepW, 0);
  g.addColorStop(0, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.5, "rgba(245, 252, 255, 0.28)");
  g.addColorStop(0.58, "rgba(255, 255, 255, 0)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();
}

function drawGainVfx(ctx, fx, fy, fw, fh, gainT, isRight) {
  if (gainT == null || gainT < 0 || gainT > 1) return;

  // Flash envelope — quick peak then fade (700ms total mapped to 0–1)
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

  ctx.fillStyle = `rgba(200, 235, 255, ${0.55 * flash})`;
  ctx.fillRect(fx, fy, fw, fh);

  // Directional sweep
  const sweepP = Math.min(1, gainT / 0.55);
  const sweepW = fw * 0.45;
  const sweepX = isRight
    ? fx + fw * (1 - sweepP) - sweepW * 0.5
    : fx + fw * sweepP - sweepW * 0.5;

  const sg = ctx.createLinearGradient(sweepX, 0, sweepX + sweepW, 0);
  sg.addColorStop(0, "rgba(255, 255, 255, 0)");
  sg.addColorStop(0.5, `rgba(245, 252, 255, ${0.85 * flash})`);
  sg.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sg;
  ctx.fillRect(fx, fy, fw, fh);

  ctx.restore();

  // Frame highlight — inset stroke only (shadowBlur ignores clip and bleeds out)
  ctx.strokeStyle = `rgba(170, 220, 255, ${0.55 * flash})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
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
  } = opts;

  ctx.clearRect(0, 0, width, height);

  const padY = 2;
  const trackH = height - padY * 2;
  const trackY = padY;
  const trackX = 0;
  const trackW = width;

  if (trackW < 8 || trackH < 6) return;

  // Drop shadow under entire instrument
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(trackX, trackY + trackH + 1, trackW, 2);
  ctx.restore();

  // Recessed well — full width, symmetric chamfered ends
  ctx.save();
  ctx.fillStyle = INK;
  fillTrackWell(ctx, trackX, trackY, trackW, trackH);
  ctx.restore();

  // Zone tint in the well (visible behind low balance)
  drawZoneBackground(ctx, trackX, trackY, trackW, trackH, isRight);

  // Inner shadow — pressed-in channel
  const wellShadow = ctx.createLinearGradient(0, trackY, 0, trackY + trackH);
  wellShadow.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  wellShadow.addColorStop(0.25, "rgba(0, 0, 0, 0.08)");
  wellShadow.addColorStop(0.75, "rgba(0, 0, 0, 0.05)");
  wellShadow.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = wellShadow;
  ctx.fillRect(trackX, trackY, trackW, trackH);

  // Segment ticks (fighting-game block read)
  drawSegmentTicks(ctx, trackX, trackY, trackW, trackH, isRight);

  // Kill→throw sumi divider
  const divCenter = isRight
    ? trackX + trackW * (1 - (KILL_ZONE_END + DIVIDER_END) * 0.5)
    : trackX + trackW * ((KILL_ZONE_END + DIVIDER_END) * 0.5);
  const divW = Math.max(1.5, trackW * (DIVIDER_END - KILL_ZONE_END));
  ctx.fillStyle = "rgba(8, 10, 18, 0.96)";
  ctx.fillRect(divCenter - divW * 0.5, trackY, divW, trackH);

  // ── Balance fill (clipped to inner well so full bar never bleeds past frame) ──
  const inset = 1.25;
  const innerX = trackX + inset;
  const innerY = trackY + inset;
  const innerW = trackW - inset * 2;
  const innerH = trackH - inset * 2;

  const pct = Math.max(0, Math.min(100, balance)) / 100;
  const fillW = Math.max(0, innerW * pct);

  let fillX;
  if (isRight) {
    fillX = innerX + innerW - fillW;
  } else {
    fillX = innerX;
  }

  const atMaxFill = pct >= 0.998 || fillW >= innerW - 0.5;

  if (fillW > 0.5) {
    ctx.save();
    traceTrackOutline(ctx, innerX, innerY, innerW, innerH);
    ctx.clip();

    ctx.beginPath();
    ctx.rect(fillX, innerY, fillW, innerH);
    ctx.clip();

    ctx.fillStyle = getFillPattern(ctx);
    ctx.fillRect(fillX - 8, innerY, fillW + 16, innerH);

    // Inner luminance — no shadowBlur (shadows ignore clip and bleed past borders)
    ctx.fillStyle = "rgba(126, 203, 240, 0.18)";
    ctx.fillRect(fillX, innerY, fillW, innerH);

    drawShimmer(ctx, fillX, innerY, fillW, innerH, time, isRight);

    const fillDepth = ctx.createLinearGradient(0, innerY + innerH * 0.5, 0, innerY + innerH);
    fillDepth.addColorStop(0, "rgba(0, 0, 0, 0)");
    fillDepth.addColorStop(1, "rgba(0, 40, 70, 0.35)");
    ctx.fillStyle = fillDepth;
    ctx.fillRect(fillX, innerY, fillW, innerH);

    // Leading-edge marker — hidden at 100% (no edge to mark; avoids border overlap)
    if (fillW > 3 && !atMaxFill) {
      const edgeX = isRight ? fillX : fillX + fillW;
      drawLeadingMarker(
        ctx,
        edgeX,
        innerY,
        innerH,
        !isRight,
        innerX,
        innerX + innerW
      );
    }

    ctx.restore();
  }

  // Perfect-parry gain overlay (clipped to inner well)
  if (fillW > 0.5 && gainT != null) {
    ctx.save();
    traceTrackOutline(ctx, innerX, innerY, innerW, innerH);
    ctx.clip();
    drawGainVfx(ctx, fillX, innerY, fillW, innerH, gainT, isRight);
    ctx.restore();
  }

  // Frame border — cream at rest, vermillion pulse in danger (suppressed during parry gain)
  const dangerActive = danger && (gainT == null || gainT > 0.8);
  const pulse = dangerActive ? 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(time * 8.05)) : 1;
  const borderColor = dangerActive
    ? `rgba(${Math.round(216 + 22 * pulse)}, ${Math.round(59 + 22 * pulse)}, ${Math.round(39 + 26 * pulse)}, ${0.78 + 0.22 * pulse})`
    : CREAM;

  if (dangerActive) {
    strokeTrackOutline(
      ctx,
      trackX,
      trackY,
      trackW,
      trackH,
      `rgba(238, 81, 65, ${0.18 * pulse})`,
      2.5
    );
  }

  strokeTrackOutline(ctx, trackX + 0.5, trackY + 0.5, trackW - 1, trackH - 1, borderColor, 1.25);

  // Inner sumi mat
  strokeTrackOutline(
    ctx,
    trackX + 1.5,
    trackY + 1.5,
    trackW - 3,
    trackH - 3,
    "rgba(8, 10, 18, 0.88)",
    1
  );

  // Top highlight rim
  ctx.strokeStyle = "rgba(245, 236, 217, 0.1)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(trackX + 2, trackY + 1.5);
  ctx.lineTo(trackX + trackW - 2, trackY + 1.5);
  ctx.stroke();
}
