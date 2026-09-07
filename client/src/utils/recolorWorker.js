/**
 * Web Worker for sprite recolorization.
 *
 * The heavy pixel pass lives in recolorCore.js (the single source of truth
 * shared with the main-thread fallback and the build-time bake script). This
 * worker is just the off-main-thread message wrapper around it.
 *
 * NOTE: this is a MODULE worker (instantiated with { type: "module" }), which
 * is what lets it `import` the shared core.
 */

import { processImageData } from "./recolorCore.js";

// Full off-main-thread pipeline: the main thread only loads the <img> and
// transfers an ImageBitmap. Readback (getImageData), the pixel pass,
// putImageData and PNG encoding all happen here, so a sprite recolor costs the
// main thread microseconds instead of the 5–30 ms per sheet that produced
// multi-second stalls during the opening exchanges of a match.
async function recolorBitmap(payload, id) {
  const {
    bitmap,
    sourceColorRange,
    targetHue,
    targetSat,
    targetLight,
    referenceLightness,
    specialMode,
    hitTintRed,
    chargeTintWhite,
    blubberTintPurple,
    armorTintPink,
    bodyColorRange,
    bodyTargetHue,
    bodyTargetSat,
    bodyTargetLight,
    bodyReferenceLightness,
    skipMawashiRecolor,
  } = payload;
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, width, height);
  const processed = processImageData(
    imageData,
    sourceColorRange,
    targetHue,
    targetSat,
    targetLight,
    referenceLightness,
    specialMode,
    !!hitTintRed,
    width,
    height,
    !!chargeTintWhite,
    !!blubberTintPurple,
    !!armorTintPink,
    bodyColorRange || null,
    bodyTargetHue || 0,
    bodyTargetSat || 0,
    bodyTargetLight || 50,
    bodyReferenceLightness || 49,
    !!skipMawashiRecolor
  );
  ctx.putImageData(processed, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  self.postMessage({ type: "recolor_blob", id, payload: { blob, width, height } });
}

self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  if (type === "recolor_bitmap") {
    recolorBitmap(payload, id).catch((error) => {
      try {
        payload.bitmap && payload.bitmap.close && payload.bitmap.close();
      } catch (_) {
        /* ignore */
      }
      self.postMessage({ type: "recolor_error", id, payload: { error: error && error.message ? error.message : String(error) } });
    });
    return;
  }

  if (type === "recolor") {
    const {
      imageData,
      sourceColorRange,
      targetHue,
      targetSat,
      targetLight,
      referenceLightness,
      width,
      height,
      specialMode,
      hitTintRed,
      chargeTintWhite,
      blubberTintPurple,
      armorTintPink,
      bodyColorRange,
      bodyTargetHue,
      bodyTargetSat,
      bodyTargetLight,
      bodyReferenceLightness,
      skipMawashiRecolor,
    } = payload;

    try {
      const newImageData = {
        data: new Uint8ClampedArray(imageData),
      };

      const processedData = processImageData(
        newImageData,
        sourceColorRange,
        targetHue,
        targetSat,
        targetLight,
        referenceLightness,
        specialMode,
        !!hitTintRed,
        width,
        height,
        !!chargeTintWhite,
        !!blubberTintPurple,
        !!armorTintPink,
        bodyColorRange || null,
        bodyTargetHue || 0,
        bodyTargetSat || 0,
        bodyTargetLight || 50,
        bodyReferenceLightness || 49,
        !!skipMawashiRecolor
      );

      self.postMessage(
        {
          type: "recolor_complete",
          id,
          payload: {
            imageData: processedData.data.buffer,
            width,
            height,
          },
        },
        [processedData.data.buffer]
      );
    } catch (error) {
      self.postMessage({
        type: "recolor_error",
        id,
        payload: { error: error.message },
      });
    }
  }
};
