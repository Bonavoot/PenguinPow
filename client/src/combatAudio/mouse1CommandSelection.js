/**
 * Canonical Mouse1 open-game strike command selection for keyboard + gamepad.
 * Facing must come from selectLiveLocalFighter (live snapshot preferred).
 */

import { classifyMouse1Strike, facingKeys } from "./strikeAudioPrediction.js";
import { pushAudioTrace } from "./audioTrace.js";

/**
 * @param {object} opts
 * @param {object} opts.keys - held key state (a/d/s/mouse1…)
 * @param {1|-1|null|undefined} opts.facing - chosen facing
 * @param {1|-1|null|undefined} [opts.roomFacing]
 * @param {1|-1|null|undefined} [opts.liveFacing]
 * @param {string} [opts.facingSource]
 * @param {string} [opts.modeLabel] - diagnostic only; never affects command
 * @param {string} [opts.attemptId]
 * @param {boolean} [opts.trace]
 */
export function selectMouse1StrikeCommand({
  keys,
  facing,
  roomFacing = null,
  liveFacing = null,
  facingSource = "none",
  modeLabel = null,
  attemptId = null,
  trace = true,
} = {}) {
  const classified = classifyMouse1Strike(keys, facing);
  const { forwardKey, backKey } =
    facing === 1 || facing === -1
      ? facingKeys(facing)
      : { forwardKey: null, backKey: null };

  if (trace) {
    pushAudioTrace({
      cue: "*",
      status: "MOUSE1_COMMAND_SELECTED",
      attemptId,
      command: classified.command,
      relativeDir: classified.relativeDir,
      keys: {
        a: !!keys?.a,
        d: !!keys?.d,
        s: !!keys?.s,
        mouse1: !!keys?.mouse1,
      },
      facing,
      roomFacing,
      liveFacing,
      facingSource,
      forwardKey,
      backKey,
      modeLabel,
    });
  }

  return {
    ...classified,
    facing,
    roomFacing,
    liveFacing,
    facingSource,
    forwardKey,
    backKey,
    attemptId,
    modeLabel,
  };
}
