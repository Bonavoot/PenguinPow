# Combat Audio Fidelity Phase — COMBAT_AUDIO_FIDELITY_V1

**Status:** Finalized after player audition.  
**Flag:** `COMBAT_AUDIO_FIDELITY_V1` — **default ON**.  
**Scope:** Presentation/audio only. No combat tuning, hitboxes, damage, stun, or input-command rule changes.

---

## Enable / rollback

```bash
# Normal development (V1 ON)
npm run dev:web

# Explicit enable
COMBAT_AUDIO_FIDELITY_V1=1 npm run dev:web

# Emergency rollback (exact V1 OFF / legacy path)
COMBAT_AUDIO_FIDELITY_V1=0 npm run dev:web
```

| Value | Result |
| --- | --- |
| unset / null / empty | **V1 ON** |
| `1` / `true` | **V1 ON** |
| `0` / `false` | **V1 OFF** (rollback) |

Vite exposes `COMBAT_*` via `client/vite.config.js` `envPrefix`. Canonical parser: `client/src/combatAudio/combatAudioFidelityFlags.js`.

---

## Player-verified: charged-attack phantom palm

**Manually verified fixed** (player audition): charged-attack input no longer plays false `palm-thrust-whiff.ogg` / `PALM_WHIFF` during charge hold.

### Approved timeline

1. S + Forward + Mouse1 → charge hold accepted  
2. Charge hold may play the intended charging grunt  
3. **No** palm or slap whiff during hold  
4. Player-controlled charge duration unchanged  
5. On release, when actual forward charged locomotion begins → one `CHARGED_LUNGE_BEGIN` immediately  
6. No artificial +150 ms delay; not aligned to hitbox-active  
7. Interrupted/canceled charge with no lunge → no lunge whoosh  
8. Legitimate Back + Mouse1 palm retains its sound exactly once  

### Two-part root cause (proven)

1. **Stale room-summary facing** at the `Game.jsx` input seam (`rooms[]` / lobby summary) after cross-ups — Forward misread as Back → local `palm_thrust` while server correctly charged. Live facing now comes from `fighterSnapshotBus` (room summary only as pre-snapshot fallback).  
2. **Orphaned direct palm schedule** in `GameFighter` (`palm_predict` via bare `scheduleCombatCue`) outside provisional ownership — `charge_start` / auth charge cancel could not find it. Provisional slap/palm now use predictor-owned action IDs.

### Mode parity

Custom PvP, VS CPU, and BASHO share the same human `Game.jsx` listeners and server `fighter_action` → `processInputPacket` path. CPU-only code (`updateCPUAI` / `processCPUInputs`) is opponent AI. BASHO/CPU exposed the shared race through more frequent side changes — not separate human combat/audio implementations.

---

## Frozen charge/palm contract

1. Live `fighterSnapshotBus` facing preferred over stale room-summary facing.  
2. Room-summary state is only a pre-snapshot fallback.  
3. S + Forward + Mouse1 always has priority over palm.  
4. Both mirrored facings resolve correctly.  
5. Keyboard/mouse and gamepad use the same canonical classifier.  
6. Mode flags do not affect human strike classification.  
7. Provisional slap and palm cues have retained action ownership.  
8. Local `charge_start` cancels incompatible provisional strike audio before generic prediction gates.  
9. Authoritative charge hold is a reconciliation backstop.  
10. A canceled palm schedule cannot later fire.  
11. Exact-action cancellation cannot affect the opponent’s legitimate cue.  
12. Long charge hold contains zero slap, palm, or lunge whooshes.  
13. Charged lunge sound begins immediately with actual lunge locomotion.  
14. Local prediction plus authority produces one lunge cue.  
15. Legitimate palm and slap sounds remain exactly once.  
16. Reset, interruption, and unmount clear pending ownership.  
17. Late exact-action fade-stop remains bounded and cannot broadly stop unrelated voices.

---

## Corrective history (retained)

### Retracted: charged whoosh at release +150 ms

