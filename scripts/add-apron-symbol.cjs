/* eslint-disable no-console */
/*
 * Companion to add-apron-pattern.cjs — instead of a tiled pattern, paints a
 * SINGLE central hero symbol onto the apron, with the white zig-zag diamonds
 * naturally appearing in front (because we only paint over apron-blue pixels).
 * Mirrors how real yokozuna kesho-mawashi feature a centered crest/motif.
 *
 * Usage:  node scripts/add-apron-symbol.cjs
 */
const path = require("path");
const sharp = require("sharp");

const INPUT = path.join(
  __dirname,
  "..",
  "client/src/assets/pumo-main-menu-pre-seigaiha.png"
);
const OUT_DIR = path.join(__dirname, "..", "client/src/assets");

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

// Center of the apron blue panel, measured against the 1254x1254 source.
const APRON_CENTER_X = 596;
const APRON_CENTER_Y = 830;

// Each symbol is rendered as an SVG, rasterized by sharp, then composited
// only onto apron-blue source pixels.
const SYMBOLS = [
  {
    name: "fuji",
    // Mt Fuji silhouette with snowcap. Iconic Japanese motif, ties in with
    // the snowy dohyo background.
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="320" viewBox="0 0 540 320">
      <polygon points="270,30 40,300 500,300"
        fill="rgb(15,50,130)" stroke="rgb(15,50,130)"
        stroke-width="3" stroke-linejoin="round"/>
      <polygon points="270,30 200,150 222,128 244,165 268,98 292,162 314,128 336,150 270,30"
        fill="white"/>
    </svg>`,
    alpha: 0.88,
  },
  {
    name: "hinomaru",
    // Japanese flag's rising sun — single bold red disc. Maximum simplicity,
    // maximum readability at any render scale.
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="0 0 380 380">
      <circle cx="190" cy="190" r="160" fill="rgb(195,30,40)"/>
    </svg>`,
    alpha: 0.92,
  },
  {
    name: "sakura",
    // Five-petal cherry blossom with deeper-pink outline + gold center.
    svg: (() => {
      const petals = [];
      for (let i = 0; i < 5; i++) {
        const angle = ((i * 72 - 90) * Math.PI) / 180;
        const cx = Math.cos(angle) * 95;
        const cy = Math.sin(angle) * 95;
        const rot = i * 72;
        petals.push(
          `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="85" ry="58" ` +
            `transform="rotate(${rot}, ${cx.toFixed(1)}, ${cy.toFixed(1)})" ` +
            `fill="rgb(255,205,215)" stroke="rgb(210,70,95)" stroke-width="6"/>`
        );
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="460" viewBox="0 0 460 460">
        <g transform="translate(230,230)">
          ${petals.join("\n          ")}
          <circle cx="0" cy="0" r="24" fill="rgb(220,170,40)" stroke="rgb(180,120,30)" stroke-width="3"/>
        </g>
      </svg>`;
    })(),
    alpha: 0.92,
  },
];

(async () => {
  const { data, info } = await sharp(INPUT)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  console.log(`source ${w}x${h} ch=${ch}`);

  for (const sym of SYMBOLS) {
    const symBuf = await sharp(Buffer.from(sym.svg)).png().toBuffer();
    const { data: symData, info: symInfo } = await sharp(symBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const symW = symInfo.width;
    const symH = symInfo.height;

    const out = Buffer.from(data);
    const sx = Math.round(APRON_CENTER_X - symW / 2);
    const sy = Math.round(APRON_CENTER_Y - symH / 2);

    let painted = 0;
    for (let y = 0; y < symH; y++) {
      const dstY = sy + y;
      if (dstY < 0 || dstY >= h) continue;
      for (let x = 0; x < symW; x++) {
        const dstX = sx + x;
        if (dstX < 0 || dstX >= w) continue;
        const dstI = (dstY * w + dstX) * ch;
        const r = data[dstI];
        const g = data[dstI + 1];
        const b = data[dstI + 2];
        const a = data[dstI + 3];
        if (!isApronBlue(r, g, b, a)) continue;
        const symI = (y * symW + x) * 4;
        const symA = symData[symI + 3];
        if (symA < 10) continue;
        const symR = symData[symI];
        const symG = symData[symI + 1];
        const symB = symData[symI + 2];
        const finalAlpha = (symA / 255) * sym.alpha;
        blend(out, dstI, symR, symG, symB, finalAlpha);
        painted++;
      }
    }

    const outPath = path.join(OUT_DIR, `pumo-main-menu-symbol-${sym.name}.png`);
    await sharp(out, { raw: { width: w, height: h, channels: ch } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`wrote ${outPath} (painted ${painted} px)`);
  }
})();
