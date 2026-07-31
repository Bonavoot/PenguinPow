# Offensive Aerial Contact Fidelity — Phase 3

**Status:** Implemented (2026-07-31). Presentation / metadata only.  
**Module:** `server-io/offensiveAerialContact.js`  
Does **not** change slam eligibility, damage, knockback, recovery, or Rope Jump.

---

## Contact convention

| Concept | Definition |
|---------|------------|
| Normal | Unit vector from **defender → attacker** |
| Attacker anchor | Point on attacker slam surface |
| Defender anchor | Point on defender body surface |
| Shared `contactX/Y` | Midpoint between the two surface anchors |
| Axis | `LATERAL` \| `DOWNWARD` \| `DOWNWARD_DIAGONAL` \| `DEGENERATE_FALLBACK` |

Same convention for `HIT` and `PARRIED`.

---

## Geometry source

Matches the existing slam detector dimensions:

- Horizontal attacker half: `HITBOX_DISTANCE_VALUE * 0.7 * sizeMult`
- Defender body half: full pushbox half (`getPushboxHalfWidth`)
- Vertical defender band: `[GROUND, GROUND + 100]` (`FLAP_BODYSLAM_CONTACT_HEIGHT`)
- Attacker belly band around feet `y`

**Not** tip-rail. **Not** client sprite pixels.

### Lateral

- Anchors on facing edges (attacker right / defender left when attacker is left, mirrored otherwise)
- `contactY` = center of vertical overlap
- Normal primarily horizontal

### Downward / dive

- Anchors on lower attacker / upper defender overlap
- Diagonal when dive (or strong descent) has meaningful `|relVx|`
- Normal primarily upward (defender → attacker above), with horizontal component when diagonal

### Crossing-side

- Side from root order / relative velocity; stored on outcome at resolve
- Contact immutable after first terminal write — post-hit travel cannot rewrite it

### Same-center

- Deterministic tie-break: relative Hx → previous X → dive/facing → stable `+1`
- `fallbackUsed=true`, `geometrySource=SAME_CENTER_TIEBREAK`
- Never NaN; never changes hit/parry result

---

## Outcome integration

On `HIT` / `PARRIED`, before cleanup mutates positions:

- `computeOffensiveAerialContact`
- Persist compact fields on `offensiveAerial`: `contactX/Y`, `contactNormalX/Y`, `contactAxis`, `geometrySource`, `fallbackUsed`
- Emit on `player_hit` / `raw_parry_success` via `toEffectContactPayload` (adds `contactX/Y`; keeps backward-compatible event shape)
- Duplicate poll: idempotent — contact not overwritten
- `WHIFF` / `INTERRUPTED` / `LANDED_WITHOUT_CONTACT`: no combat contact

---

## Effect placement

- Flap `player_hit` now includes `contactX`/`contactY` (previously omitted → client `x+70` fallback)
- Raw parry success uses the same contact fields
- Client `contactFxX` already prefers `data.contactX`
- Effect timing/type/count unchanged; double-poll still one emit (latch)

---

## Strike-contact reuse

| Reused | Adapted | Kept separate |
|--------|---------|---------------|
| Surface-anchor + seam idea | Body AABB overlap instead of tip | Tip length / park / extension sep |
| Finite sanitization mindset | Slam width scale + contact height | Facing-only attack dir |
| Test “midpoint vs seam” spirit | Defender→attacker normal | Slap tip quality |

---

## Quantitative scan (representative)

From `contact-fidelity.test.js` scan (11 samples):

| Metric | Value |
|--------|------:|
| Max old-midpoint → new contact Δ | ~43.6 px |
| Median Δ | ~31.1 px |
| Max surface-anchor gap | ~50.5 px |
| Fallback cases | 1 (same-center dive) |

---

## Deferred / later

- ~~Post-hit reaction ownership / parry recoil~~ → Phase 4 approved (`OFFENSIVE_AERIAL_REACTION_V2` default ON, `heavy_short`)  
- Land settle deferred; armor, pose hurtboxes, dedicated recoil art — still later