**Wrong (v1 initial):** Schedule at release + `SWING_STARTUP_MS.charged` (~150 ms).  
**Correct:** `CHARGED_LUNGE_BEGIN` fires when charged locomotion begins, immediately.

| State | Audio |
| --- | --- |
| `CHARGE_HOLD` (`isChargingAttack`) | Charge grunt as designed; no palm/slap/lunge whoosh |
| `CHARGED_LUNGE_BEGIN` | Immediate whoosh once |
| Deferred (e.g. dodge pending) | No whoosh until lunge actually begins |
| Remote | Immediate on first auth rising edge; eventId dedupe |

### Other approved corrections (preserved)

- Perfect Brace: `CLINCH_PERFECT_BRACE` (not silent)  
- Slide Redirect: dodge sample + real voice steal  
- Matador glass: natural duration (no forced 420 ms crop)  
- Cinematic gun: only `demolished_charged`  
- Charge-start always cancels provisional slap/palm audio before `canPredictAction` gates  

Do not alter Matador / DEMOLISHED gun / RESISTED / Perfect Brace / dodge-redirect / rope-jump or slide-jump launch layers, charge grunt, legitimate palm sample, or master volume in follow-ups without a new phase.

---

## Semantic cue registry (current)

| Cue | Samples | Notes |
| --- | --- | --- |
| `SLAP_WHIFF` | slap-whiff | Cancelable provisional |
| `PALM_WHIFF` | palm-thrust-whiff | Owned provisional + auth confirm |
| `CHARGED_LUNGE_BEGIN` | attack-sound | Immediate at lunge |
| `CLINCH_THROW_RESISTED` | isTeching @ **0.04** | Auth fail; failId + one claim path |
| `CLINCH_PERFECT_BRACE` | isTeching + rawParrySuccess | Higher prestige than RESISTED |
| `ROPE_JUMP_LAUNCH` | flap + quiet attack | Approved |
| `SLIDE_JUMP_LAUNCH` | flap + quiet attack | Approved |
| `SLIDE_REDIRECT` | **dodge** @ 0.02 | Real voice steal |
| `MATADOR_BREAK` | glassBreak **no durationMs** | Natural tail |
| `SLAP_PARRY` | slap-parry | index 0 |

Intentional authored Matador uses of `palmThrustWhiffSound` outside the semantic palm predict path are preserved.

---

## Dev trace

```js
localStorage.setItem("pumo_audio_trace", "1")
window.__PUMO_AUDIO.dump()
window.__PUMO_AUDIO.summary()
window.__PUMO_AUDIO.clear()
copy(JSON.stringify(window.__PUMO_AUDIO.dumpChargePalm(), null, 2))
```

---

## Automated tests

```bash
node --test client/src/combatAudio/*.test.js client/src/prediction/liveLocalFighter.test.js
```

Focused suite covers live facing, mode/kb-gp parity, provisional ownership, charge reclass, auth backstop, actor isolation, lunge once, and flag default ON / rollback OFF.

**Final focused total (lock-in):** 59 pass / 0 fail.

**No production build / Vite production build / Electron / Steam / asset pipeline was run during this phase.**

---

## Manual playtest

### Charged-attack phantom palm — player verified

- [x] Charge hold: grunt only; no palm/slap whoosh  
- [x] Release: lunge whoosh when forward locomotion starts (no +150 ms)  
- [x] Facing after cross-ups uses live fighter state  
- [x] Legitimate Back + Mouse1 palm retains sound  
- [x] Same human path in Custom PvP / VS CPU / BASHO  

### Broader checklist (not marked verified by this finalization)

- [ ] Mouse1 a few ms before S+Forward — chord cancel  
- [ ] Cancel hold without lunge — zero lunge whoosh  
- [ ] Deferred release (dodge) — whoosh when lunge actually starts  
- [ ] Gamepad charge/palm parity (code-covered; subjective feel open)  
- [ ] Ordinary RESISTED / Perfect Brace subjective mix  
- [ ] Rapid redirect cadence feel  
- [ ] Matador glass / cinematic gun subjective confirmation  
