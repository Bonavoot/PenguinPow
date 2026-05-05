/* eslint-disable no-console */
/*
 * One-off image editor: paints a traditional Japanese kesho-mawashi pattern
 * onto the solid-blue panels of pumo-main-menu.png. Generates three variants
 * (seigaiha / asanoha / sakura) so we can pick the best one without re-doing
 * Photoshop work.
 *
 * Usage:  node scripts/add-apron-pattern.cjs
 */
const path = require("path");
const sharp = require("sharp");

// Always paint from the clean solid-blue source so re-runs don't compound
// previous overlays. pumo-main-menu-pre-seigaiha.png is the untouched
// original; pumo-main-menu.png is the live asset the app imports.
const INPUT = path.join(
  __dirname,
  "..",
  "client/src/assets/pumo-main-menu-pre-seigaiha.png"
);
const OUT_DIR = path.join(__dirname, "..", "client/src/assets");

// Apron blue is ~rgb(0, 170, 248). Match generously but exclude near-white,
// near-black, the gold feet, and the orange beak.
function isApronBlue(r, g, b, a) {
  if (a < 200) return false;
  return r < 70 && g > 120 && g < 215 && b > 215;
}

// Restrict pattern to the apron panel band so we don't touch the topknot dot
// or the bottom tassels. Determined empirically from the 1254x1254 source.
const APRON_TOP = 690;
const APRON_BOT = 970;

// Alpha-blend a pattern color onto a base pixel.
function blend(buf, i, pr, pg, pb, alpha) {
  const inv = 1 - alpha;
  buf[i] = Math.round(buf[i] * inv + pr * alpha);
  buf[i + 1] = Math.round(buf[i + 1] * inv + pg * alpha);
  buf[i + 2] = Math.round(buf[i + 2] * inv + pb * alpha);
}

// Build a binary mask of "apron blue" pixels eroded inward by E pixels.
// This keeps generated patterns from spilling into white borders, the white
// diamonds, the apron's outer edge, or the small blue dots embedded in the
// white border band. Erosion uses two passes (horizontal then vertical) which
// gives an LxL square structuring element with L = 2E+1 — close enough to a
// disk for our purposes and fast enough that the whole script stays sub-second.
function buildErodedBlueMask(data, w, h, ch, E) {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (isApronBlue(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        mask[y * w + x] = 1;
      }
    }
  }
  if (E <= 0) return mask;
  // Horizontal erosion
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      if (x - E < 0 || x + E >= w) continue; // image-edge pixels die
      let ok = 1;
      for (let dx = -E; dx <= E; dx++) {
        if (!mask[rowOff + x + dx]) {
          ok = 0;
          break;
        }
      }
      tmp[rowOff + x] = ok;
    }
  }
  // Vertical erosion
  const eroded = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    if (y - E < 0 || y + E >= h) continue;
    for (let x = 0; x < w; x++) {
      let ok = 1;
      for (let dy = -E; dy <= E; dy++) {
        if (!tmp[(y + dy) * w + x]) {
          ok = 0;
          break;
        }
      }
      eroded[y * w + x] = ok;
    }
  }
  return eroded;
}

// ---------------- Pattern: SEIGAIHA (青海波) ocean waves ----------------
// Parameterized so we can stamp out multiple density/scale variants.
//   arcCount  — number of concentric rings per scale (more = denser/fuller scale)
//   outerBleed — extra px the outermost ring extends beyond R, so adjacent
//                same-row scales' outer rings visually merge instead of just
//                touching at a tangent point (closes the "corner gap" eye sees).
function makeSeigaiha({
  R = 26,
  thickness = 2.0,
  arcCount = 7,
  outerBleed = 1.5,
} = {}) {
  const ROW_H = R;
  const COL_W = 2 * R;
  // Evenly-spaced concentric arcs from R down to ~R/arcCount
  const ARC_RADII = [];
  for (let i = 0; i < arcCount; i++) {
    ARC_RADII.push(R * (1 - i / arcCount));
  }
  return function seigaiha(x, y) {
    const rowIdx = Math.ceil(y / ROW_H);
    const yCenter = rowIdx * ROW_H;
    const xOffset = (rowIdx & 1) * R;
    const colIdx = Math.round((x - xOffset) / COL_W);
    const xCenter = xOffset + colIdx * COL_W;
    const dx = x - xCenter;
    const dy = y - yCenter;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > R + outerBleed) return 0;

    let best = Infinity;
    for (const arcR of ARC_RADII) {
      let d;
      if (arcR === R && dist >= R) {
        // Outer ring fattens outward by outerBleed so adjacent scales merge.
        d = Math.max(0, dist - (R + outerBleed));
      } else {
        d = Math.abs(dist - arcR);
      }
      if (d < best) best = d;
    }
    if (best > thickness) return 0;
    return Math.max(0, 1 - best / thickness);
  };
}

