# BASHO MODE — Implementation Spec & Handoff Document

> **How to use this doc:** This is the source-of-truth spec for building PenguinPow's new
> single-player **BASHO** career/roguelite mode. It is written so a fresh AI agent (or a
> future you) can pick up implementation with no prior context. Work is split into **phases** —
> do NOT try to build everything in one pass. Build the MVP (Phases 0–3) first, polished, then
> layer on the rest. Read the **Guardrails** section before writing any code.

---

## 1. Vision (one paragraph)

PenguinPow is a 2D penguin sumo ring-out fighter (Online PvP + VS CPU) heading to Steam. Its
single-player offering is currently just "fight the CPU forever," which is not sticky. **BASHO**
turns single-player into the game's *main* mode: an authentic sumo **career ladder with roguelite
flavor**. Each run is one *basho* (tournament); you fight a sequence of best-of-1 bouts against
scaling CPU opponents, and your win/loss record promotes or demotes you up the real sumo banzuke
(Jonokuchi → Yokozuna). Progression lives in two speeds: a slow *persistent* layer (attributes,
an ability loadout, currency, unlocks) and a fast *per-run* layer (drafting special power-ups that
stack for that basho). It must feel **premium / AAA**, not like a cheap web game.

---

## 2. GUARDRAILS (read first — non-negotiable)

1. **PvP AND VS CPU are both sacred and untouched.** None of BASHO's stats, loadouts, unlocks, or
   currency may affect PvP / online / Custom Match **or VS CPU** in any way. In PvP both penguins are
   identical except the one power-up each player picks pre-match. **VS CPU is simply "PvP with a CPU
   AI in the second slot" — it is a protected baseline that gets the SAME firewall treatment as PvP.**
   BASHO progression is a *single-player-only sandbox*. Any change to shared combat code must be gated
   so it only applies in a BASHO match context (`matchMode === "basho"`).
   - **One exception, narrowly scoped:** the CPU's *behavior / difficulty* (AI brain, reaction tuning,
     adding EASY/NORMAL/IMPOSSIBLE tiers) MAY evolve in later phases and that is fine. What must NOT
     change is the **VS CPU match itself** — its first-to-2 format, fighter parity (both slots
     identical except the one pre-match power-up), and all combat math. The bot may get smarter; the
     match it plays in stays exactly as it is today.
2. **Do not break existing modes — prefer a forked BASHO match context over mutating shared paths.**
   Custom Match (PvP) and VS CPU must keep working exactly as they do today. BASHO reuses the CPU
   *pipeline* (see §4.3), but every BASHO-specific behavior — best-of-1, stat modifiers, loadout
   effects, named opponents — MUST be gated behind `matchMode === "basho"` (or a dedicated BASHO room
   flag) so the default VS CPU path is byte-for-byte unchanged. When in doubt, branch on the flag and
   leave the existing code untouched rather than editing it in place. A maxed BASHO build must produce
   an identical fighter to a fresh one in BOTH PvP and VS CPU (verify per §9).
3. **Premium bar.** Whatever ships in a phase must be *polished*, not a prototype. Reuse the
   existing design system (`menuTheme.js` tokens, washi/sumi/vermillion/gold language, Snowfall,
   breathing sprite, sound hooks). Narrow scope > janky breadth.
4. **Phasing discipline.** Each phase must be independently testable and leave the game shippable.
   Heavy, balance-sensitive subsystems (stat tuning, loadout option set, unlock economy, opponent
   roster) each get their OWN design pass — see Section 8. Do not jam them all into one PR.
5. **Authenticity = premium.** Sumo is rooted in **Shinto** (NOT Taoism). Lean into real terms
   (kachi-koshi, make-koshi, banzuke, yusho, kinboshi, kadoban, oshi-zumo/yotsu-zumo, kenshō
   envelopes). Get spellings right (e.g. **Jonokuchi**).
6. **Save format is DB-ready but not a DB.** Single-player needs no server database now. Persist
   locally (see Section 6) with a versioned schema that can migrate to a DB / Steam Cloud later.

---

## 3. Game Primer — what PenguinPow is today

**Genre:** 2D sumo ring-out fighter on an icy dohyo. **No health bar.** You win a bout by pushing /
throwing / knocking the opponent out of the ring. Authoritative simulation lives server-side
(`server-io/`); the React client mirrors state and renders VFX.

**Match format today:** first-to-2 round wins (best-of-3). *BASHO overrides this to best-of-1 per
bout — see Section 5.*

**Core combat verbs (full kit, shared by both fighters):**
- **Slap / slap string** (Mouse1): fast neutral; up to a 3-hit string; 3rd hit is a finisher.
- **Charged attack** (hold S + forward + Mouse1): big committal lunge; beats slaps above a charge
  threshold; can pin a cornered opponent for a guaranteed ring-out ("cinematic kill").
- **Grab → Clinch** (Mouse2): the sumo identity. Grab leads into a clinch with situational tools —
  **push** (hold toward), **plant** (S + away, resists), **forward throw** (dump opponent toward the
  ring), **pull** (reverse positions at the edge), **lift/carry** (advance while keeping the clinch),
  **clinch jolt** (anti-plant read), **break** (Space). These are *situational tools*, not a
  rock-paper-scissors; the "counter" is the opponent inputting a grab action simultaneously
  (clinch clash / grab tech). Throws/pulls become kill finishers at low balance.
- **Raw parry** (Space): reactive defense; perfect-parry window stuns the attacker. Fundamental.
- **Dodge/dash** (Shift), **sidestep / henka** (S+Shift, i-frames), **rope jump** (W+forward at
  edge), **power slide** (C/Ctrl), **crouch** (S, regens balance).

**Two resource bars:** **Stamina** (gates action spam; gassing out is a big penalty) and **Balance**
(gates clinch throws/kills). Both regen out of clinch.

