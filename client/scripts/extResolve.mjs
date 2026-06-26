/**
 * Node ESM loader hook for the bake script.
 *
 * The app's source uses Vite-style extensionless relative imports
 * (e.g. `import x from "../config/bashoConfig"`). Node's ESM resolver requires
 * explicit extensions, so this hook retries failed relative resolutions by
 * appending `.js` and then `/index.js`. It only kicks in on resolution failure,
 * so normal (already-extensioned) imports are untouched.
 *
 * Usage: node --loader ./scripts/extResolve.mjs scripts/bakeSprites.mjs
 */
import path from "node:path";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !path.extname(specifier)
    ) {
      try {
        return await nextResolve(specifier + ".js", context);
      } catch (_) {
        try {
          return await nextResolve(specifier + "/index.js", context);
        } catch (_) {
          throw err;
        }
      }
    }
    throw err;
  }
}
