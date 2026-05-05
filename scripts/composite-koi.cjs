/* eslint-disable no-console */
/*
 * Composites the AI-generated koi+waves embroidery onto the apron blue panel.
 * Uses flood-fill from image corners to derive an alpha mask (the AI didn't
 * produce a transparent background, but wave whites inside navy outlines
 * aren't reachable from the corners, so they stay as content).
 *
 * Generates a couple of size variants so we can pick the right scale.
 *
 * Usage:  node scripts/composite-koi.cjs
 */
const path = require("path");
const sharp = require("sharp");

const APRON_PNG = path.join(
  __dirname,
  "..",
  "client/src/assets/pumo-main-menu-pre-seigaiha.png"
);
const KOI_PNG = path.join(
  __dirname,
  "..",
  "..",
  "..",
  ".cursor/projects/home-bonavoot-Development-PenguinPow/assets/koi-symbol-v1.png"
);
const OUT_DIR = path.join(__dirname, "..", "client/src/assets");

// Apron blue panel (1254x1254 source coordinates).
// X is the horizontal middle of the apron. Y is no longer the panel center —
// instead, each variant specifies a topY (where the top of the koi image
// sits) so we can pin the koi's head just below the rope belt.
const APRON_CENTER_X = 596;

function isApronBlue(r, g, b, a) {
  if (a < 200) return false;
  return r < 70 && g > 120 && g < 215 && b > 215;
}

function blend(buf, i, pr, pg, pb, alpha) {
  const inv = 1 - alpha;
  buf[i] = Math.round(buf[i] * inv + pr * alpha);
  buf[i + 1] = Math.round(buf[i + 1] * inv + pg * alpha);
  buf[i + 2] = Math.round(buf[i + 2] * inv + pb * alpha);
}

// Posterize each RGB channel to `levels` discrete values. Reduces the AI
// embroidery's smooth gradients down to flat color bands so the koi looks
// hand-drawn rather than photo-detailed.
function posterizeRgba(rgba, levels) {
  const step = 255 / (levels - 1);
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.round(Math.round(out[i] / step) * step);
    out[i + 1] = Math.round(Math.round(out[i + 1] / step) * step);
    out[i + 2] = Math.round(Math.round(out[i + 2] / step) * step);
  }
  return out;
}

// Snap every visible pixel to one of a small fixed cartoon palette. Most
// extreme stylization — kills all gradient detail and forces the koi into
// the same kind of flat-fill-with-bold-color look the penguin has.
function quantizeToPalette(rgba, palette) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 8) continue;
    const r = out[i], g = out[i + 1], b = out[i + 2];
    let best = 0, bestD = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0];
      const dg = g - palette[p][1];
      const db = b - palette[p][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    out[i] = palette[best][0];
    out[i + 1] = palette[best][1];
    out[i + 2] = palette[best][2];
  }
  return out;
}

// Add a dark outline by darkening pixels whose alpha differs strongly from
// neighbours (silhouette edge) or whose color differs strongly from
// neighbours (interior edge). Mimics the bold black outlines on the penguin.
function addOutline(rgba, w, h, thickness, color) {
  const out = Buffer.from(rgba);
  const isEdge = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3];
      if (a < 8) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          if (dx === 0 && dy === 0) continue;
          const j = ((y + dy) * w + (x + dx)) * 4;
          if (rgba[j + 3] < 8) edge = true;
        }
      }
      if (edge) isEdge[y * w + x] = 1;
    }
  }
  // Dilate edges to thickness
  let cur = isEdge;
  for (let t = 1; t < thickness; t++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cur[y * w + x]) { next[y * w + x] = 1; continue; }
        if (x > 0 && cur[y * w + (x - 1)]) next[y * w + x] = 1;
        else if (x < w - 1 && cur[y * w + (x + 1)]) next[y * w + x] = 1;
        else if (y > 0 && cur[(y - 1) * w + x]) next[y * w + x] = 1;
        else if (y < h - 1 && cur[(y + 1) * w + x]) next[y * w + x] = 1;
      }
    }
    cur = next;
  }
  for (let p = 0; p < w * h; p++) {
    if (!cur[p]) continue;
    const i = p * 4;
    if (out[i + 3] < 8) continue;
    out[i] = color[0];
    out[i + 1] = color[1];
    out[i + 2] = color[2];
  }
  return out;
}