**Power-ups (drafted pre-bout, 1 of N):** `speed` (Happy Feet, 1.4× move), `power` (Power Water,
1.3× knockback), `snowball` (projectile, limited throws), `pumo_army` (spawns slapping clones),
`thick_blubber` (absorb 1 hit), `flap` (replaces parry with flight + body-slam). Defined in
`server-io/constants.js`; selection flow in `client/src/components/PowerUpSelection.jsx` +
`server-io/roomManagement.js`.

**No character roster.** Both slots are the same "Pumo" penguin; only cosmetic colors differ
(mawashi/headband + body). Sprites are blue-base and recolored at runtime.

**Win-type labels** (kimarite) already exist: THRUST OUT, PUSH OUT, FORCE OUT, OVERARM THROW,
REAR PUSH OUT (okuridashi), RING OUT, DEMOLISHED, etc. (`RoundResult.jsx` / `game_over` event).

**Pre-match ritual:** power-up pick → salt throw (Shinto purification, already in game) → tachiai.

**CPU AI is a major existing asset:**
- `server-io/cpuAI.js` (~2,700 lines) — "SUMO EXPERT", used for HARD (and any non-IMPOSSIBLE
  difficulty). Has aggression personalities (aggressive/balanced/defensive), intentional human
  imperfection (reaction miss %, jitter), full clinch/power-up/flap counterplay.
- **(Phase 8 — done)** ONE brain now serves all tiers: `cpuAI.js` reads `room.cpuDifficulty` and
  dials reaction-miss %, reaction jitter, decision cadence, parry/dodge/snowball/flap-defence chances,
  and the power-up offence gate up or down via `DIFFICULTY_PROFILES` (EASY/NORMAL = handicapped HARD;
  HARD = the literal `AI_CONFIG` baseline; IMPOSSIBLE = near frame-perfect). The old
  `cpuAI_impossible.js` has been retired/deleted.
- Hooked in the 64Hz loop in `server-io/index.js` (~line 426): `updateCPUAI` sets `cpu.keys` for all
  tiers, then `processCPUInputs` converts keys to actions (same path as humans).
- Difficulty is per-room (`room.cpuDifficulty`, set via `set_cpu_difficulty`). **EASY/NORMAL exist
  in UI but are disabled — they fall through to the HARD brain.** This means *handicapping* (lower
  stamina, more reaction miss) and *giving the CPU power-ups/stats* are the natural difficulty
  dials for BASHO, NOT writing new AI.

**Existing rank ladder (simplistic, unused for progression):** `getRank(wins, losses)` in
`client/src/components/PreMatchScreen.jsx` maps win counts to JONOKUCHI→YOKOZUNA but is hardcoded
to `{wins:0, losses:0}` everywhere. BASHO needs its own proper banzuke model (Section 5).

---

## 4. Current Implementation Reference (verified file map + exact edit points)

### 4.1 App shell & navigation
- **`client/src/App.jsx`** owns `currentPage` state (`useState("mainMenu")`, ~line 26) and passes
  `currentPage` / `setCurrentPage` to `MainMenu`. App also wraps everything in `PlayerColorProvider`
  and `SocketContext`, and sets `--app-zoom` for 1280×720 scaling. A `StartupScreen` gates the menu.
- **`client/src/components/MainMenu.jsx`** is *misnamed* — it is the **entire post-startup page
  router**. It `switch`es on `currentPage` (~line 1335) to render: `mainMenu`, `lobby`, `game`,
  `customize`, and a `rooms` overlay (handled in the `default` branch as a modal over the menu).
  **To add BASHO: add `case "basho":` (and later `case "bashoLobby":`/run pages) to this switch.**
- Match-mode state (`roomName`, `isCPUMatch`, `showSettings`) lives as **local state inside
  MainMenu**, not App. Add BASHO run state alongside (e.g. `bashoRun`), OR introduce a single
  `matchMode: "pvp" | "cpu" | "basho"` enum threaded into Lobby/Game.
- **Known bug to avoid copying:** `Game.jsx` (~line 851) navigates to `"main-menu"` (hyphen) which
  doesn't match the `"mainMenu"` case; it only "works" via the default branch. Use `"mainMenu"`.

### 4.2 Main menu options (the requested menu change)
Options are **hardcoded JSX** inside `renderMainMenu()` in `MainMenu.jsx` (~lines 1170–1240), each a
`<MenuButton $index={N}>`; `$index` drives a staggered entrance animation (`0.55 + $index*0.07`s).
Current order: Play Online *(disabled, "Soon")*, Custom Match, VS CPU, Basho Tournament *(disabled)*,
Customize, Career Stats *(disabled)*, Options *(separate `SystemButton`)*.

**Required edits:**
1. Add **`BASHO`** as the FIRST `<MenuButton $index={0}>` with `onClick` → a new
   `handleBasho = () => { playButtonPressSound2(); setCurrentPage("basho"); }`.
2. Rename **Play Online → `MATCHMAKING`** (keep `$disabled` + `<SoonMark>Soon</SoonMark>`), now 2nd.
3. **Delete** the entire `Basho Tournament` `<MenuButton>` block.
4. **Renumber all `$index`** sequentially after the changes.
   (Keep `Career Stats` for now — BASHO can fill it later, or repurpose into the BASHO hub.)

