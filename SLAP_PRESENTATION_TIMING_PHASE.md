# Slap Presentation Timing — Phase 14 (REJECTED)

**Status:** Manually rejected and surgically removed.  
**Production slap playback:** original pre–Phase-14 `SLAP_ANIM` director (restored).  
**Contact fidelity:** Phase 13 / 13A remain approved; `COMBAT_CONTACT_FIDELITY_V2` remains **default ON**.

---

## Rejection summary

Manual comparison rejected the `SLAP_PRESENTATION_TIMING_V2` candidate.

| | Legacy (kept) | V2 candidate (removed) |
|---|---|---|
| Smear window | ~37 ms (18→55) | ~15 ms (40→55) |
| At 60 FPS | ~2 smear frames | 0–1 smear frames |
| Feel | Fierce acceleration into contact | Slower / weaker; anticipation → held contact pop |

The retuned presentation looked slower, weaker, and less fierce because compressing the smear removed visible acceleration. That visual downgrade was **not** required for approved contact-fidelity behavior.

### Findings that remain valid

* The crisp **contact pose already aligned** with the **55 ms** active boundary.
* The ~37 ms smear is an **acceptable authored anticipation smear**, not a contact-fidelity defect.
* Future slap improvement is deferred until a **dedicated animation art pass** (new anticipation / smear frames), not another timing-compression experiment.

---

## What was removed

* `SLAP_PRESENTATION_TIMING_V2` flag and Vite `SLAP_` env exposure
* Server/client resolver modules (`slapPresentationTiming.js`, `client/src/slapPresentation/*`)
* Phase 14-only `GameFighter` wiring and debug overlay fields
* Phase 14-only presentation tests

## What was preserved

* `COMBAT_CONTACT_FIDELITY_V2` default ON (unset → V2; `0`/`false` → legacy)
* Phase 13 contact cleanup
* Phase 13A charged-headbutt physical first-contact
* All gameplay timings (slap 55 / 130 / 75), damage, KB, hitstop
* Exact original slap animation playback via `SLAP_ANIM` in `combatTiming.js` / `GameFighter.jsx`

---

## Production slap playback (current)

| Window | Pose | Art |
|---|---|---|
| 0–18 ms | frame 0 | ready stance |
| 18–55 ms | frame 1 | blur/smear (~37 ms) |
| 55–185 ms | frame 2 | contact (active) |
| 185 ms+ | frame 3 | recovery |

No slap-presentation feature flag remains.
