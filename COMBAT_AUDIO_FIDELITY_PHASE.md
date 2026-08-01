# Combat Audio Fidelity Phase — COMBAT_AUDIO_FIDELITY_V1

**Status:** Corrective pass after player audition (awaiting re-audition).  
**Flag:** `COMBAT_AUDIO_FIDELITY_V1` — **default OFF**.  
**Scope:** Presentation/audio only. No combat tuning, hitboxes, damage, stun, or input-command rule changes.

---

## Enable / rollback

```bash
# Playtest enable
COMBAT_AUDIO_FIDELITY_V1=1 npm run dev:web

# Rollback
COMBAT_AUDIO_FIDELITY_V1=0 npm run dev:web
```

Vite exposes `COMBAT_*` via `client/vite.config.js` `envPrefix`.

---

## Corrective pass (player audition) — RETRACTIONS

### Retracted: charged whoosh at release +150 ms

**Wrong (v1 initial):** Schedule `CHARGED_ATTACK_RELEASE` at release + `SWING_STARTUP_MS.charged` (~150 ms), treating hitbox startup as the whoosh seam.

**Correct:** Cue is `CHARGED_LUNGE_BEGIN`. It fires when charged **locomotion/execution** begins (`isAttacking` + charged, not palm/low-kick), immediately on that transition. `CHARGED_STARTUP_MS` / `isInStartupFrames` remain gameplay/hitbox-only and do **not** delay this sound.

| State | Audio |
| --- | --- |
| `CHARGE_HOLD` (`isChargingAttack`) | Silence (no lunge whoosh) |
| `CHARGED_LUNGE_BEGIN` (release accepted → forward move starts) | Immediate whoosh |
| Deferred (e.g. dodge pending) | No whoosh until lunge actually begins |
| Remote | Immediate on first auth rising edge; eventId dedupe |

### Retracted: Perfect Brace intentionally silent

Player rejected silence. Perfect Brace now plays `CLINCH_PERFECT_BRACE` (isTeching + quiet rawParrySuccess accent).

### Retracted: Slide Redirect = flap

Player rejected. `SLIDE_REDIRECT` now uses **dodge** sample at dodge gain `0.02`, rate `1.0`, with **real** voice steal/fade-stop (max 1 voice/actor).

### Retracted: Matador glass cropped to 420 ms

Forced `source.stop` crop removed; glass plays its natural tail.

---

## Live charge phantom — why the unit test passed but gameplay failed

1. Mouse1 → `applyPrediction("slap")` → `pred.isAttacking = true`, whoosh scheduled @ +55 ms.  
2. S+Forward → `applyPrediction("charge_start")`.  
3. Cancellation lived **inside** `if (canPredictAction(...))`.  
4. `canPredictAction()` returned **false** because the fresh provisional slap still had `pred.isAttacking`.  
5. Charge-start body never ran → timer survived → whoosh during hold.  
6. Isolated `onKeysWhileMouse1Held` tests passed, but production never canceled when the gate blocked pose prediction.

**Fix:** On `charge_start`, **always** cancel provisional slap/palm audio first. Pose prediction may still supersede a fresh provisional slap via `shouldPredictChargeHoldPose()` even when the generic gate is closed.

---

## Semantic cue registry (current)

| Cue | Samples | Notes |
| --- | --- | --- |
| `SLAP_WHIFF` | slap-whiff | Cancelable provisional |
| `PALM_WHIFF` | palm-thrust-whiff | |
| `CHARGED_LUNGE_BEGIN` | attack-sound | Immediate at lunge; alias `CHARGED_ATTACK_RELEASE` → same |
| `CLINCH_THROW_RESISTED` | isTeching @ **0.04** | Auth fail; failId + one claim path |
| `CLINCH_PERFECT_BRACE` | isTeching + rawParrySuccess | Higher prestige than RESISTED |
| `ROPE_JUMP_LAUNCH` | flap + quiet attack | Approved |
| `SLIDE_JUMP_LAUNCH` | flap + quiet attack | Approved |
| `SLIDE_REDIRECT` | **dodge** @ 0.02 | Real voice steal; same smoke seam |
| `MATADOR_BREAK` | glassBreak **no durationMs** | Natural tail |
| `SLAP_PARRY` | slap-parry | index 0 |

