#!/usr/bin/env node
/**
 * Phase 0 — Validate BODY_SRCS ↔ stem-table positional coupling in cosmetics.js.
 *
 * Does not fix the mapping; fails if lengths diverge (silent mis-association risk).
 * Also checks FLAP1/FLAP2 stems exist for every head-gear overlay table.
 *
 * Usage: node client/scripts/perf/validateCosmeticMappings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const file = path.join(ROOT, "client/src/config/cosmetics.js");
const text = fs.readFileSync(file, "utf8");

function extractArray(name) {
  const re = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`);
  const m = text.match(re);
  assert.ok(m, `missing ${name}`);
  return m[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim().replace(/,$/, ""))
    .filter(Boolean);
}

function extractObjectKeys(name) {
  const re = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`);
  const m = text.match(re);
  assert.ok(m, `missing ${name}`);
  const keys = [];
  for (const line of m[1].split("\n")) {
    const km = line.match(/^\s*(?:["']([^"']+)["']|([A-Za-z0-9_-]+))\s*:/);
    if (km) keys.push(km[1] || km[2]);
  }
  return keys;
}

const body = extractArray("BODY_SRCS");
const topHat = extractObjectKeys("TOP_HAT_BY_STEM");
const crown = extractObjectKeys("CROWN_BY_STEM");
const halo = extractObjectKeys("HALO_BY_STEM");
const plunger = extractObjectKeys("PLUNGER_BY_STEM");
const ponytail = extractObjectKeys("PONYTAIL_BY_STEM");

assert.equal(
  body.length,
  topHat.length,
  `BODY_SRCS (${body.length}) must match TOP_HAT_BY_STEM keys (${topHat.length}) — positional mapFromStemTable`,
);

for (const [name, keys] of [
  ["CROWN_BY_STEM", crown],
  ["HALO_BY_STEM", halo],
  ["PLUNGER_BY_STEM", plunger],
  ["PONYTAIL_BY_STEM", ponytail],
]) {
  assert.equal(
    keys.length,
    topHat.length,
    `${name} key count (${keys.length}) != TOP_HAT_BY_STEM (${topHat.length})`,
  );
  for (const required of ["pumo-flap-1", "pumo-flap-2", "sliding", "dodging", "recovering"]) {
    assert.ok(keys.includes(required), `${name} missing stem ${required}`);
  }
}

// Fragile coupling warning (informational — still exit 0 if lengths match)
console.log(
  JSON.stringify(
    {
      ok: true,
      bodySrcCount: body.length,
      stemCount: topHat.length,
      coupling: "positional via mapFromStemTable(BODY_SRCS index → STEM_ORDER[i])",
      risk: "Reordering BODY_SRCS or TOP_HAT_BY_STEM keys silently remaps overlays",
      flapStemsPresent: true,
      gearTablesChecked: [
        "TOP_HAT_BY_STEM",
        "CROWN_BY_STEM",
        "HALO_BY_STEM",
        "PLUNGER_BY_STEM",
        "PONYTAIL_BY_STEM",
      ],
    },
    null,
    2,
  ),
);
