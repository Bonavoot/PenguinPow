# Combat Audio Fidelity Phase — COMBAT_AUDIO_FIDELITY_V1

**Status:** Implemented (awaiting subjective playtest).  
**Flag:** `COMBAT_AUDIO_FIDELITY_V1` — **default OFF**.  
**Scope:** Presentation/audio only. No combat tuning, hitboxes, damage, stun, or input-command rule changes.

---

## Enable / rollback

```bash
# Playtest enable
COMBAT_AUDIO_FIDELITY_V1=1 npm run dev:web

# Rollback (exact pre-phase combat-audio routing for flagged cues)
COMBAT_AUDIO_FIDELITY_V1=0 npm run dev:web
# also: unset / false
```

Vite exposes `COMBAT_*` via `client/vite.config.js` `envPrefix`.

**Always-on reliability (not flag-gated):**

- Saved volume `0` preserved; volume applied at app init
- Master SFX gain updates live voices
- Pending loop cancel-before-decode
- `slap_parry` ownership → index 0 once per client
- Charge-hold cancels provisional slap whoosh when `charge_start` predicts / server confirms charging
- Gamepad `charge_release` prediction parity
- Continuous charge chord while Mouse1 held (keyboard + gamepad)

---

## 1. Verified charged-hold phantom root cause

**Cause:** Client classifies Mouse1 immediately from locally visible keys. If Mouse1 rises before Down+Forward complete the charge chord, `Game.jsx` predicts **slap** and `GameFighter` schedules a slap whiff at **press + 55ms**. The server may still resolve the same physical chord as **charge** (same-packet events or continuous S+forward-while-Mouse1-held). Charge prediction cleared slap *pose* flags but **did not cancel the pending swing timer**, so the slap/attack swoosh fired during the charge hold.

**Secondary gaps (also fixed):**

- Gamepad lacked local `charge_release` prediction (release whoosh waited on auth confirm only)
- No client continuous `charge_start` when S/forward arrived while Mouse1 already held

---

## 2. Event timeline — before

1. t=0: Mouse1 down (dirs incomplete) → predict slap → schedule slap whiff @ t+55  
2. t=10–40: S+Forward complete → server starts charging; client may clear slap pose  
3. t=55: **pending slap whoosh plays** while holding charge  
4. Later release → charged whoosh @ release+150 (separate path)

## 3. Event timeline — after

1. t=0: Mouse1 → provisional slap audio token @ playAt = inputTs+55 (not delayed by chord grace)  
2. t&lt;50ms: S+Forward → `charge_start` prediction → **cancel** provisional slap/palm audio  
3. Hold: no release/whiff swoosh  
4. Release: one `CHARGED_ATTACK_RELEASE` @ release+150; auth confirm reconciles (no double)  
5. Interrupt/cancel: pending release canceled

---

## 4–6. Prediction / authority / reconcile

| Cue | Local | Remote | Authority |
| --- | --- | --- | --- |
| Slap / palm / charged release whoosh | Predicted at startup seam | Auth snapshot / confirm | Reconcilable |
| RESISTED | — | — | Authoritative `clinch_throw_fail` |
| Rope / Slide Jump launch | — | Snapshot phase edge | Authoritative transition |
| Slide Redirect | — | Snapshot + `claimMovementSmoke` | Same seam as smoke |
| Matador Break | — | `player_hit` `isGored` | Authoritative |
| Slap parry | — | Socket (if emitted) | Index 0 once |

Reconcile: actionId / eventId claim; `confirmCombatCue` / suppress window; no second audible play.

---

## 7. Semantic cue registry (placeholders)

| Cue | Placeholder samples | Notes |
| --- | --- | --- |
| `SLAP_WHIFF` | random slap-whiff | Existing |
| `PALM_WHIFF` | palm-thrust-whiff | Existing |
| `CHARGED_ATTACK_RELEASE` | attack-sound.ogg | Not cinematic launch |
| `CLINCH_THROW_RESISTED` | is-teching-sound | Not Perfect Brace |
| `ROPE_JUMP_LAUNCH` | flap + quiet cropped attack | Restrained |
| `SLIDE_JUMP_LAUNCH` | flap (lower) + quieter attack | Distinct from rope |
| `SLIDE_REDIRECT` | short flap (cropped) | Not full dodge (~1s) |
| `MATADOR_BREAK` | glass-break cropped ~420ms | Quieter than armor break |
| `SLAP_PARRY` | slap-parry-sound | Ownership fixed |