// Flood fill from the four edges of the image. A pixel is treated as
// "background" if it's near-gray-white (R≈G≈B, value > 232) AND reachable
// from any edge through a chain of similar pixels. This preserves white
// wave-fills that are enclosed by darker navy outlines (those whites aren't
// reachable from the edges).
function buildContentMask(data, w, h, ch) {
  const isBgCandidate = (idx) => {
    const i = idx * ch;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (Math.abs(r - g) > 12) return false;
    if (Math.abs(g - b) > 12) return false;
    if (Math.abs(r - b) > 12) return false;
    return r > 232;
  };
  const isBg = new Uint8Array(w * h);
  // Stack-based DFS using 32-bit packed (y << 16 | x).
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    stack[top++] = (y << 16) | x;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (top > 0) {
    const enc = stack[--top];
    const x = enc & 0xffff;
    const y = (enc >>> 16) & 0xffff;
    const idx = y * w + x;
    if (isBg[idx]) continue;
    if (!isBgCandidate(idx)) continue;
    isBg[idx] = 1;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return isBg; // 1 = background, 0 = content
}

// Soft alpha around the content edge: average the binary mask in a 3x3 to
// avoid jaggies at the silhouette.
function softenMask(isBg, w, h) {
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let count = 0;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += isBg[yy * w + xx] ? 0 : 1;
          count++;
        }
      }
      alpha[y * w + x] = Math.round((sum / count) * 255);
    }
  }
  return alpha;
}

// Strict mode: koi only shows on apron-blue pixels in the central panel
// band — never on any white element (rope, tassels, white border) and never
// on the small blue squares in the bottom border or the bottom blue tassels.
// topY = where the top edge of the koi image sits in the source — chosen so
// the koi's HEAD lands just below the rope belt rather than centered.
const ROPE_BOTTOM_Y = 715;
// Two paintable regions exist in the apron:
//   - the diamond panel (white tassels on blue)  ~715..935
//   - the bottom blue tassels (light blue)       ~940..985
// The strip 935..940 is the white middle border. Variants either confine the
// koi to the panel only, or allow it to extend through both regions (the
// white border is naturally skipped because !isApronBlue).
// 4-color cartoon palette — gold body, deep gold shadow, navy outline,
// off-white highlight. Mimics the limited palette of the penguin art.
const CARTOON_PALETTE = [
  [225, 175, 70],   // bright gold (body)
  [165, 110, 40],   // deep gold (shadow)
  [25, 35, 75],     // navy (outline / dark accents)
  [245, 235, 215],  // ivory (highlight)
];
const OUTLINE_COLOR = [20, 25, 50];

