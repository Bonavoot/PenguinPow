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

self.onmessage = function (e) {
  const { type, payload, id } = e.data;

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