Module: `client/src/combatAudio/`.

---

## 8. Per-cue voice policy (summary)

- Redirect: minInterval 40ms, maxVoices 2/actor, steal oldest  
- Matador Break: maxVoices 1/actor, reject  
- Launches: minInterval 100ms, maxVoices 2  
- RESISTED: minInterval 120ms  
- Short whiffs: allow multi-actor overlap  

---

## 9. Event ownership

| Event | Owner |
| --- | --- |
| `slap_parry` | `index === 0` once + eventId |
| `clinch_throw_fail` | `index === 0` + presentation claim |
| `player_hit` Matador Break | `index === 0` + hitId eventId |
| Ice slide redirect SFX | Same fighter instance + `claimMovementSmoke` |
| Rope/Slide launch SFX | Fighter whose phase edge fires + presentation eventId |

---

## 10–14. Feature implementations

**RESISTED:** On accepted non-`perfectBrace` `clinch_throw_fail`, play `CLINCH_THROW_RESISTED` once. Perfect Brace unchanged (no tech cue — deferred distinct asset).

**Rope Jump launch:** On `ropeJumpPhase` → `active`, with liftoff smoke; cue `ROPE_JUMP_LAUNCH`.

**Slide Jump launch:** On `slideJumpPhase` → `flight`; cue `SLIDE_JUMP_LAUNCH`.

**Slide Redirect:** On successful `claimMovementSmoke(SLIDE_REDIRECT)`; cue `SLIDE_REDIRECT` (short flap). Cadence ~160ms accepted redirects.

**Matador Break:** On `isGored` under V1: `MATADOR_BREAK` glass + `matadorBreak` particle preset (7 shards / shorter life vs `grabArmorBreak` 14 shards). Banner/shake/hit layers unchanged.

---

## 15–16. Volume + loop fixes

- `parseVolumeSetting` preserves `0`; Settings load uses nullish/`parseVolumeSetting`  
- `initGlobalVolumeFromSettings()` from `main.jsx`  
- Master SFX gain = userScale × 2.5; buffer SFX use authored gains  
- `playBuffer(..., loop:true)` returns cancelable pending handle if undecoded  

---

## 17. Dev trace

```js
localStorage.setItem("pumo_audio_trace", "1") // optional force
window.__PUMO_AUDIO.dump()
window.__PUMO_AUDIO.summary()
window.__PUMO_AUDIO.clear()
```

Records compact cue/status/action/event fields. No console spam by default.

---

## 18–20. Flag semantics

- OFF: legacy `playSound` / `scheduleSwingSound` for most combat whooshes; new coverage cues off  
- ON: semantic orchestrator for listed cues + coverage  
- Always-on fixes listed above  

---

## 21–22. Tests + commands run

```bash
node --test client/src/combatAudio/*.test.js
# → 27 pass / 0 fail

# Lint changed client paths (see report)
npx eslint <changed files> --max-warnings 0
```

**Not run (prohibited this phase):** `npm run build`, vite/electron/Steam packaging, sprite bake, audio generation.

Server gameplay code was **not** modified; full server suite not required for this phase.

---

## 23. Manual playtest matrix

Do **not** mark passed until you audition.

### Devices
- [ ] Keyboard/mouse  
- [ ] Gamepad / Steam Deck-style  

### Perspectives
- [ ] Local player  
- [ ] Remote opponent  
- [ ] Both fighter indices  
- [ ] Host and non-host if roles differ  

### Network
- [ ] Normal local  
- [ ] Moderate latency  
- [ ] High latency / delayed auth confirm  

