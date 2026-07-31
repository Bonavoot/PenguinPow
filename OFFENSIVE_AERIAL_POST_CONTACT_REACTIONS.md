# Offensive Aerial Post-Contact Reactions — Phase 4

**Status:** **Approved and default ON** (`heavy_short`, 2026-07-31 manual playtest).  
**Module:** `server-io/offensiveAerialReaction.js`  
**Flag:** `server-io/offensiveAerialFlags.js`

`npm run dev:web` with no env vars uses this architecture.

Rollback to Phase 3 instant ground-snap:

```bash
OFFENSIVE_AERIAL_REACTION_V2=0 npm run dev:web
```

---

## Approved candidate — `heavy_short`

Manual playtesting approved `heavy_short` as the production default.

**Intended visual identity:** after a successful raw parry, the airborne attacker’s committed dive/FLAP is canceled and they continue heavily downward into an unsafe landing — not a floaty bounce, large horizontal knockback, upward launch, or ground teleport.

Intentionally avoided:

- Floaty recoil / apex hang  
- Excessive horizontal knockback  
- Unnatural upward bounce  
- Visible ground teleport  
- Large rebound mirrors of incoming velocity  

Playtest also did **not** observe meaningful landing overlap, first-grounded separation snaps, or strange side-switching — so **Phase 5 generalized landing settle is deferred**.

---

## Reaction states

| State | Meaning |
|-------|---------|
| `NONE` | No reaction |
| `HIT_CONTINUATION` | Successful slam; authored flight continues |
| `PARRIED_RECOIL` | Airborne heavy recoil after raw parry |
| `WHIFF_DESCENT` | Armed whiff ownership (set at touchdown handoff) |
| `INTERRUPTED_FALL` | Cleared mid-air by external clearAll / hit |
| `LANDING_APPROACH` | Reserved |
| `LANDING_RECOVERY` | Post-touchdown recovery / stagger |
| `COMPLETE` | Cleared |

Outcome enum (`HIT` / `PARRIED` / …) remains the combat result. Reaction says what owns the attacker **after**.

---

## Outcome → reaction mapping

| Outcome | Reaction (V2 ON) |
|---------|------------------|
| `HIT` | `HIT_CONTINUATION` (at contact) |
| `PARRIED` | `PARRIED_RECOIL` (at contact; non-lethal) |
| `WHIFF` | `WHIFF_DESCENT` → `LANDING_RECOVERY` at touchdown |
| `LANDED_WITHOUT_CONTACT` | plain landing handoff |
| `INTERRUPTED` | `INTERRUPTED_FALL` (bookkeeping; hitstun owns motion) |
| AP kill | Legacy ground cinematic (no V2 recoil) |

---

## Movement ownership

| Reaction | Owner |
|----------|-------|
| `HIT_CONTINUATION` | Existing slide-jump / FLAP / dive integrator (`POST_HIT_TRAVEL`) |
| `PARRIED_RECOIL` | `stepParriedRecoil` only — no flap spend, dive, or air steer |
| `WHIFF_DESCENT` | Existing integrator until touchdown |
| `LANDING_RECOVERY` | Grounded; no aerial integrator |
| Flag OFF | No reaction record; legacy paths |

---

## Animation ownership

Wire field: `offensiveAerialReactionType` (compact string).

| Reaction | Presentation |
|----------|--------------|
| `PARRIED_RECOIL` / `LANDING_RECOVERY` | `recovering` pose (not active dive/FLAP) |
| `HIT_CONTINUATION` | Existing slide-jump / dive art |
| Landing phase | Existing landing / recovering |

No new sprites. Limitation: recoil reuses recovering art rather than a dedicated tumble.

---

## Heavy parry-recoil identity (`heavy_short`)

- Small horizontal rejection away from defender (contact side)
- Tiny upward interruption on lateral; downward contacts soften plunge only
- Strong gravity (`FLAP_FASTFALL_GRAVITY * 1.15`)
- Anti-cross clamp vs defender while airborne
- Boundary clamp discards overflow (no redirect through defender)
- Grounded stagger begins only after touchdown

### Contact-normal use

Normal is evidence (defender→attacker), not a full launch mirror.

| Axis | Recoil |
|------|--------|
| `LATERAL` | Away + small lift |
| `DOWNWARD` | Small away + soften down / tiny reject |
| `DOWNWARD_DIAGONAL` | Blend |
| `DEGENERATE_FALLBACK` | Conservative away from relative position |

---

## Control restoration

- Legacy (`V2=0`): contact → immediate ground + `AP_STAGGER_FLAP_MS` (500ms)
- V2: `controlRestoreAt = max(contact + 500ms, touchdown + minLand)` capped by `+ maxExtra` (250ms for `heavy_short`)
- Never shorter than legacy
- Airborne recoil time counts toward the consequence

---

## Presets

| Preset | Role |
|--------|------|
| `heavy_short` | **Approved production default** |
| `heavy_medium` | Dev comparison only |
| `legacy_snap` | Force Phase 3 snap while V2 flag is ON (comparison) |

Unset `OFFENSIVE_AERIAL_REACTION_PRESET` → `heavy_short`.

---

## Invariants

1. One reaction per attack instance  
2. Hitbox stays dead after HIT/PARRIED  
3. Reaction cannot restore contact  
4. Stale reaction cannot mutate a newer attack  
5. Grounded stagger not shown before touchdown (V2)  
6. Flag OFF ignores reaction movement/anim  
