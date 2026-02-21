const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'client', 'src', 'assets');

// All cheering-capable crowd sprites (everything except oyakata)
const SPRITES_TO_GRADE = [
  'crowd-boy-idle-1.png',
  'crowd-boy-idle-2.png',
  'crowd-boy-idle-3.png',
  'crowd-boy-cheering-1.png',
  'crowd-boy-cheering-2.png',
  'crowd-boy-cheering-3.png',
  'crowd-girl-idle-1.png',
  'crowd-girl-cheering-1.png',
  'crowd-geisha-idle-1.png',
  'crowd-geisha-cheering-1.png',
  'crowd-salaryman-idle-1.png',
  'crowd-salaryman-cheering-1.png',
  'crowd-salaryman-idle-2.png',
  'crow-salaryman-cheering-2.png',
  'crowd-oldman-idle-1.png',
  'crowd-oldman-cheering-1.png',
  'crowd-side-idle-1.png',
  'crowd-side-cheering-1.png',
  'crowd-side-idle-2.png',
  'crowd-side-cheering-2.png',
  'crowd-boy-side-idle-1.png',
  'crowd-boy-side-cheering-1.png',
  'crowd-geisha-side-idle-1.png',
  'crowd-geisha-side-cheering-1.png',
  'crowd-girl-side-idle-1.png',
  'crowd-girl-side-cheering-1.png',
  'crowd-salaryman-side-idle-1.png',
  'crowd-salaryman-side-cheering-1.png',
  'crowd-salaryman-side-idle-2.png',
  'crowd-salaryman-side-cheering-2.png',
];

// Baked filter: saturate(0.84) brightness(0.76) contrast(0.95)
// This is the combined CrowdContainer filter + per-member normal filter.
const SAT = 0.84;
const BRI = 0.76;
const CON = 0.95;

// Precompute the saturation matrix coefficients
const sr0 = 0.2126 + 0.7874 * SAT;
const sr1 = 0.7152 - 0.7152 * SAT;
const sr2 = 0.0722 - 0.0722 * SAT;
const sg0 = 0.2126 - 0.2126 * SAT;
const sg1 = 0.7152 + 0.2848 * SAT;
const sg2 = 0.0722 - 0.0722 * SAT;
const sb0 = 0.2126 - 0.2126 * SAT;
const sb1 = 0.7152 - 0.7152 * SAT;
const sb2 = 0.0722 + 0.9278 * SAT;

// Build a lookup table for the full filter chain (saturate → brightness → contrast)
// for each possible 0-255 input, for each channel contribution.
// This avoids repeated float math per pixel.
function buildLUT() {
  const lut = new Uint8Array(256 * 256 * 256 * 3);
  // Too large — use per-pixel math instead with the precomputed coefficients.
  return null;
}

function applyFilters(r, g, b) {
  // Step 1: saturate
  let r1 = r * sr0 + g * sr1 + b * sr2;
  let g1 = r * sg0 + g * sg1 + b * sg2;
  let b1 = r * sb0 + g * sb1 + b * sb2;

  // Step 2: brightness
  r1 *= BRI;
  g1 *= BRI;
  b1 *= BRI;

  // Step 3: contrast (around 0.5 in normalized space)
  r1 = (r1 / 255 - 0.5) * CON + 0.5;
  g1 = (g1 / 255 - 0.5) * CON + 0.5;
  b1 = (b1 / 255 - 0.5) * CON + 0.5;

  return [
    Math.max(0, Math.min(255, Math.round(r1 * 255))),
    Math.max(0, Math.min(255, Math.round(g1 * 255))),
    Math.max(0, Math.min(255, Math.round(b1 * 255))),
  ];
}

async function processSprite(filename) {
  const inputPath = path.join(ASSETS_DIR, filename);
  const name = filename.replace('.png', '');
  const outputPath = path.join(ASSETS_DIR, `${name}-graded.png`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;

  const rawBuffer = await image.raw().toBuffer();
  const output = Buffer.alloc(rawBuffer.length);

  for (let i = 0; i < rawBuffer.length; i += channels) {
    const a = channels === 4 ? rawBuffer[i + 3] : 255;

    if (a === 0) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      if (channels === 4) output[i + 3] = 0;
      continue;
    }

    const [r, g, b] = applyFilters(rawBuffer[i], rawBuffer[i + 1], rawBuffer[i + 2]);
    output[i] = r;
    output[i + 1] = g;
    output[i + 2] = b;
    if (channels === 4) output[i + 3] = a;
  }

  await sharp(output, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log(`  ${filename} -> ${name}-graded.png`);
}

async function main() {
  console.log(`Grading ${SPRITES_TO_GRADE.length} crowd sprites...`);
  console.log(`Filter: saturate(${SAT}) brightness(${BRI}) contrast(${CON})\n`);

  for (const filename of SPRITES_TO_GRADE) {
    await processSprite(filename);
  }

  console.log(`\nDone. ${SPRITES_TO_GRADE.length} graded sprites written to ${ASSETS_DIR}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