### Charged attack
- [ ] Clean S+Forward+M1 hold — **no** phantom swoosh  
- [ ] M1 slightly before dirs — **no** phantom; release once  
- [ ] Dirs before M1 — clean  
- [ ] Short / long charge release — one timed whoosh  
- [ ] Interrupted hold — no delayed release  
- [ ] Round end during hold — no orphan whoosh  
- [ ] Rapid slap then charge / charge then slap  
- [ ] Controller release parity  

### RESISTED
- [ ] Ordinary resisted throw — one tech cue  
- [ ] Repeated distinct resists  
- [ ] Perfect Brace — **not** ordinary RESISTED sound  
- [ ] Throw success — silent for this cue  
- [ ] Other throw fail reasons  

### Movement
- [ ] Rope Jump accepted liftoff — restrained launch  
- [ ] Rope Jump denied/canceled — silent  
- [ ] Slide Jump accepted / denied  
- [ ] Single redirect + max cadence (~160ms)  
- [ ] Rejected redirect cooldown — silent  
- [ ] Both players redirect near-simultaneously — neither drops  
- [ ] Listen for mud / flamming / fatigue  

### Matador Break
- [ ] Matador success — no glass  
- [ ] Matador whiff no hit — no glass  
- [ ] Hit during Matador / recovery — glass + small shards + banner  
- [ ] Ordinary hit — no Matador glass  
- [ ] Compare to Shatter Palm / grab armor break — family resemblance, not identical  

### Volume / lifecycle
- [ ] Start with saved volume 0 — muted  
- [ ] Non-default saved volume at boot  
- [ ] Change volume while SFX playing — live change  
- [ ] Enter/leave matches; strafe loop start/stop around preload  
- [ ] Rematch / return to menu — no orphan loops or delayed cues  

---

## 24. Audio coverage table

| Interaction | Classification |
| --- | --- |
| Slap startup/whiff | Covered (V1 semantic / legacy); chord cancel fixed |
| Slap contact | Covered (existing hit path) |
| Charged hold | Intentionally silent |
| Charged release/whiff | Covered + phantom fix |
| Charged contact | Covered (existing) |
| Palm thrust whiff/contact | Covered |
| Parry / slap parry | Covered; slap_parry ownership fixed |
| Matador success | Intentionally mostly silent beyond existing |
| Matador Break | **Missing → implemented (V1)** |
| Grab entry | Covered (existing) |
| Clinch tech | Covered (`isTeching` on tech FX) |
| Throw RESISTED | **Missing → implemented (V1)** |
| Perfect Brace | Visual only — **deferred** distinct SFX |
| Throw launch / landing | Partial / cinematic; normal landing **deferred** |
| Armor break | Covered (glass + grabArmorBreak) |
| Rope Jump launch | **Missing → implemented (V1)** |
| Rope Jump flight/landing | Landing smoke exists; flight intentionally light |
| Slide start | Smoke covered; start SFX out of scope |
| Slide redirect | Smoke existed; **SFX missing → implemented (V1)** |
| Slide Jump launch | **Missing → implemented (V1)** |
| Flap launch/flight/landing | Covered (existing flap path) |
| Butt slam | Covered via flap hit path |
| Ring-out / round-end | Partial existing; out of scope polish |
| Counter Throw / Deep Grip callouts | **Deferred** original assets |
| UI callouts needing audio | Mixed; out of scope except RESISTED |

---

## 25. Deferred original-asset recommendations

- Perfect Brace stinger (distinct from RESISTED/tech)  
- Dedicated charged-release swoosh (vs generic attack)  
- Purpose-built slide redirect transient  
- Normal throw landing / Counter Throw / Deep Grip cues  
- Shorter Matador-specific shatter sample (replace cropped glass)  

---

## 26. Remaining risks

- Mix levels are **unverified** until playtest (placeholder gains in `cueRegistry.js`)  
- Glass crop length for Matador may need tuning  
- Redirect flap may feel thin or busy at max cadence — adjust gain/rate in registry  
- Feature flag OFF still gets charge phantom fix + volume/loop/`slap_parry` ownership  