// Hand-drawn SVG koi — flat fills + thick black outline, matching the
// penguin's cartoon style. Much smaller file than AI image, no scale
// detail at all. Pose: koi curving like a yin-yang half-circle, head at
// top-left, tail at bottom-right.
const SVG_KOI = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="500" viewBox="0 0 1100 500">
  <g fill="#e6b340" stroke="#1a1530" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">
    <!-- Body: curved fish silhouette, single closed path -->
    <path d="
      M 180 230
      C 180 130, 320 60, 470 70
      C 640 80, 800 150, 900 240
      C 960 290, 980 360, 940 410
      C 880 470, 770 460, 700 410
      C 640 370, 600 340, 540 340
      C 440 340, 340 360, 260 320
      C 200 290, 180 270, 180 230
      Z" />
    <!-- Top fin -->
    <path d="M 540 80 L 600 30 L 660 90 L 620 130 Z" />
    <!-- Bottom fin -->
    <path d="M 480 330 L 470 410 L 560 380 L 540 320 Z" />
    <!-- Tail flare -->
    <path d="M 880 320 L 1020 280 L 1050 380 L 940 420 Z" />
  </g>
  <g fill="#c8801a" stroke="none">
    <!-- Subtle two-tone shading along belly (still flat fill, no gradients) -->
    <path d="M 260 280 C 360 320, 540 320, 700 300 L 700 340 C 540 360, 360 360, 260 320 Z" opacity="0.85" />
  </g>
  <g fill="#1a1530" stroke="none">
    <!-- Eye: solid black dot, just like the penguin's eyes -->
    <circle cx="280" cy="180" r="14" />
    <!-- Mouth: tiny curve -->
    <path d="M 215 240 Q 235 252 255 245" stroke="#1a1530" stroke-width="10" stroke-linecap="round" fill="none" />
    <!-- Gill curve -->
    <path d="M 340 165 Q 355 220 345 270" stroke="#1a1530" stroke-width="9" stroke-linecap="round" fill="none" />
  </g>
  <g fill="#f5ebd7" stroke="#1a1530" stroke-width="6" stroke-linejoin="round">
    <!-- Eye highlight (white dot inside black dot — not used here, dot is solid) -->
    <!-- Belly highlight band -->
    <path d="M 320 300 C 440 330, 600 330, 720 310 C 700 340, 580 348, 440 340 C 360 335, 320 325, 320 300 Z" />
  </g>
