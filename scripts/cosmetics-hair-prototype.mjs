/**
 * Lazy cosmetics prototype:
 * 1) Auto-find the blue topknot tie → attachment point + rotation
 * 2) Composite a placeholder hat that covers the baked-in hair
 * 3) Attempt a "bald crown" erase (best-effort; hat-cover is the reliable path)
 *
 * Usage: node scripts/cosmetics-hair-prototype.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "client/src/assets/cosmetics-test");

const FRAMES = [
  { key: "idle", file: "client/src/assets/pumo-idle.png" },
  { key: "tachiai", file: "client/src/assets/pumo-tachiai-position.png" },
];

function i4(x, y, w) {
  return (y * w + x) * 4;
}

function isBlueBand(r, g, b, a) {
  return a >= 128 && b > 140 && g > 70 && g < 200 && r < 120 && b > r + 50 && b >= g;
}

function isBg(r, g, b, a) {
  return a < 16 || (r < 18 && g < 18 && b < 18);
}

function isHeadGray(r, g, b, a) {
  if (a < 128) return false;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx < 120 && mx > 35 && mx - mn < 35 && b < 100;
}

function isHairFill(r, g, b, a) {
  // Topknot fill: near-black / palette dark (idle is 8-bit, often 42,42,42)
  // OR white streaks. Exclude mid-gray head fill (~76+) and blue band.
  if (a < 128) return false;
  if (r > 200 && g > 200 && b > 200) return true;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx <= 50 && mx - mn <= 8;
}

function connectedComponents(mask, w, h) {
  const labels = new Int32Array(w * h);
  const comps = [];
  let label = 0;
  const stack = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!mask[p] || labels[p]) continue;
      label++;
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y,
        sx = 0,
        sy = 0,
        n = 0;
      stack.push(p);
      labels[p] = label;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w;
        const cy = (cur / w) | 0;
        sx += cx;
        sy += cy;
        n++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (!mask[np] || labels[np]) continue;
          labels[np] = label;
          stack.push(np);
        }
      }
      comps.push({
        label,
        n,
        minX,
        maxX,
        minY,
        maxY,
        cx: sx / n,
        cy: sy / n,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      });
    }
  }
  return comps;
}

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function characterBounds(data, w, h) {
  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = i4(x, y, w);
      if (!isBg(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function findBand(data, w, h, bounds) {
  const yCut = bounds.minY + (bounds.maxY - bounds.minY) * 0.4;
  const mask = new Uint8Array(w * h);
  for (let y = bounds.minY; y <= Math.min(h - 1, yCut | 0); y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const i = i4(x, y, w);
      if (isBlueBand(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        mask[y * w + x] = 1;
      }
    }
  }
  const comps = connectedComponents(mask, w, h).sort(
    (a, b) => a.minY - b.minY || a.n - b.n
  );
  const band = comps.find(
    (c) => c.n > 40 && c.n < 4000 && c.h < 80 && c.w < 160
  );
  if (!band) throw new Error("Could not find topknot blue band");
  return band;
}

function extractTopknot(data, w, h, band) {
  // Region search above/around the blue tie (more reliable than flood on
  // indexed palettes where hair ≈ outline ≈ 42,42,42).
  const x0 = Math.max(0, band.minX - 18);
  const x1 = Math.min(w - 1, band.maxX + 18);
  const y1 = Math.min(h - 1, band.maxY + 4);
  // Search upward until we hit mostly background for a few rows
  let y0 = Math.max(0, band.minY - 90);

  const mask = new Uint8Array(w * h);
  const points = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = i4(x, y, w);
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (isBg(r, g, b, a) || isHeadGray(r, g, b, a)) continue;
      if (!(isBlueBand(r, g, b, a) || isHairFill(r, g, b, a))) continue;
      // Above the band: take hair fill. On the band row: blue only (avoid skull).
      if (y > band.maxY && !isBlueBand(r, g, b, a)) continue;
      if (y >= band.minY && y <= band.maxY && isHairFill(r, g, b, a) && !isBlueBand(r, g, b, a)) {
        // allow dark pixels only if still within band x span (bun base)
        if (x < band.minX - 4 || x > band.maxX + 4) continue;
      }
      mask[y * w + x] = 1;
      points.push({ x, y });
    }
  }

  // Trim y0 to actual content
  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const attach = { x: +band.cx.toFixed(1), y: +band.cy.toFixed(1) };

  // Tip = centroid of the topmost ~12% of knot pixels (stable vs single pixel)
  const tipCutoff = minY + Math.max(4, (maxY - minY) * 0.18);
  let tipX = 0,
    tipY = 0,
    tipN = 0;
  for (const p of points) {
    if (p.y <= tipCutoff) {
      tipX += p.x;
      tipY += p.y;
      tipN++;
    }
  }
  let rotationDeg = 0;
  if (tipN > 3) {
    tipX /= tipN;
    tipY /= tipN;
    rotationDeg =
      (Math.atan2(tipX - attach.x, -(tipY - attach.y)) * 180) / Math.PI;
  }

  return {
    mask,
    points,
    attach,
    tip: tipN > 3 ? { x: +tipX.toFixed(1), y: +tipY.toFixed(1) } : null,
    rotationDeg: +rotationDeg.toFixed(2),
    bbox: {
      minX,
      maxX,
      minY,
      maxY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    },
  };
}

async function makeHat(size = 140) {
  const w = size;
  const h = size;
  const buf = Buffer.alloc(w * h * 4);
  const cx = w / 2;
  const cy = h * 0.68; // pivot: underside of crown / band
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const brim =
        (dx * dx) / (62 * 62) + ((dy - 14) * (dy - 14)) / (18 * 18) <= 1 &&
        dy > -8 &&
        dy < 34;
      const crown =
        (dx * dx) / (42 * 42) + ((dy + 24) * (dy + 24)) / (34 * 34) <= 1 &&
        dy < 16;
      const band =
        Math.abs(dy - 1) < 4 &&
        Math.abs(dx) < 44 &&
        (dx * dx) / (44 * 44) + ((dy - 1) * (dy - 1)) / (7 * 7) <= 1;
      if (!(crown || brim || band)) continue;
      let r,
        g,
        b;
      if (band) {
        r = 200;
        g = 55;
        b = 48;
      } else if (brim && !crown) {
        r = 40;
        g = 85;
        b = 65;
      } else {
        r = 52;
        g = 105;
        b = 80;
      }
      const edge =
        (crown &&
          (dx * dx) / (42 * 42) + ((dy + 24) * (dy + 24)) / (34 * 34) > 0.8) ||
        (brim &&
          (dx * dx) / (62 * 62) + ((dy - 14) * (dy - 14)) / (18 * 18) > 0.84);
      if (edge) {
        r = 18;
        g = 18;
        b = 18;
      }
      const i = (y * w + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  const file = path.join(OUT, "placeholder-hat.png");
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
  return { file, w, h, pivotX: cx, pivotY: cy };
}

async function compositeHat(baseFile, attach, rotationDeg, hat, outName) {
  // Cover the baked topknot: scale hat a bit larger than the knot
  const scale = 1.55;
  const hatW = Math.round(hat.w * scale);
  const hatH = Math.round(hat.h * scale);
  const hatBuf = await sharp(hat.file).resize(hatW, hatH).png().toBuffer();

  const rotated = await sharp(hatBuf)
    .rotate(rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(rotated).metadata();

  const ox = hat.pivotX * scale - hatW / 2;
  const oy = hat.pivotY * scale - hatH / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // sharp positive angle = clockwise
  const rx = ox * cos - oy * sin;
  const ry = ox * sin + oy * cos;
  const left = Math.round(attach.x - (meta.width / 2 + rx));
  const top = Math.round(attach.y - (meta.height / 2 + ry));

  const out = path.join(OUT, outName);
  await sharp(baseFile)
    .composite([{ input: rotated, left, top }])
    .png()
    .toFile(out);
  return out;
}

async function debugOverlay(baseFile, data, w, h, knot, outName) {
  const overlay = Buffer.from(data);
  const set = (x, y, r, g, b) => {
    x = x | 0;
    y = y | 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = i4(x, y, w);
    overlay[i] = r;
    overlay[i + 1] = g;
    overlay[i + 2] = b;
    overlay[i + 3] = 255;
  };
  const bb = knot.bbox;
  for (let x = bb.minX; x <= bb.maxX; x++) {
    set(x, bb.minY, 0, 255, 80);
    set(x, bb.maxY, 0, 255, 80);
  }
  for (let y = bb.minY; y <= bb.maxY; y++) {
    set(bb.minX, y, 0, 255, 80);
    set(bb.maxX, y, 0, 255, 80);
  }
  for (let d = -14; d <= 14; d++) {
    set(knot.attach.x + d, knot.attach.y, 255, 40, 40);
    set(knot.attach.x, knot.attach.y + d, 255, 40, 40);
  }
  const rad = (knot.rotationDeg * Math.PI) / 180;
  for (let t = 0; t < 55; t++) {
    set(
      knot.attach.x + Math.sin(rad) * t,
      knot.attach.y - Math.cos(rad) * t,
      255,
      220,
      40
    );
  }
  const out = path.join(OUT, outName);
  await sharp(overlay, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(out);
  return out;
}

async function removeHair(data, w, h, band, knot, outName) {
  const out = Buffer.from(data);

  // Sample head fill just below the band
  const samples = [];
  for (let y = band.maxY + 6; y < band.maxY + 40; y++) {
    for (let x = band.minX - 25; x <= band.maxX + 25; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = i4(x, y, w);
      if (isHeadGray(out[i], out[i + 1], out[i + 2], out[i + 3])) {
        samples.push([out[i], out[i + 1], out[i + 2]]);
      }
    }
  }
  let gr = 72,
    gg = 72,
    gb = 74;
  if (samples.length) {
    gr = (samples.reduce((s, v) => s + v[0], 0) / samples.length) | 0;
    gg = (samples.reduce((s, v) => s + v[1], 0) / samples.length) | 0;
    gb = (samples.reduce((s, v) => s + v[2], 0) / samples.length) | 0;
  }

  // Dilate knot mask slightly
  const dil = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let any = 0;
      for (let dy = -2; dy <= 2 && !any; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (knot.mask[(y + dy) * w + (x + dx)]) {
            any = 1;
            break;
          }
        }
      }
      dil[y * w + x] = any;
    }
  }

  // Erase knot → background black
  for (let p = 0; p < w * h; p++) {
    if (!dil[p]) continue;
    const i = p * 4;
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = 255;
  }

  // Seal crown with a small arc of head gray + outline, using attach as apex-ish
  const R = Math.max(knot.bbox.w, knot.bbox.h) * 0.85;
  const domeCx = knot.attach.x;
  // Place circle center so the top of the circle sits near the old band
  const domeCy = knot.attach.y + R * 0.92;

  for (let y = Math.floor(knot.attach.y - R); y <= band.maxY + 18; y++) {
    for (let x = Math.floor(domeCx - R); x <= Math.ceil(domeCx + R); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x - domeCx;
      const dy = y - domeCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R || dist < R - 28) continue;
      // Only paint where we erased, or a thin fringe into bg above the head
      const p = y * w + x;
      const i = p * 4;
      const erased = dil[p];
      const hole =
        erased ||
        (isBg(out[i], out[i + 1], out[i + 2], out[i + 3]) &&
          y <= band.maxY + 4 &&
          Math.abs(x - domeCx) < R * 0.55);
      if (!hole) continue;
      if (dist > R - 3.5) {
        out[i] = 16;
        out[i + 1] = 16;
        out[i + 2] = 16;
        out[i + 3] = 255;
      } else {
        out[i] = gr;
        out[i + 1] = gg;
        out[i + 2] = gb;
        out[i + 3] = 255;
      }
    }
  }

  const outPath = path.join(OUT, outName);
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(outPath);
  return outPath;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const hat = await makeHat(140);
  const attachments = {
    generatedAt: new Date().toISOString(),
    method:
      "Auto-detect blue topknot tie as attach pivot; rotation from hair-tip vs up. Hat-cover is the recommended lazy path.",
    frames: {},
  };

  for (const frame of FRAMES) {
    const abs = path.join(ROOT, frame.file);
    const { data, w, h } = await loadRaw(abs);
    const bounds = characterBounds(data, w, h);
    const band = findBand(data, w, h, bounds);
    const knot = extractTopknot(data, w, h, band);

    console.log(`\n=== ${frame.key} ===`);
    console.log("attach", knot.attach, "rotationDeg", knot.rotationDeg);
    console.log("topknot bbox", knot.bbox, "pixels", knot.points.length);

    attachments.frames[frame.key] = {
      source: path.basename(frame.file),
      attach: knot.attach,
      rotationDeg: knot.rotationDeg,
      topknotBBox: knot.bbox,
      pixelCount: knot.points.length,
    };

    await debugOverlay(abs, data, w, h, knot, `${frame.key}-debug-attach.png`);
    await compositeHat(
      abs,
      knot.attach,
      knot.rotationDeg,
      hat,
      `${frame.key}-with-hat.png`
    );
    const bald = await removeHair(
      data,
      w,
      h,
      band,
      knot,
      `${frame.key}-bald-attempt.png`
    );
    await compositeHat(
      bald,
      knot.attach,
      knot.rotationDeg,
      hat,
      `${frame.key}-bald-with-hat.png`
    );
  }

  fs.writeFileSync(
    path.join(OUT, "attachments.json"),
    JSON.stringify(attachments, null, 2)
  );
  console.log(`\nWrote outputs to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
