// ============================================
// MASTERY OVERHAUL — FEATURE FLAGS
// ============================================
// Every phase of the mastery overhaul lives behind its own kill-switch flag,
// OFF by default until tuned. With all flags off, the sim MUST be byte-identical
// to pre-overhaul behavior (global invariant #4). Each new gameplay branch checks
// its flag before applying any ceiling-only effect.
//
// Phase 0 (instrumentation & cleanup) intentionally reads NONE of these flags —
// its changes are either non-gameplay (telemetry), dead-code removal, or the
// explicit projectile ring-out consistency fix. The flags exist now purely as the
// shared substrate the later phases wire into.

module.exports = {
  MASTERY_P1_MOMENTUM: true, // Phase 1 — momentum inheritance
  MASTERY_P2_POSTURE: true, // Phase 2 — posture coupling (ON for playtest)
  MASTERY_P3_CADENCE: false, // Phase 3 — tsuppari cadence (OFF)
  MASTERY_P4_ANALOG: true, // Phase 4 — analog resolutions + risk dials (ON for playtest)
  MASTERY_P5_ASSISTS: true, // Phase 5 — assist removal & legibility (ON for playtest)
};