</svg>`;

// Each variant: displayWidth in source coords, alpha for blending, topY for
// vertical placement, paintBotY for max y painted, plus stylization params.
const SIZES = [
  { name: "koi-cartoon-d80", displayWidth: 940, alpha: 0.95, topY: ROPE_BOTTOM_Y + 80, paintBotY: 990, palette: CARTOON_PALETTE, median: 7 },
  { name: "koi-cartoon-d110", displayWidth: 940, alpha: 0.95, topY: ROPE_BOTTOM_Y + 110, paintBotY: 990, palette: CARTOON_PALETTE, median: 7 },
  { name: "koi-cartoon-d140", displayWidth: 940, alpha: 0.95, topY: ROPE_BOTTOM_Y + 140, paintBotY: 990, palette: CARTOON_PALETTE, median: 7 },
];

(async () => {
  // Load apron
  const aprIm = sharp(APRON_PNG);
  const aprMeta = await aprIm.metadata();
  const { data: aprData, info: aprInfo } = await aprIm
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = aprInfo.width,
    h = aprInfo.height,
    ch = aprInfo.channels;
  console.log(`apron ${w}x${h} ch=${ch}`);

  // Load koi at native size, derive content mask. We crop the source first
  // to drop the bottom waves band — the koi fish itself lives in the top
  // ~65% of the source image; the lower portion is mostly waves/foam. By
  // cropping at the source we let the remaining art fit cleanly in the
  // apron panel band without the fish having to be tiny.
  const KOI_CROP_BOTTOM_FRAC = 0.32; // drop bottom 32% of source (keep ~68%)
  const koiMeta = await sharp(KOI_PNG).metadata();
  const cropH = Math.round(koiMeta.height * (1 - KOI_CROP_BOTTOM_FRAC));
  const koiNative = await sharp(KOI_PNG)
    .extract({ left: 0, top: 0, width: koiMeta.width, height: cropH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  console.log(
    `koi cropped ${koiNative.info.width}x${koiNative.info.height} ch=${koiNative.info.channels} (was ${koiMeta.width}x${koiMeta.height})`
  );
  const koiW0 = koiNative.info.width,
    koiH0 = koiNative.info.height;
  const koiData0 = koiNative.data;
  console.log("computing content mask via flood fill...");
  const t0 = Date.now();
  const isBg = buildContentMask(koiData0, koiW0, koiH0, koiNative.info.channels);
  const alphaMask0 = softenMask(isBg, koiW0, koiH0);
  console.log(`  done in ${Date.now() - t0}ms`);

  // Build a koi RGBA buffer with derived alpha (so resizing also resamples
  // the alpha cleanly).
  const rgba0 = Buffer.alloc(koiW0 * koiH0 * 4);
  for (let p = 0; p < koiW0 * koiH0; p++) {
    const si = p * koiNative.info.channels;
    rgba0[p * 4] = koiData0[si];
    rgba0[p * 4 + 1] = koiData0[si + 1];
    rgba0[p * 4 + 2] = koiData0[si + 2];
    rgba0[p * 4 + 3] = alphaMask0[p];
  }

  for (const cfg of SIZES) {
    let resized;
    if (cfg.useSvg) {
      console.log(`-- ${cfg.name}: rasterizing SVG koi at width ${cfg.displayWidth}`);
      resized = await sharp(Buffer.from(SVG_KOI), { density: 300 })
        .resize(cfg.displayWidth, null, { kernel: "lanczos3" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } else {
      const targetW = cfg.displayWidth;
      const targetH = Math.round((targetW / koiW0) * koiH0);
      console.log(
        `-- ${cfg.name}: resizing koi to ${targetW}x${targetH}` +
          ` (median=${cfg.median ?? 0}, posterize=${cfg.posterizeLevels ?? "off"})`
      );

      let stylized = rgba0;
      if (cfg.median && cfg.median > 0) {
        stylized = await sharp(stylized, {
          raw: { width: koiW0, height: koiH0, channels: 4 },
        })
          .median(cfg.median)
          .raw()
          .toBuffer();
      }
      if (cfg.posterizeLevels && cfg.posterizeLevels > 1) {
        stylized = posterizeRgba(stylized, cfg.posterizeLevels);
      }
      if (cfg.palette) {
        stylized = quantizeToPalette(stylized, cfg.palette);
      }
      if (cfg.outline && cfg.outline > 0) {
        stylized = addOutline(stylized, koiW0, koiH0, cfg.outline, OUTLINE_COLOR);
      }

      resized = await sharp(stylized, {
        raw: { width: koiW0, height: koiH0, channels: 4 },
      })
        .resize(targetW, targetH, { kernel: "lanczos3" })
        .raw()
        .toBuffer({ resolveWithObject: true });
    }
    const koiW = resized.info.width,
      koiH = resized.info.height;
    const koiData = resized.data;

    const out = Buffer.from(aprData);
    const sx = Math.round(APRON_CENTER_X - koiW / 2);
    const sy = Math.round(cfg.topY);

    const paintBotY = cfg.paintBotY;
    let painted = 0;
    for (let y = 0; y < koiH; y++) {
      const dy = sy + y;
      if (dy < 0 || dy >= h) continue;
      if (dy < ROPE_BOTTOM_Y - 5 || dy > paintBotY) continue;
      for (let x = 0; x < koiW; x++) {
        const dx = sx + x;
        if (dx < 0 || dx >= w) continue;
        const dstI = (dy * w + dx) * ch;
        if (
          !isApronBlue(
            aprData[dstI],
            aprData[dstI + 1],
            aprData[dstI + 2],
            aprData[dstI + 3]
          )
        )
          continue;
        const si = (y * koiW + x) * 4;
        const sa = koiData[si + 3];
        if (sa < 8) continue;
        const a = (sa / 255) * cfg.alpha;
        blend(out, dstI, koiData[si], koiData[si + 1], koiData[si + 2], a);
        painted++;
      }
    }

    const outPath = path.join(OUT_DIR, `pumo-main-menu-${cfg.name}.png`);
    await sharp(out, { raw: { width: w, height: h, channels: ch } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`   wrote ${outPath} (painted ${painted} px)`);
  }
})();
