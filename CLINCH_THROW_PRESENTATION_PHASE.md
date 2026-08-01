# Clinch / Grab / Throw Presentation Phase 8

**Date:** 2026-07-31  
**Status:** Complete for discrete clinch/grab/throw presentation only.  
Continuous Drive/Plant/strain/arm-pose FX remain state-owned (no per-tick events).  
Low kick remains disabled and was not migrated. Rope Jump unchanged.

Extends `server-io/combatPresentationEvent.js` and client `combatPresentation` consume paths.

---

## Inventory summary (migrated discrete paths)

| Interaction | Trigger | Asset / FX | Presentation |
|-------------|---------|------------|--------------|
| Grab break | `grab_break` | grab-break sheet + banner | `CLINCH_GRAB_BREAK` |
| Counter grab | `counter_grab` | clamped sheet + banner | `CLINCH_COUNTER_GRAB` |
| Clinch TECH | `clinch_callout` `type=grab_tech` | GrabTech rings | `CLINCH_TECH` |
| Clinch tumble | `clinch_tumble` + shake | shake (no second TECH) | `CLINCH_TUMBLE` |
| Jolt single/mutual | `clinch_jolt` | ClinchJoltEffect | `CLINCH_JOLT` / `_MUTUAL` |
| Counter throw callout | `clinch_callout` | HUD | `CLINCH_COUNTER_THROW_CALLOUT` |
| Throw fail / Perfect Brace | `clinch_throw_fail` | HUD / hype stamp | `CLINCH_THROW_FAIL` / `_PERFECT_BRACE` |
| Deep Grip grant | `deep_grip` | HUD (body glow stays continuous) | `CLINCH_DEEP_GRIP` |
| Kill throw launch | `clinch_kill_throw` | trail + SFX | `CLINCH_KILL_THROW_LAUNCH` |
| Throw / kill land | `screen_shake` + land edge | `throwLand` / kill land particles | `CLINCH_THROW_LAND` / `_KILL_THROW_LAND` |
| Grab armor break/absorb | existing sockets | particles | armor profiles |

**Not migrated to events (intentional continuous / pose):** Drive rim, Plant pose, strain sweat, deep-grip body/arm glow, grab push foot trail, stun stars, grab-arm overlay.

---

## Contract extensions

- Event type: `CLINCH`
- Optional compact fields: `clinchInstanceId`, `interactionType`, `initiatorId`, `responderId`, `throwType`, `gripState`
- Anchors: `CLINCH_SEAM`, `GRIP_CONTACT`, `SHARED_CENTER`, `THROW_RELEASE`, `THROW_LANDING`, `RING_BOUNDARY` (available)
- Orientation: `MOVEMENT` (drive/jolt/pull/launch direction)
- `ensureClinchInstanceId` / cleared on clinch cleanup (presentation-only field on fighters)

No new Socket.IO channel. TECH reuses `clinch_callout` with `type=grab_tech`.

---

## Invariants enforced

1. One discrete interaction → one logical `eventId`
2. No Drive/Plant per-tick presentation
3. Failed / Perfect Brace cannot select launch/land success profiles
4. Launch vs land salts keep distinct ids
5. Client `claimPresentationEvent` dedupe (cap 256); jolt gated to `index===0`
6. Presentation attach cannot mutate clinch gameplay flags

---

## Intentional visible changes

1. **Clinch jolt** — only index-0 GameFighter spawns VFX/SFX (fixes double spawn).
2. **Clinch TECH** — spawned from authoritative `grab_tech` callout instead of snapshot rising edge (same art; prevents double/miss timing drift).
3. **Throw land** — may use presentation `x/y` when `screen_shake` carries `combatPresentation` (same particle emitters).

---

## Deferred art (not implemented)

### GROUND_STRIKE_EFFECT_ART_NEEDS / CLINCH deferred

**Authored rear-force / behind-defender pressure sprite** for Palm Thrust, Shatter Palm, and highly charged headbutt was discussed and is **deferred**. No suitable authored asset exists. Do not approximate with CSS or generic particles.

---

## Tests

`server-io/test/clinch/clinch-presentation.test.js`  
Runs with existing clinch suite (`npm run test:clinch --prefix server-io`).