// Default seigaiha kept for the asanoha/sakura siblings to compose against.
function seigaihaCoverage(x, y) {
  const R = 26;
  const ROW_H = R;
  const COL_W = 2 * R;
  const ARC_RADII = [R, R * 0.78, R * 0.56, R * 0.34, R * 0.13];
  const THICKNESS = 2.4;

  // Owning row: lowest row whose y_center >= y (so we're inside the top half)
  const rowIdx = Math.ceil(y / ROW_H);
  const yCenter = rowIdx * ROW_H;
  const xOffset = (rowIdx & 1) * R;
  // Nearest column center in that row
  const colIdx = Math.round((x - xOffset) / COL_W);
  const xCenter = xOffset + colIdx * COL_W;

  const dx = x - xCenter;
  const dy = y - yCenter;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let best = Infinity;
  for (const arcR of ARC_RADII) {
    const d = Math.abs(dist - arcR);
    if (d < best) best = d;
  }
  if (best > THICKNESS) return 0;
  // soft edge
  return Math.max(0, 1 - best / THICKNESS);
}

// ---------------- Pattern: ASANOHA (麻の葉) hemp-leaf stars -------------
// Triangular grid of line segments forming six-pointed asanoha stars.
function asanohaCoverage(x, y) {
  const S = 34; // edge length controlling tile size
  const THICKNESS = 1.4;
  const sqrt3 = Math.sqrt(3);
  // Convert to skewed lattice coords
  const gx = x / S;
  const gy = y / (S * sqrt3 * 0.5);

  // Hex/triangle lattice spokes — approximate with three line families
  // running at 0°, 60°, 120° through every lattice node.
  // Distance to nearest line in family at angle theta.
  function distToLineFamily(theta, spacing) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const t = -x * s + y * c; // perpendicular distance from origin
    const m = t / spacing;
    return Math.abs(t - Math.round(m) * spacing);
  }

  // Three line families at 30°, 90°, 150° (perpendiculars of the triangle edges)
  const sp = (S * sqrt3) / 2;
  const d1 = distToLineFamily(Math.PI / 6, sp);
  const d2 = distToLineFamily(Math.PI / 2, sp);
  const d3 = distToLineFamily((5 * Math.PI) / 6, sp);

  // Add inner radial spokes at each hex node for the classic asanoha star.
  // Approximate: also include short diagonals — emerges naturally from the 3
  // line families above for this resolution.
  const best = Math.min(d1, d2, d3);
  if (best > THICKNESS) return 0;
  return Math.max(0, 1 - best / THICKNESS);
}

// ---------------- Pattern: VERTICAL STRIPES ----------------------------
// Very common on real kesho-mawashi. Survives any downscale because it's
// just straight lines. spacing = px between line centers, thickness = px.
function makeVerticalStripes({ spacing = 14, thickness = 4 } = {}) {
  return function (x /* y */) {
    const m = ((x % spacing) + spacing) % spacing;
    const d = Math.min(m, spacing - m);
    if (d > thickness / 2) return 0;
    return 1 - (d / (thickness / 2)) * 0.4; // slight soft edge
  };
}

// ---------------- Pattern: TATE-WAKU (立涌) wavy vertical pairs --------
// Pairs of sinusoidal vertical lines that bulge outward and pinch inward,
// forming gourd-shaped negative space. Traditional Japanese motif, vertical
// orientation so it scales well to small render sizes.
function makeTateWaku({
  colSpacing = 26,
  amplitude = 6,
  period = 70,
  thickness = 3,
} = {}) {
  return function (x, y) {
    const wobble = amplitude * Math.sin((2 * Math.PI * y) / period);
    let m = ((x % colSpacing) + colSpacing) % colSpacing;
    if (m > colSpacing / 2) m -= colSpacing; // signed distance from column center
    // Each column has two mirrored lines, at +wobble and -wobble
    const d = Math.min(Math.abs(m - wobble), Math.abs(m + wobble));
    if (d > thickness / 2) return 0;
    return 1 - (d / (thickness / 2)) * 0.3;
  };
}

// ---------------- Pattern: YUKIWA (雪輪) snowflakes ---------------------
// 6-armed snowflake glyphs on a triangular grid. Winter motif fits the
// snowy dohyo background. Each snowflake is self-contained so they survive
// downsample as bold dot-like marks even when arm detail is lost.
function makeYukiwa({
  tileSize = 32,
  armLen = 10,
  thickness = 2,
} = {}) {
  return function (x, y) {
    // Triangular grid: alternate rows offset by tileSize/2
    const rowIdx = Math.floor(y / tileSize);
    const xOff = (rowIdx & 1) * (tileSize / 2);
    const tx = ((x - xOff) % tileSize + tileSize) % tileSize - tileSize / 2;
    const ty = ((y % tileSize) + tileSize) % tileSize - tileSize / 2;
    const r = Math.sqrt(tx * tx + ty * ty);
    if (r > armLen) return 0;
    const theta = Math.atan2(ty, tx);
    // Distance to nearest of 6 arms
    const sector = Math.PI / 3;
    let a = ((theta + Math.PI * 4) % sector); // positive mod
    a = Math.min(a, sector - a);
    const perp = r * Math.sin(a);
    if (perp > thickness) return 0;
    return Math.max(0, 1 - perp / thickness);
  };
}