---

## Cinematic variant contract (server → client)

| Variant | When | Launch package | Western `gunLaunchSound` |
| --- | --- | --- | --- |
| `demolished_charged` | Normal charged cinematic kill | Yes | **Yes** |
| `matador_break` | Gored/Matador charged cinematic (or matadorKill) | Yes | **No** |
| `ap_pull` | AP pull kill | No | No |

Server emits `cinematicVariant` on `cinematic_kill`. Client classifies via `resolveCinematicVariant()` (legacy `apPullKill` / `matadorKill` / `isGored` fallbacks).

---

## RESISTED live silence root cause

Handler returned early on Perfect Brace with no sound (by design then). Ordinary RESISTED called the orchestrator, but integration was not fixture-tested; gain was also slightly below the proven grab-tech path (`0.035` vs `0.04`).

**Fix:** Shared `applyClinchThrowFailPresentationAndAudio()` — one successful presentation claim owns **both** visual and audio; RESISTED gain `0.04`; Perfect Brace layered cue.

---

## Voice steal

`playSound` returns `playBuffer` handles. `playCueLayers` returns `stopAll`. Orchestrator stores `stopAll` per active voice and invokes it on oldest-steal (short fade). Redirect tests assert `getVoiceStopCount() >= 1`.

---

## Dev trace

```js
localStorage.setItem("pumo_audio_trace", "1")
window.__PUMO_AUDIO.dump()
window.__PUMO_AUDIO.summary()
window.__PUMO_AUDIO.clear()
```

Statuses include: `PROVISIONAL_SLAP_*`, `CHARGE_HOLD_BEGIN`, `CHARGED_LUNGE_BEGIN`, `RESISTED_HANDLER_RECEIVED`, `CLINCH_*_PLAYED`, `SLIDE_REDIRECT_*`, `MATADOR_BREAK_PLAYED`, `CINEMATIC_VARIANT`, `GUN_CUE_PLAYED` / `GUN_CUE_SKIPPED`.

---

## Automated tests

```bash
node --test client/src/combatAudio/*.test.js
# 23 pass / 0 fail

npm run test:contact --prefix server-io
# 47 pass / 0 fail
```

---

## Manual playtest (do not mark passed)

### Charge
- [ ] Hold S+Forward, then hold Mouse1 — silence during hold  
- [ ] Mouse1 a few ms before S+Forward — no provisional slap whoosh if charge resolves  
- [ ] Directions before Mouse1 — clean  
- [ ] Tap / medium / full release — whoosh on **first forward move frame**, not ~150 ms late  
- [ ] Cancel hold without lunge — zero lunge whoosh  
- [ ] Deferred release (dodge) — whoosh when lunge actually starts  
- [ ] Keyboard + gamepad  

### Clinch
- [ ] Ordinary RESISTED — audible tech vocabulary (~grab-tech)  
- [ ] Repeated distinct RESISTED  
- [ ] Perfect Brace — audible, more distinguished than RESISTED  
- [ ] Failed PB timing / successful throw  

### Redirect
- [ ] Sounds like Dodge, not flap  
- [ ] Rapid ~160 ms redirects — no pile-up, no missing accepted  
- [ ] Rejected cooldown silent  
- [ ] Both players independent  

### Matador / cinematic
- [ ] Glass completes naturally  
- [ ] Matador cinematic kill — **no** western gun  
- [ ] Normal DEMOLISHED cinematic — gun present  
- [ ] AP pull unchanged  

---

## Remaining risks

- Dodge sample at 160 ms redirect cadence may still feel thick — steal helps; gain may need playtest tweak  
- Perfect Brace layer mix unverified subjectively  
- Master volume routing changes from prior pass remain in effect  