### 4.3 Match pipeline (reuse this for BASHO bouts)
VS CPU flow to copy/adapt:
`handleVsCPU()` emits `create_cpu_match` → server (`socketHandlers.js`) makes an ephemeral
`isCPURoom` with a `createCPUPlayer()` opponent → emits `cpu_match_created` → client sets
`isCPUMatch=true`, `setCurrentPage("lobby")` → Ready → server `initial_game_start` →
`setCurrentPage("game")`. `isCPUMatch` is threaded to `Lobby`, `Game`, `GameFighter`,
`PreMatchScreen`, `MatchOver`, `Rematch`. **BASHO should reuse this CPU pipeline per bout**, adding
a `matchMode:"basho"` flag and a run context (current opponent config, bout #, record).
> **FIREWALL (see Guardrail 1 & 2):** A plain VS CPU match (`matchMode` absent / `"cpu"`) must behave
> EXACTLY as it does today — same first-to-2 format, identical fighters, identical combat math. All
> BASHO divergence (best-of-1, stat modifiers, loadout, named opponents, day flow) is gated behind
> `matchMode === "basho"`. Treat the existing `create_cpu_match` / `isCPURoom` path as read-only:
> branch off it for BASHO, don't edit it in place.

### 4.4 Lobby / page layout system (template for the BASHO hub page)
- Lobby/Customize use **styled-components + design tokens in
  `client/src/components/menuTheme.js`** (`C.snowPanel`, `C.sumi`, `C.cream`, `C.vermillion`,
  `C.gold`, etc.) and `container-type: size` + `clamp(.., cqw/cqh, ..)` responsive units. **They do
  NOT use `App.css`** beyond the `.current-page` fl/center wrapper.
- **`client/src/components/CustomizePage.jsx` is the best template** for the single-player BASHO hub
  (large left preview + right controls panel, 2-col `Stage` grid). The 2-player `Lobby.jsx` is more
  than we need — drop the P2 column, VS wordmark, difficulty card, and `ready_count` flow.
- **Live penguin preview:** `ColoredPlayerPreview` (in Lobby/Customize) calls `recolorImage(...)`
  from `client/src/utils/SpriteRecolorizer.js` using `BLUE_COLOR_RANGES` (mawashi) + `GREY_BODY_RANGES`
  (body). Reuse it. Colors come from `PlayerColorContext` (`usePlayerColors()`).
- **Reusable UI for the new panels:**
  - STATS panel → clone `BanzukeCard` / `StatRow` / `StatLabel` / `StatValue` from `MainMenu.jsx`.
  - LOADOUT picks / draft cards → reuse `PowerUpSelection.jsx` card pattern (washi cards on dimmed
    arena) and/or `CustomizePage` swatch grids.
  - Buttons/CTAs → `ReadyButton` style; sound hooks `playButtonHoverSound` / `playButtonPressSound2`.
- **Color preset source of truth:** `client/src/config/spriteConfig.js` (`COLOR_PRESETS`,
  `BODY_COLOR_PRESETS`, `DEFAULT_COLORS`). Lobby/Customize duplicate these inline — prefer importing.
- **Gamepad/Steam Deck:** menus currently have NO controller focus navigation (only gameplay does).
  For a premium Steam/Deck launch, BASHO menus should add D-pad focus + A/B select/back and keep
  `min-height: 44px` touch targets. Preserve `clamp`/`container-type` patterns.

### 4.5 Player object & where stats hook in
- **`server-io/playerFactory.js` → `createInitialPlayerState(overrides)`** is the single source of
  truth for the player shape (resources `stamina:100`, `balance:100`, `sizeMultiplier`, all combat
  state). Every player (PvP, human-vs-CPU, CPU) is created here.
- **BASHO stat modifiers** (power, move speed, resistance, stamina, balance) should be applied as a
  derived modifier set passed in at player creation for a BASHO match, and referenced by the combat
  math — **only when `matchMode==="basho"`**, never in PvP. Treat raw combat constants in
  `server-io/constants.js` as the PvP baseline; BASHO multiplies/offsets them per the player's stats.
- **Win condition / match orchestration:** `server-io/gameFunctions.js → handleWinCondition`
  (first-to-2 today). BASHO needs a **best-of-1 bout** result and a higher-level **basho orchestrator**
  that sequences bouts and tracks the run record.

---

## 5. BASHO Design Spec

### 5.1 Core loop & mental model
- **A run = one basho (tournament).** The basho is the *disposable roguelite run*; power-ups drafted
  during it reset when it ends.
- **Your rank (banzuke) is the persistent meta-progression.** You climb Jonokuchi → Yokozuna across
  many bashos. You do NOT reach the top in one run.
- **Not permadeath.** A losing record demotes you (a setback), it does not wipe a career. This is a
  *career ladder with roguelite flavor*, deliberately — do not force a Slay-the-Spire permadeath on
  the main mode. (A separate opt-in **Hardcore / Daily Basho** permadeath mode is a *later* phase and
  is where pure-roguelite stakes + leaderboards live.)

### 5.2 Tournament structure (authentic, and it solves pacing)
- **Lower divisions (Jonokuchi, Jonidan, Sandanme, Makushita): 7 bouts**, **4 wins** = kachi-koshi.
- **Upper divisions (Juryo, Makuuchi → Maegashira/Komusubi/Sekiwake/Ozeki/Yokozuna): 15 bouts**,
  **8 wins** = kachi-koshi.
- This gives the ideal roguelite pacing for free: short early runs (fast onboarding), epic late runs.
- **Bouts are best-of-1** (authentic; one bout per "day"). High single-bout variance is *intended and
  fair* because the multi-bout record is the variance buffer — the better player still rises over
  7/15 bouts. (This overrides the PvP first-to-2 format for BASHO matches only.)

### 5.3 Win/record resolution (play it ALL out — locked design)
- **You play every bout of the basho** (all 7 or 15). There is NO automatic early-exit. This is
  *required* by the banzuke-number system (Section 5.6): every win/loss changes your final number, so
  even an already-clinched winning or losing record keeps moving — and it's authentic (real wrestlers
  fight all days because each result moves their banzuke position).
- **Final record → banzuke movement** (see Section 5.6): your end-of-basho W-L sets how far your
  number moves and whether you change division/title. Bigger winning margin = bigger climb; bigger
  losing margin = bigger drop. A perfect record can trigger a **yusho** (championship) + rank-skip.
- **As your position rises mid-basho you get matched into tougher opponents** (authentic second-week
  behavior), so the back half is the natural "boss stretch" — no separate opt-in needed.
- **FAKE INJURY (kyūjō withdrawal) = the ONLY early exit.** A player may withdraw at any time via a
  themed **"Fake Injury"** option. It ends the basho immediately and **resolves banzuke movement on the
  record at the moment of withdrawal** — so you can still *gain* rank if you bow out on a winning
  record, or *lose* rank per a losing one. It MUST show a confirm/warning first, e.g.
  *"Withdraw with a 2-3 record? Your rank will drop based on this record. [Confirm / Cancel]."*
  *(Anti-farm design note for the Section 8 balance pass: to stop "win 2, bail, repeat" abuse, either
  keep incomplete-record movement small, or count the remaining bouts as losses like real kyūjō.)*
