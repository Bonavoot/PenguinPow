/**
 * Afterimage placement along the path the sprite actually traveled.
 *
 * Ghosts are copies of the fighter box (same width, same sole origin),
 * parked on earlier samples. They are not a second drawing offset from
 * the box center. If the body has not moved far enough, no ghost — a
 * copy sitting on the current sole just reads as a double image.
 */

/**
 * @param {Array<{x:number,y:number,src?:string,transform?:string}>} samples
 *        oldest → newest. The last sample is the current body.
 * @param {number[]} distances world px back along the path
 * @returns {Array<{x:number,y:number,src?:string,transform?:string}|null>}
 */
export function trailAnchors(samples, distances) {
  const empty = () => (distances || []).map(() => null);
  if (!samples || samples.length < 2 || !distances || !distances.length) {
    return empty();
  }
  const found = distances.map(() => null);
  const remaining = distances.map((d) => (typeof d === "number" ? d : 0));
  let prev = samples[samples.length - 1];
  for (let i = samples.length - 2; i >= 0; i--) {
    const sample = samples[i];
    const dx = sample.x - prev.x;
    const dy = sample.y - prev.y;
    const seg = Math.hypot(dx, dy);
    if (seg < 0.01) {
      prev = sample;
      continue;
    }
    for (let k = 0; k < remaining.length; k++) {
      if (found[k]) continue;
      if (remaining[k] <= seg) {
        const t = remaining[k] / seg;
        found[k] = {
          x: prev.x + dx * t,
          y: prev.y + dy * t,
          src: sample.src,
          transform: sample.transform,
        };
      } else {
        remaining[k] -= seg;
      }
    }
    prev = sample;
    if (found.every(Boolean)) break;
  }
  return found;
}

/** Low spec keeps one echo. Full keeps two, close enough to read as smear. */
export function trailDistances(lowSpec) {
  return lowSpec ? [22] : [16, 34];
}