// ---------------- Pattern: MIZUTAMA (水玉) polka dots ------------------
// Solid filled dots on a square grid. As bulletproof at small scale as it
// gets — solid disks survive any downsample.
function makeMizutama({
  tileSize = 22,
  dotR = 4.5,
} = {}) {
  return function (x, y) {
    const tx = ((x % tileSize) + tileSize) % tileSize - tileSize / 2;
    const ty = ((y % tileSize) + tileSize) % tileSize - tileSize / 2;
    const r = Math.sqrt(tx * tx + ty * ty);
    if (r <= dotR) return 1;
    const soft = dotR + 1.2 - r;
    return soft > 0 ? Math.max(0, soft / 1.2) : 0;
  };
}

// ---------------- Pattern: SAKURA (桜) cherry blossom ring --------------
function sakuraCoverage(x, y) {
  const TILE = 60;
  const cx = (x % TILE) - TILE / 2;
  const cy = (y % TILE) - TILE / 2;
  const r = Math.sqrt(cx * cx + cy * cy);
  const theta = Math.atan2(cy, cx);
  // 5-petal rose curve: r = a * (1 + 0.4 * sin(5θ)) gives flower silhouette
  // Outline of a 5-petal flower with radius ~14
  const petalR = 14 * (0.65 + 0.45 * Math.abs(Math.cos(2.5 * theta)));
  const dist = Math.abs(r - petalR);
  // Outline thickness
  const THICK = 1.3;
  if (dist < THICK) return Math.max(0, 1 - dist / THICK);
  // small center dot
  if (r < 2.2) return 1;
  return 0;
}

// Iteration 5 finding: source is 1254px but renders ~400px in-menu, so any
// detail under ~3px in source disappears entirely after downscale. Previous
// iterations used 1.7px lines + 5–7 rings + 7px erosion halo — the result
// downsampled to "fragmented dashes" because inner rings vanished and the
// halo broke up what was left. New approach:
//   • 3 rings (not 5–7) — fewer, bolder concentric arcs survive downsample
//   • 4–5px source thickness — readable at display size
//   • larger waves (R=50) — each scale visible at display scale
//   • no erosion — let waves tile naturally up to the white diamond edges
//     instead of leaving a conspicuous cyan halo. (Sides handled by the fact
//     that the apron edges naturally aren't apron-blue: they're white-bordered
//     or transparent.)
const ERODE_PX = 0;

const PATTERNS = [
  {
    name: "tatewaku",
    fn: makeTateWaku({ colSpacing: 26, amplitude: 6, period: 70, thickness: 4 }),
    color: [10, 50, 130],
    alpha: 0.82,
  },
  {
    name: "yukiwa",
    fn: makeYukiwa({ tileSize: 30, armLen: 9, thickness: 2.2 }),
    color: [10, 50, 130],
    alpha: 0.85,
  },
  {
    name: "mizutama",
    fn: makeMizutama({ tileSize: 22, dotR: 4.2 }),
    color: [10, 50, 130],
    alpha: 0.82,
  },
];

(async () => {
  const { data, info } = await sharp(INPUT)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  console.log(`source ${w}x${h} ch=${ch}`);

  console.log(`building eroded blue mask (E=${ERODE_PX})...`);
  const t0 = Date.now();
  const eroded = buildErodedBlueMask(data, w, h, ch, ERODE_PX);
  console.log(`  done in ${Date.now() - t0}ms`);

  for (const { name, fn, color, alpha } of PATTERNS) {
    const out = Buffer.from(data); // clone
    let painted = 0;
    const yStart = Math.max(0, APRON_TOP);
    const yEnd = Math.min(h, APRON_BOT);
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < w; x++) {
        if (!eroded[y * w + x]) continue;
        const cov = fn(x, y);
        if (cov <= 0) continue;
        const i = (y * w + x) * ch;
        blend(out, i, color[0], color[1], color[2], alpha * cov);
        painted++;
      }
    }
    const outPath = path.join(OUT_DIR, `pumo-main-menu-${name}.png`);
    await sharp(out, { raw: { width: w, height: h, channels: ch } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`wrote ${outPath}  (painted ${painted} px)`);
  }
})();