- **Promotion gates tighten at the top** (the endgame difficulty curve, authentic):
  - Numbered divisions (Jonokuchi → Maegashira): movement is by **number**; reaching the top of a
    division with a winning record promotes you into the next one (Section 5.6).
  - **Sekiwake → Ozeki:** elite record (MVP: e.g. 13-2 / 11+ wins; later, authentic "~33 wins / 3
    tournaments").
  - **Ozeki → Yokozuna:** **two consecutive yusho** is the primary path; a perfect **15-0 zensho** is a
    dramatic insta-promote shortcut. *Don't make a single 15-0 the ONLY gate — too swingy.*
  - **Kadoban:** an Ozeki who make-koshi gets one grace basho before demotion.
  - **Yokozuna can never be demoted** — keep going / "retire" (prestige reset for meta rewards).
- **Demotion must have teeth** (lose number/position, lose access to the higher draft pool) — but
  demote, don't delete.

### 5.4 Two-speed progression (this is the heart — get the split right)

**PERSISTENT layer (carries across bashos; the slow "cook"):**

1. **Attributes (5 stats), each 0–10:** `POWER` (knockback dealt), `MOVE SPEED`, `RESISTANCE`
   (anti-knockback / "weight" — huge in a ring-out game), `STAMINA`, `BALANCE`.
   - Budget model: **base 1 each + ~20 points to spend** (≈25 total), per-stat cap 10. Enables
     all-around (5/5/5/5/5) or specialist (10/10/3/1/1). The cap forces ≥3-stat spread.
   - **Fixed budget forever — never let players afford to max everything** (or build identity dies).
   - **Drip the points, don't grant all upfront:** start with ~6–8, earn the rest by climbing —
     award points the **first time you reach a new personal-best division or titled rank** (NOT per
     banzuke number, or it's farmable). It's a **one-time career arc** (stats are persistent, not
     per-run), mirrors the player's skill-learning curve, and eases new-player decision paralysis.
     Hit full 20 around the mid-divisions (Juryo-ish) so prestige ranks are pure skill + loadout +
     draft. **(For testing, the debug mode grants all of this instantly — see Section 9.)**
   - **Balance watch-items:** decide the min↔max *spread* (flavor-tilt vs transformative; aim
     moderate-wide with functional floors). POWER & RESISTANCE are near-universally good in a ring-out
     game → ensure each stat enables a distinct playstyle with a real cost, and guard the
     **pure-tank stall** (max RESISTANCE + no offense + no round timer = stalemate; needs a
     stall-breaker). This needs its own balance pass (Section 8).
2. **Ability Loadout (categories + point-buy of SIDEGRADES):** categories
   `ATTACK` (≈ oshi-zumo), `DEFENSE`, `MOVEMENT`, `GRAPPLING` (≈ yotsu-zumo), and **`SHINTO`**
   (passive blessings/charms — e.g. armor on grab; Shinto-themed ability names: *Kami's Gift, Omamori,
   Shio, Harae, Shimenawa*). ~4+ options per category, a **limited** point budget (you can NEVER take
   all).
   - **Build the loadout UI data-driven** from a per-category options config (e.g. `LOADOUT_OPTIONS`).
     The catalog is **empty/stub for now** — render the five category shells with a "Coming soon"
     state so real options auto-populate later with zero UI rewrite. (Catalog design = Section 8.)
   - **Lock additions/alternatives, never fundamentals.** Raw parry, grab + the core clinch tools,
     dodge, slap, charge are ALWAYS available by default. Example good sidegrade: **Flap replaces Raw
     Parry** as a DEFENSE choice (parry is default; flap is the unlockable alternative).
   - **Every option must be a real sidegrade** (different, not strictly better) or the system collapses
     into one meta build (illusion of choice). Test: "name the player who picks each option, and why."
   - **Grow the menu, not the budget:** progression unlocks MORE OPTIONS (horizontal), keep the point
     budget fixed. (A little bounded vertical growth is OK; unbounded is not.)
   - PvE-only upside: if the player can scout the basho's opponents, loadout becomes a pre-run
     strategic bet (anti-grappler vs anti-zoner) — depth PvP can't have.
3. **Currency = "envelopes" (kenshō, authentic).** Earned from runs/wins/yusho; spent to **unlock**
   loadout options, stat respecs, cosmetics, harder modes. (Note: `envelope.png` currently exists only
   as a visual particle — the economy is greenfield.) Respect player time on earn rates.
4. **Unlocks:** new loadout options, new ranks reached, cosmetics, modes.

**PER-RUN layer (resets each basho; the fast "cook"):**
- **In-basho draft of SPECIAL power-ups** (snowball, pumo army, thick blubber, + a much larger
  "exotic" pool to build later). Drafted between bouts, stack for the run. Reuse `PowerUpSelection`.
- These are the *impactful, gamble-y* picks — NOT stats. Moving stats to the persistent layer keeps
  the in-run draft focused on interesting behavioral/exotic effects.
- **One-home rule:** any given effect lives in exactly ONE system (persistent loadout passive vs.
  drafted special), never both, or players won't understand where power comes from. Rule of thumb:
  loadout = *how your fighter is built* (always-on identity); draft = *temporary spikes for this run*.

### 5.5 Difficulty scaling & CPU AI tiers
**Current AI reality (important):** only the **HARD** brain (`cpuAI.js`) actually works. **IMPOSSIBLE
(`cpuAI_impossible.js`) is currently incomplete / non-functional with outdated logic and must be
rebuilt** (build it as a new variant of the working HARD brain). **EASY and NORMAL do not exist** — the
UI lists them but they fall through to HARD. BASHO needs the full difficulty ladder, so this is real
work (flagged as its own subsystem in Section 8).
- **Build EASY/NORMAL as handicapped versions of the HARD "expert" brain**, NOT new AI codebases:
  higher reaction-miss %, slower decision cadence, fewer optimal punishes, no power-up usage, etc.
  IMPOSSIBLE = rebuild the frame-perfect counter-bot from the HARD brain. One brain, dialed up/down.
- **Map difficulty to rank/day so early ranks are gentle** (per your note: don't bring real heat until
  the player is already doing well):
  - Jonokuchi → Sandanme: **EASY**
  - Makushita → Juryo: **NORMAL**
  - Maegashira → Sekiwake: **HARD**
  - Ozeki / Yokozuna + any division "boss": **IMPOSSIBLE** (often also given power-ups/stats/size)
  - **Ramp within a basho too:** earlier days easier; once a winning record is secured (or in the back
    half), step difficulty up a notch.
- The cleanest power dial is **giving the CPU the same toys the player has** (power-ups, stat buffs,
  size) — the AI already handles power-ups (snowball/army/flap). Tune the *gap*, not the absolute, and
  keep player stats an **edge, not a hard gate** (skill should clear a rank slightly under-statted).

### 5.6 Banzuke / Ranking Model (authentic — get this right)
Two kinds of rank:
- **Numbered divisions** — you hold a **number** (lower number = higher rank). Bottom→top:
  **Jonokuchi, Jonidan, Sandanme, Makushita** (7 bouts) → **Juryo, Maegashira** (15 bouts). A good
  record lowers your number; a bad one raises it. Drop below #1 → promote into the bottom of the next
  division; exceed the max → demote into the top of the one below.
- **Titled ranks (no number)** — top of the Makuuchi division: **Komusubi, Sekiwake, Ozeki**
  (= *san'yaku*) and **Yokozuna**. Entered from ~Maegashira #1 with a strong record; gated promotions
  (5.3); make-koshi at Komusubi/Sekiwake drops you to Maegashira; Ozeki has kadoban; Yokozuna never
  demotes.

**Terminology (for authenticity):** **Maegashira is the numbered rank-and-file of the top division
(Makuuchi), NOT san'yaku.** *San'yaku* = Komusubi / Sekiwake / Ozeki. **Juryo** sits between Makushita
and Maegashira and is the first salaried (sekitori), 15-bout division.

| Division | Bouts | KK | Numbered | Real # range | Notes |
|---|---|---|---|---|---|
| Jonokuchi | 7 | 4 | yes | ~#1–30 | start here (very bottom) |
| Jonidan | 7 | 4 | yes | ~#1–100 | the big-number division |
| Sandanme | 7 | 4 | yes | #1–90 | |
| Makushita | 7 | 4 | yes | #1–60 | |
| Juryo | 15 | 8 | yes | #1–14 | salaried; 15-bout basho begins |
| Maegashira | 15 | 8 | yes | #1–~17 | rank-and-file of Makuuchi |
| Komusubi / Sekiwake / Ozeki | 15 | 8 | no (title) | — | *san'yaku* |
| Yokozuna | 15 | — | no (title) | — | cannot derank |

**Record → movement:** final W-L differential maps to a number delta (and a division/title change at
the edges). Example feel (7-bout): `4-3` small climb, `5-2`/`6-1` bigger, `7-0` huge jump + yusho;
`3-4` small drop, `0-7` big drop — i.e. your "Jonokuchi #200 → 4-3 → #125 → 7-0 → #50" idea. Magnitudes
**shrink as the ranges shrink toward the top** (each slot near #1 is harder-won — a free difficulty
curve). Exact deltas per division are a tuning pass (Section 8).
- **Note:** Jonokuchi is actually a *small* division (~#30); **Jonidan** is the ~#100+ one. Start
  everyone at the bottom of Jonokuchi; gamify the starting numbers freely (you said you'd normalize
  them).
- **MVP simplification: numbers only.** **East/West** (the half-step at each number, East slightly
  higher) is an optional authenticity add for a later pass — not in the MVP.

### 5.7 Opponents (named rikishi, not "CPU")
Each opponent is a named rival with a *shikona* (ring name), its own cosmetic colors, and (later) a
locked AI personality — never just "CPU opponent." **Placeholder roster (developer will replace/expand
with their own funny names):**
- **Lower-division goofs:** Waddlemaru · Sir Slipsalot · Brrrtholomew · Wobbleyama · Krillbasher ·
  Tubby Tachiai · Slushpuppy · Flipper McShove · Captain Coldcuts · Señor Belly · Frostbite Fumio ·
  Beaky Blinders
- **Mid-tier:** Mackerelyama · Sushi Sumoto · Iceberg Ichiro · Blubbernishiki · Glacier Gunkan ·
  Chill Norris · Penguinzilla
- **Boss / legend tier (Ozeki/Yokozuna rivals):** Hakupengu · Emperor Frostfuji · The Tuxedo Tempest ·
  Avalanche Akira · Daimyo Defrost · Chonkaisho · Yoko-ZONO

**Opponent record generation:** entering Day N, the player has N−1 bouts on record. The opponent shown
should have the **same number of bouts (N−1)** with a W-L **close to the player's** (e.g. player's wins
±1, clamped to a valid range), so the field feels like a real shared tournament. Randomize the
opponent's identity / colors / record each bout within those rules.

### 5.8 Bout-to-bout flow & presentation
Between bouts (and to start each), run this transition **WITHOUT a full game reload/remount** (keep the
React tree mounted; just swap opponent data + re-seed match state):
1. **Black "DAY X" card** — full-screen black showing the tournament day. **Play the make-koshi /
   "loser" sound here for now** (placeholder spice — swap for a proper cue later).
2. **Pre-match card (brief)** — the existing `PreMatchScreen`, updated with the new opponent's
   **colors, name, and record** (5.7) plus the player's current record/rank. Hold for a short beat.
3. **Bout** — the actual best-of-1 match.
4. On result → update the run record → next **DAY X** card (or, if the basho is over / Fake Injury was
   used, go to the basho-results + banzuke-movement screen).
Performance: reuse mounted components and call `preloadSprites()` so opponent recolors are ready;
avoid re-running heavy startup each day.

---

## 6. Persistence & Save Architecture

**Do you need a database now? NO.** BASHO is single-player; nothing needs a server DB. A real DB only
becomes necessary for the *online* future (Daily Basho leaderboards, cross-device sync, anti-cheat).

**What exists today:** the only real "game" persistence is Electron `settings.json` in
`app.getPath('userData')`, written by `main.js` (`loadSettings`/`saveSettings`) and exposed to the
renderer via `preload.js` as `window.electron.settings.get()/save()`. localStorage is used only for a
dev crowd-editor and a debug flag. Player colors are session-only. `steamworks.js` is a bundled
dependency but **not wired** (no Steam Cloud code yet). Server state is fully in-memory.

**Recommended approach (mirror the settings pattern):**
1. **Primary store = a versioned JSON save file** in `userData` (e.g. `basho-save.json`), via NEW
   IPC handlers in `main.js` (`load-save` / `write-save`) exposed through `preload.js` as
   `window.electron.save.get()/write(data)`. Use atomic write (temp file → rename) for crash safety.
2. **Browser/dev fallback:** if `window.electron` is absent, fall back to `localStorage`. Hide this
   behind a single `saveStore` module so the rest of the code never touches IPC/localStorage directly.
3. **Versioned schema + migrations:** follow the `CrowdLayer.jsx` pattern (a `schemaVersion` int +
   sequential upgrade blocks) so saves survive updates.
4. **Steam Cloud = later phase:** wire `steamworks.js` in the MAIN process (not the renderer), add
   Cloud config in the Steamworks Partner Portal for the save file, and treat the local file as source
   of truth with cloud as backup/cross-device (resolve conflicts by newest `updatedAt`).

**Proposed save document (DB-ready; treat as the future row/document schema):**
```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO-8601",
  "profile": { "displayName": "Player", "steamId": null },
  "career": {
    "rank": { "division": "Jonokuchi", "number": 30, "title": null, "side": null },
    "bestDivisionReached": "Jonokuchi",
    "envelopes": 0,
    "statPoints": { "available": 6, "spent": { "power": 0, "moveSpeed": 0, "resistance": 0, "stamina": 0, "balance": 0 } },
    "loadout": { "attack": [], "defense": ["rawParry"], "movement": [], "grappling": [], "shinto": [] },
    "unlocks": [],
    "lifetime": { "bashos": 0, "yusho": 0, "kinboshi": 0, "boutsWon": 0, "boutsLost": 0 }
  },
  "bashoRun": {
    "active": false, "division": null, "boutCount": 0, "day": 0,
    "record": { "wins": 0, "losses": 0 },
    "draftedPowerUps": [], "opponents": [], "modifiers": [], "seed": null
  },
  "customization": { "mawashiColor": "#4169E1", "bodyColor": null },
  "settings": { "hardcoreUnlocked": false }
}
```
Keep `bashoRun` so an in-progress basho can be **saved & resumed** mid-run (required — a 15-bout basho
is long; never force completion in one sitting).

---

## 7. Phased Implementation Plan

> **MVP = Phases 0–3** (a playable, polished basho climb). Everything after is additive. Each phase
> must leave the game shippable and be testable on its own. Do not start a phase before the previous
> one is solid.

### Phase 0 — Menu & route scaffolding *(small, do first)*
- **Scope:** Implement the menu change (Section 4.2): add `BASHO` (1st), rename Play Online →
  `MATCHMAKING` (keep greyed, 2nd), remove `Basho Tournament`, renumber `$index`. Add `case "basho"`
  to the `MainMenu` router rendering a placeholder `BashoHub` component + a Back button.
- **Touches:** `MainMenu.jsx` (menu JSX + switch + `handleBasho`), new `components/BashoHub.jsx` stub.
- **Done when:** clicking BASHO opens a blank styled hub page and Back returns to the menu; PvP/VS CPU
  unaffected; menu animations still stagger correctly.
- **Out of scope:** any run logic, persistence, stats.

### Phase 1 — BASHO Hub page (UI shell, in-memory)
- **Scope:** Build the real single-player hub from the `CustomizePage` template: large penguin preview
  (reuse `ColoredPlayerPreview`), a **STATS panel (bottom-right)** using `BanzukeCard`/`StatRow`, a
  **LOADOUT panel**, current rank/banzuke display, and a prominent **START BASHO** button. All values
  read from in-memory placeholder state for now. Premium styling via `menuTheme.js`.
- **Touches:** `BashoHub.jsx`, reuse `menuTheme.js`, `SpriteRecolorizer`, `PlayerColorContext`.
- **Done when:** the hub looks premium and shows (placeholder) rank/stats/loadout + a working
  START button (can just log for now). Responsive in 1280×720/Deck.
- **Also:** stub the **dev/debug toggle** here (max stats, unlock all, jump rank, grant envelopes) so
  the mode is testable without grinding (Section 9).
- **Out of scope:** real stat/loadout editing, saving, fighting.

### Phase 2 — Persistence layer
- **Scope:** Add a `saveStore` module + Electron IPC save file (`basho-save.json`) per Section 6
  (new `main.js` handlers + `preload.js` `window.electron.save`), versioned schema + migrations,
  localStorage fallback. Wire the hub to load/save real career data (rank, colors, etc.).
- **Touches:** `main.js`, `preload.js`, new `client/src/lib/saveStore.js`, `BashoHub.jsx`.
- **Done when:** career data persists across app restarts; corrupt/missing save falls back to defaults;
  schema version migrates cleanly; settings/PvP unaffected.
- **Out of scope:** Steam Cloud (later), stats/loadout economy.

### Phase 3 — Run loop MVP *(completes the MVP)*
- **Scope:** The actual basho. From the hub, START creates a run (lower-division, 7 bouts). Sequence
  **best-of-1** CPU bouts (reuse the VS CPU pipeline with `matchMode:"basho"`), play out **all** bouts
  with the **DAY-X → pre-match → bout** transition flow (5.8), **named opponents + close-record
  generation** (5.7), and the **Fake Injury** withdrawal option (5.3). On completion, apply
  **record → banzuke movement** (5.6), persist the new rank, return to hub. Save & resume mid-run.
- **Touches:** run orchestrator (client `lib/bashoRun.js` + server `matchMode` handling in
  `socketHandlers.js`/`gameFunctions.js` for best-of-1), a `DayCard` transition + `PreMatchScreen`
  opponent re-seed, `BashoHub.jsx`, between-bout UI, `saveStore`.
- **Done when:** a player can climb/derank across multiple bashos, mid-run save/resume works, best-of-1
  is correct, PvP first-to-2 is untouched.
- **Out of scope:** stats modifiers, loadout effects, envelopes, exotic draft, boss tiers.

### Phase 4 — Attributes (stats) system
- **Scope:** 5 stats, base-1 + drip points (award on new personal-best division/title), spend UI in the hub,
  and apply derived modifiers to the BASHO player **only** (`matchMode==="basho"`) via
  `createInitialPlayerState` + combat math. Needs the balance pass in Section 8 first.
- **Done when:** stats persist, modify a BASHO fighter measurably, never affect PvP, and the drip
  curve works (can't be farmed).

### Phase 5 — Ability loadout system
- **Scope:** Categories + point-buy of sidegrades (5.4). Fundamentals always default; unlockable
  alternatives (e.g. flap↔parry). Apply loadout to the BASHO match only.
- **Done when:** loadout choices change how a BASHO fighter plays, are limited (can't take all), and
  never leak into PvP.

### Phase 6 — Envelopes + unlock economy
- **Scope:** Earn envelopes from runs/yusho; spend in an unlock shop (loadout options, respec,
  cosmetics). Persist via `saveStore`.

### Phase 7 — In-basho draft expansion
- **Scope:** Per-run stacking draft of SPECIAL power-ups between bouts (reuse `PowerUpSelection`);
  expand the special/"exotic" pool meaningfully (this pool is now load-bearing for run variety).

### Phase 8 — CPU AI tiers, difficulty curve & rival roster
- **Scope:** **Rebuild the broken IMPOSSIBLE AI** and **create EASY + NORMAL as handicapped versions of
  the HARD brain** (they don't exist today — see 5.5). Map difficulty to division/day; ramp within a
  basho; give bosses power-ups/stats/size; lock rival AI personalities + names (5.7); division bosses
  (Ozeki/Yokozuna) on IMPOSSIBLE; promotion-gate tightening + kadoban.
- **Note:** the EASY/NORMAL/IMPOSSIBLE AI work is a sizable subsystem — see Section 8.
- **(Pass 1 — done) AI ladder MVP:** single expert brain in `cpuAI.js` parameterized by
  `DIFFICULTY_PROFILES` (EASY/NORMAL/HARD/IMPOSSIBLE); HARD === the legacy `AI_CONFIG` baseline so
  PvP/VS CPU are byte-for-byte unchanged. Difficulty maps per-division (`DIVISION_DIFFICULTY`) with a
  back-third intra-basho ramp once kachi-koshi is secured (`effectiveDifficulty`).
- **(Pass 2 — done) Rival roster + personalities + bosses:** a curated named roster (`bashoRun.js`
  `RIKISHI`) — each rival has stable colors + an AI **personality archetype** (pusher / grappler /
  counter / brawler / balanced). Archetypes are a LIGHT flavor layer in `cpuAI.js`
  (`PERSONALITY_PROFILES`) applied only to the aggression roll + the {attack,defense,grab} multipliers
  (`getAggressionMultiplier`), read per-CPU from `cpu.aiArchetype` — absent = `balanced` = legacy, so
  PvP/VS CPU are untouched. **Division bosses** (`BOSSES`) crown the final day of the upper divisions
  (Juryo+): signature rikishi with a real combat edge — elevated `stats` (→ `deriveStatMods`), a larger
  `size`, and a stacked power-up loadout (→ `applyBashoDraftToPlayer`), all applied to the BASHO CPU
  ONLY via `applyBashoOpponentProfile` (re-applied each bout after the reset zeroes size/power; cleared
  for non-boss rivals). Boss difficulty climbs to IMPOSSIBLE at Ozeki/Yokozuna. The DAY card surfaces
  the rival's style tag + a gold "Boss" badge.
- **Deferred to a later pass:** promotion-gate tightening + **kadoban** (Ozeki demotion grace,
  Yokozuna consecutive-yūshō promotion gate, zensho shortcut) — needs persisted career state
  (`kadoban`/`consecutiveYusho`); `computeBanzukeMovement` still uses the simplified MVP gates.

### Phase 9 — Premium presentation pass
- **Scope:** Banzuke board with promotion/demotion animation, reward/results screens, envelope &
  stat-up & unlock-reveal moments, kimarite callouts, audio polish, controller/Deck menu navigation.
- **(Phase 9 pass 1 — done) Results ceremony:** `BashoResults.jsx` is now a staged reveal — the
  verdict lands, the banzuke movement animates (promotion lifts / demotion sinks, colored chip +
  arrow pulse), the kenshō purse is itemised and counts up line-by-line (`applyRunResult` now returns
  a `breakdown`/`tier`), the stat drip stamps in, and each beat fires a reused stinger
  (`soundUtils`: gong / applause / fanfare / somber / yūshō / tick). Tap-to-skip jumps to the end.
  The day strip now names each finish's kimarite. `RoundResult` gained the missing win types
  (`clinchKillThrow`, `clinchKillPull`, `flap`) so they stop falling back to "RING OUT" — a shared
  win for all modes. Real career rank is wired into the main-menu banzuke card, the `PreMatchScreen`
  plaques, and the in-match HUD plaque — all BASHO-gated (optional props default to the legacy
  win-rate heuristic / "JONOKUCHI", so PvP & VS CPU are untouched).
- **(Phase 9 pass 2 — done) Banzuke board:** `BanzukeBoard.jsx` is the standalone ladder screen —
  the full division ladder painted top→bottom (Yokozuna → Jonokuchi) on a dark sumi banzuke, the
  player's recolored rikishi marked on the spine at their exact rank (numbered divisions place the
  marker within the band by number). It runs in two modes: a STATIC snapshot (opened from the hub by
  clicking the rank chip) and a MOVEMENT reveal — from `BashoResults`, the finished ceremony's "View
  Banzuke" button drops the marker at the old rank and animates it climbing/sinking the spine to the
  new rank (gong stinger, destination band glows, tap-to-skip), then "Return to Heya". Reuses the
  shared recolor cache + `menuTheme`; single-player only (no PvP/VS CPU touch).
- **Deferred to later passes:** unlock-reveal ceremony for shop purchases, and
  controller / Steam-Deck *menu* navigation (gamepad still works in-match only).

### Phase 10 — (Later, needs DB/Steam) Hardcore & Daily Basho + leaderboards
- **Scope:** Opt-in permadeath mode + seeded Daily Basho with online leaderboards. Gate on real
  population/infra. This is where a database/Steam backend finally enters.

---

## 8. Subsystems that need their OWN dedicated design pass

These are the "big decisions" the developer is rightly worried about. **Do not improvise these inside
an implementation PR.** Each deserves a focused design+balance conversation before/while building its
phase:

1. **Stat min↔max tuning (Phase 4).** Exactly what 1 vs 10 does to knockback, speed, anti-knockback,
   stamina pool/regen, balance. Decide the spread, breakpoints, the POWER/RESISTANCE dominance guard,
   and the pure-tank stall-breaker.
2. **Loadout option catalog (Phase 5).** The actual 4+ options per category, each a justified
   sidegrade, plus point costs and which are default vs unlockable. Avoid illusion-of-choice.
3. **Unlock economy (Phase 6).** Envelope earn rates and unlock costs/order; what's gated behind rank
   vs purchase; respec cost. Must respect player time and not feel grindy.
4. **Opponent roster & difficulty curve (Phase 8).** Per-division handicap tables, boss definitions,
   rival personalities/cosmetics, and how CPU power/stats scale against the player's growing build.
5. **Promotion/demotion math (Phase 3/8).** The record→outcome gradient per division and the
   Ozeki/Yokozuna gates (kadoban, consecutive-yusho, zensho shortcut).
6. **CPU AI difficulty tiers (Phase 8).** IMPOSSIBLE is broken and must be rebuilt; EASY/NORMAL don't
   exist and should be built as handicapped versions of the HARD expert brain (reaction-miss, slower
   cadence, no power-up usage), not new codebases. Define the per-division/day mapping + within-basho
   ramp.

---

## 9. Testing strategy (no DB, no ranking yet)

Because there's no backend and progression is long, build **debug affordances** early (dev-only, e.g.
behind a key combo or `localStorage` flag like the existing `disableMovementPrediction`):
- **Jump to any rank/division** instantly.
- **Force a bout outcome** (win/lose) to test record resolution, promotion, demotion, kadoban, yusho.
- **Grant/clear envelopes, stat points, and unlocks.**
- **Reset / export / import the save** (export also helps users file bug reports).
- **Fast-sim a basho** (auto-resolve bouts) to test the orchestrator without playing 15 fights.
- Verify the **PvP + VS CPU firewall** explicitly: a test that confirms a maxed BASHO loadout/stats
  produces an identical fighter to a fresh one in BOTH a PvP match AND a plain VS CPU match (VS CPU is
  a protected baseline — see Guardrail 1). Also confirm a plain VS CPU match is still first-to-2.
- Verify **save migration** by loading an older `schemaVersion` fixture.

---

## 10. Open questions / decisions still to make
- Hub vs separate "bout prep" screen: does loadout/stat editing happen in the hub, in a pre-bout
  screen, or both? (Lean: edit in hub between bashos; lock during a run.)
- Can the player **scout** upcoming opponents (enables pre-run loadout strategy) — and how much info?
- Exact starting stat-point count and the rank→point unlock schedule.
- Does demotion reset the in-progress loadout/draft, or only rank? (Run draft resets; persistent
  loadout stays.)
- Career Stats menu item: fold into the BASHO hub, or keep separate?
- Fake-injury anti-farm: small incomplete-record movement vs. count-remaining-as-losses (Section 8).

---

## 11. Key file index (quick reference)

| Path | Role for BASHO |
|------|----------------|
| `client/src/App.jsx` | Owns `currentPage`; wraps providers |
| `client/src/components/MainMenu.jsx` | Page router + menu JSX (edit here for menu + `case "basho"`) |
| `client/src/components/CustomizePage.jsx` | **Layout template** for the single-player hub |
| `client/src/components/Lobby.jsx` | 2-player lobby (reference; strip P2 for BASHO) |
| `client/src/components/menuTheme.js` | Design tokens — use for all BASHO UI |
| `client/src/components/PowerUpSelection.jsx` | Card pattern for loadout/draft picks |
| `client/src/utils/SpriteRecolorizer.js` | `recolorImage` for the penguin preview |
| `client/src/context/PlayerColorContext.jsx` | Color state |
| `client/src/config/spriteConfig.js` | Color presets (source of truth) |
| `main.js` / `preload.js` | Electron settings IPC — mirror for the save file |
| `server-io/playerFactory.js` | `createInitialPlayerState` — where stat modifiers hook in |
| `server-io/constants.js` | Combat constants (PvP baseline) + power-up defs |
| `server-io/gameFunctions.js` | `handleWinCondition` (add best-of-1 for BASHO) |
| `server-io/socketHandlers.js` | `create_cpu_match`, lobby/ready flow (adapt for BASHO bouts) |
| `server-io/roomManagement.js` | `createCPUPlayer`, power-up selection |
| `server-io/cpuAI.js` | Single expert CPU brain; `DIFFICULTY_PROFILES` dials EASY/NORMAL/HARD/IMPOSSIBLE |
| `client/src/components/PreMatchScreen.jsx` | Existing `getRank()` (replace with banzuke model) |

---

*End of spec. Build Phases 0–3 first, polished. Keep the PvP firewall intact. Make it premium.*
