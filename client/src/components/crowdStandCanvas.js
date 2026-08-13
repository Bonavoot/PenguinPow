/**
 * Single-canvas crowd stands.
 *
 * 421 filtered <img>s plus live DoF were the GPU bomb. One 3× canvas is a
 * static texture under the camera; cheers just redraw. Sprites keep their
 * linework; a source-atop luma wash after the draw is atmospheric
 * perspective (back rows recede, ringside stays packed).
 */

const imageCache = new Map();

export function ensureCrowdImage(src) {
  if (!src) return null;
  let img = imageCache.get(src);
  if (img) return img;
  img = new Image();
  img.decoding = "async";
  img.src = src;
  imageCache.set(src, img);
  return img;
}

export function preloadCrowdImageUrls(urls) {
  urls.forEach(ensureCrowdImage);
}

export function whenCrowdImagesReady(urls) {
  return Promise.all(
    urls.map((src) => {
      const img = ensureCrowdImage(src);
      if (!img) return Promise.resolve();
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (typeof img.decode === "function") {
        return img.decode().catch(() => undefined);
      }
      return new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );
}

/** Cover max camera zoom (~1.55) with headroom so sprites stay crisp. */
export const CROWD_CANVAS_SCALE = 3;

export function sizeCrowdCanvas(canvas, cssW, cssH, scale = CROWD_CANVAS_SCALE) {
  const w = Math.max(1, Math.round(cssW * scale));
  const h = Math.max(1, Math.round(cssH * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   members: Array<{id:number,x:number,y:number,size:number,typeIndex:number,flip?:boolean}>,
 *   types: Array<{idle:string, cheering:string}>,
 *   cheeringIds: Set<number>,
 *   cssW: number,
 *   cssH: number,
 * }} opts
 */
export function drawCrowdStand(ctx, opts) {
  const { members, types, cheeringIds, cssW, cssH } = opts;
  const canvas = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!cssW || !cssH || !members?.length) return;

  const sx = canvas.width / cssW;
  const sy = canvas.height / cssH;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const sorted = members.slice().sort((a, b) => b.y - a.y);
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const type = types[m.typeIndex];
    if (!type) continue;
    const src = cheeringIds.has(m.id) ? type.cheering : type.idle;
    const img = imageCache.get(src) || ensureCrowdImage(src);
    if (!img || !img.naturalWidth) continue;

    const w = (m.size / 100) * cssW;
    const h = w * (img.naturalHeight / img.naturalWidth);
    const cx = (m.x / 100) * cssW;
    const spriteBottom = cssH * (1 - m.y / 100);
    const y = spriteBottom - h;

    if (m.flip) {
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - w / 2, y, w, h);
    }
  }

  applyCrowdAtmosphere(ctx, cssW, cssH);
}

/**
 * Luma-only depth. Far stands (top of the canvas) lose highlight punch so
 * pale faces stop competing with wrestlers. Ringside is almost untouched.
 * source-atop = one fill, no live CSS filter, no hue shift.
 */
function applyCrowdAtmosphere(ctx, cssW, cssH) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const wash = ctx.createLinearGradient(0, 0, 0, cssH);
  wash.addColorStop(0, "rgba(6, 8, 14, 0.4)");
  wash.addColorStop(0.2, "rgba(6, 8, 14, 0.28)");
  wash.addColorStop(0.4, "rgba(6, 8, 14, 0.12)");
  wash.addColorStop(0.56, "rgba(6, 8, 14, 0.04)");
  wash.addColorStop(0.7, "rgba(6, 8, 14, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.restore();
}
