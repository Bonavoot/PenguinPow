# PUMO PUMO — Fresh, Independent Gameplay-Feel Audit

## Phase 0 only: form your own diagnosis before changing the game

Read this entire prompt before doing anything.

You are the lead combat designer and gameplay-feel engineer auditing **PUMO PUMO**, a commercial 2D penguin sumo fighting game intended for Steam.

The game is a sumo game at heart, not a conventional fighter that happens to contain penguins. Its mechanics are still open to change. The quality target is a polished, deliberate, highly readable commercial fighting game. *Super Smash Bros.* is relevant only as an example of exceptionally clear intent, contact, consequence, and knockout presentation. Do not copy its mechanics or aesthetic, and do not assume it contains the correct answer for this game.

The developer's subjective report is simply: the current gameplay looks and feels “scuffed,” interactions do not always feel legitimate or easy to read, and many animations are placeholders. That is a report to investigate—not a diagnosis to accept.

Your job is to independently determine:

1. What a player can actually see and feel going wrong.
2. Which few underlying causes create most of that impression.
3. What should be kept, tuned, removed, replaced, or redesigned.
4. What can and should be fixed before final animation production.
5. What the smallest high-leverage first implementation phase should be.

Do not inherit anyone else's explanation of the game. Build your own model from observable gameplay and executable behavior.

---

## Inputs

- Repository root: the current Cursor workspace.
- Gameplay recording: `@C:\Users\vente\Videos\2026-09-05 02-12-12.mkv`
- If the terminal is running inside WSL, try: `/mnt/c/Users/vente/Videos/2026-09-05 02-12-12.mkv`
- If Cursor exposes the recording as an attached `@` file, use that copy.

Inspect the complete recording, including audio, at normal speed first. Revisit important moments frame by frame or in slow motion when useful. You may use already-installed tools such as `ffprobe` or `ffmpeg` to inspect it, but do not install software.

If the recording is inaccessible, say so plainly and stop before issuing a confident gameplay-feel diagnosis. Do not invent observations or timestamps and do not disguise a source-only code review as a visual gameplay audit.

---

## Mandatory epistemic reset

This is a clean-room design review of the current playable behavior.

### Exclude prior prose analysis

- Do **not** read or use repository `.md` files, design notes, roadmaps, prior audits, improvement plans, postmortems, or AI-generated recommendations as evidence.
- If the environment requires you to read an agent-instruction file, obey its procedural constraints, but do not treat any of its gameplay claims or opinions as evidence.
- Do not inspect git history or old branches in search of previous explanations.
- The only Markdown file you should create in this pass is the new audit requested below.

### Treat code comments as untrusted prose

- Comments, TODOs, docstrings, annotations written as prose, and claims embedded in debug labels are **not evidence** of what the game does or should do.
- Do not cite them to support a conclusion.
- A comment may help you locate executable code, but every relevant claim must be independently verified through the live code path, runtime data, or direct observation.
- Identifiers and function names can also be misleading. Trace behavior rather than trusting names.

### Use an explicit evidence hierarchy

Prefer evidence in this order:

1. What is visibly or audibly observable in the supplied gameplay recording.
2. Reproducible runtime behavior, if the project can be run safely with its existing setup.
3. The executable code and data path that produces that behavior.
4. Targeted tests or instrumentation that directly validate a disputed mechanism.
5. Expert inference, clearly labeled as inference.

Tests can characterize behavior, but they may be stale or encode an obsolete intention. Passing tests do not prove that the game feels good; failing tests do not automatically identify the design problem.

Do not use prior commentary from this prompt's author, previous AI agents, repository prose, or presumed developer intent to rank findings.

---

## Design freedom

No current mechanic, tuning value, subsystem, feedback effect, or implementation is protected merely because it already exists or was once described as “approved.” Its age and authorship are irrelevant.

You may recommend:

- keeping something that is already effective;
- retuning or simplifying it;
- deleting redundant or harmful behavior;
- replacing a local implementation;
- redesigning a mechanic or interaction contract;
- restructuring a system when a systemic cause is proven.

Do not preserve weak behavior out of politeness. Conversely, do not propose a rewrite merely to appear ambitious. If a focused change can solve the verified problem cleanly, prefer it. If it cannot, explain why and recommend the larger correction without hesitation.

The game can be reverted through version control. Revertibility should come from small, isolated implementation phases and measurable checkpoints—not from treating the current design as sacred.

---

## What “deep” means in this audit

Depth means following the strongest evidence to root causes. It does **not** mean inventorying every file, commenting on every mechanic, producing the longest report possible, or forcing work into a predetermined checklist.

Begin broadly enough to see the game honestly, then narrow aggressively:

- Identify the **three to five** problems that contribute most to the amateur or illegible impression.
- Prefer causes that explain several visible symptoms over isolated cosmetic defects.
- Trace only the systems needed to prove or disprove those causes.
- Expand scope only when the evidence shows that a root cause crosses more systems.
- Explicitly identify tempting work that is low-value, premature, or merely cosmetic.

Do not add “juice” by default. More hitstop, shake, particles, sound, slow motion, trails, flashes, or UI can make an interaction noisier without making it clearer or more convincing. Recommend feedback only when you can state what information or sensation it communicates, at what moment, and why the existing interaction fails without it.

Likewise, do not blame every weakness on placeholder animation. Determine which failures originate in authored timing and poses, which originate in simulation or state transitions, which originate in collision/outcome logic, and which originate in the presentation layer. Separate what is fixable now from what truly requires final art.

Useful professional lenses may include temporal clarity, commitment and recovery, movement and weight, spatial causality, contact and reaction, state readability, control response, collision credibility, feedback synchronization, camera/audio/VFX hierarchy, and consistency across interactions. These are diagnostic lenses, **not** a required list of findings. Apply your own judgment and discuss only what the evidence makes relevant.

---

## Required investigation method

### 1. Observe before interpreting the implementation

Watch the gameplay recording before conducting a deep source review. Record neutral, timestamped observations such as what action appears to begin, when contact seems to occur, what response is visible, what a new player could infer, and where cause and effect become ambiguous.

Do not begin with solutions. Do not call something a timing, networking, animation, collision, or VFX problem until you have evidence for that attribution.

Sample the important interaction types that actually appear in the clip, especially repeated and match-deciding moments. Do not fabricate coverage for mechanics that are not shown.

### 2. Form competing explanations

For each major visible symptom, consider at least two plausible explanations before settling on one. For example, a weak-looking contact could come from authored pose timing, event timing, displacement, reaction selection, camera behavior, audiovisual hierarchy, a mismatch between simulation and rendering, or a combination. Those examples are possibilities, not presumed faults.

State what observation would distinguish the alternatives. This is how you avoid turning first impressions into fake certainty.

### 3. Trace only the relevant executable paths

After the observation pass, locate and trace the current runtime path for each high-impact interaction under investigation. Follow it end to end as far as necessary—for example from input/intent through authority and resolution to the player-visible pose, motion, audio, VFX, camera, UI, or state consequence.

For each claimed cause:

- identify the concrete executable files, functions, data, and ordering involved;
- distinguish server/simulation truth from client/rendered presentation where applicable;
- verify actual values and event timing rather than trusting labels or comments;
- determine whether the behavior is local, duplicated, inconsistent, or systemic;
- look for contradictory evidence;
- assign a confidence level.

If safe and feasible with the existing repository setup, run only the targeted game path, test, or diagnostic needed to settle an important uncertainty. Do not install dependencies, run broad destructive scripts, or build unrelated tooling. If runtime validation is not feasible, label the limitation.

### 4. Diagnose root causes, not a wishlist

A top finding must contain a complete evidence chain:

> observed player-facing symptom → likely mechanism → verified implementation path → why that mechanism produces the symptom → proposed correction → expected perceptual result

If you cannot establish that chain, label the item as a hypothesis or omit it from the top findings.

Do not write generic advice such as “improve animations,” “add more polish,” “make hits punchier,” or “use better sound.” Convert each recommendation into an interaction-level change with a clear purpose and a way to judge whether it worked.

### 5. Rank by leverage

Rank recommendations using your own expert judgment, considering:

- likely improvement to moment-to-moment feel and readability;
- breadth of interactions improved;
- confidence in the diagnosis;
- implementation and regression risk;
- dependency on final art;
- cost relative to player-facing gain.

The top priority is not necessarily the easiest change or the most sophisticated system. It is the change with the best evidence-backed leverage.

---

## Scope discipline

This pass is **diagnosis and implementation planning only**. Do not modify production game code, tuning, assets, tests, or configuration yet.

That restriction is methodological, not conservative: mixing many subjective changes into the discovery pass makes it impossible to tell which diagnosis was correct. Your recommendations may still be bold, including deletion or redesign. They will be implemented in isolated follow-up phases so their effects can be compared and reverted.

Do not spend time on any of the following unless it is strictly required to prove a top finding:

- exhaustive repository inventories;
- a report on every combat system;
- large interaction matrices;
- broad refactors or cleanup;
- new general-purpose debug frameworks;
- rewriting unrelated tests;
- final asset production;
- networking, menu, progression, monetization, platform, or deployment work unrelated to observed gameplay feel;
- speculative features added only because another fighting game has them.

Inspect `git status` before working so you can distinguish the developer's existing changes from your own audit file. Do not modify or discard existing work. Do not commit, push, deploy, or use destructive git commands.

---

## Required deliverable

Create exactly one new file at the repository root:

`FRESH_GAMEPLAY_FEEL_AUDIT.md`

Keep it as concise as the evidence permits. It must contain:

### A. Independent verdict

A direct explanation, in plain language, of why the current game does or does not feel amateur, unclear, or unconvincing. State the central pattern you found. Do not restate the developer's feelings as if they were evidence.

### B. What you actually inspected

- Recording duration and whether audio was available.
- Relevant gameplay moments reviewed.
- Runtime/code paths traced.
- Any targeted tests or runtime checks performed.
- Anything important you could not verify.

### C. Timestamped player-facing evidence

Use a compact table with:

| Timestamp | Neutral observation | Likely player reading | Why it matters | Confidence |
|---|---|---|---|---|

Include only moments that materially support the diagnosis. Separate direct observation from interpretation.

### D. The three to five highest-impact root causes

For each root cause, provide:

- the player-facing symptom;
- the evidence chain;
- the exact executable path involved;
- competing explanations considered and why they were rejected or remain possible;
- how broadly the cause affects the game;
- confidence: high, medium, or low;
- whether it can be addressed before final animations;
- the recommended disposition: keep, tune, simplify, remove, replace, or redesign.

Do not inflate the list to appear thorough.

### E. Highest-leverage recommendations

Rank only the changes you genuinely recommend. For each one include:

| Rank | Proposed change | Player-facing result | Evidence/confidence | Cost/risk | Art dependency | Success check |
|---|---|---|---|---|---|---|

Every recommendation must connect to a top root cause. If you recommend a broad rewrite, explain why a narrower correction would not solve it.

### F. What **not** to do yet

Name the attractive but premature, unsupported, or low-leverage changes you considered. Explain briefly why they should wait or be omitted. This section is mandatory because restraint is part of a high-quality plan.

### G. Before-final-animation contract

Separate the work into two short lists:

1. Systems, timing, interaction contracts, and placeholder-safe presentation work that should be settled before final animation production.
2. Improvements that truly depend on authored poses, transitions, effects, or audio assets.

Do not turn this into a full animation-production specification.

### H. Recommended first implementation phase

Define the smallest vertical slice that can validate the most important diagnosis. Specify:

- one focused scope;
- the exact interactions and code paths it would touch;
- what should deliberately remain untouched;
- observable before/after acceptance criteria;
- regressions to check;
- how to compare it against the current behavior;
- the stopping point before expanding scope.

The slice should be substantial enough to reveal whether the game is moving toward premium feel, but isolated enough that a bad direction can be reverted cleanly.

### I. Genuine design decisions

List only questions that require the developer's taste or product direction and cannot be answered from evidence. Give your recommendation and the tradeoff for each. Do not use questions to avoid making an expert judgment.

---

## Quality bar for the audit

Your report fails if it:

- imports conclusions from old documentation or comments;
- assumes the developer's diagnosis is correct;
- mistakes the amount of feedback for the quality of feedback;
- blames placeholder art without tracing the underlying interaction;
- produces a generic fighting-game polish checklist;
- prescribes mechanics simply because a famous game uses them;
- recommends a large rewrite without evidence that local correction is insufficient;
- treats current behavior as untouchable;
- treats unverified inference as fact;
- lists dozens of equal-priority tasks instead of identifying leverage;
- performs changes during the audit and then judges its own altered baseline.

The report succeeds if another senior developer can use its evidence to understand the current feel, challenge your reasoning, and implement the first phase without guessing what problem it is meant to solve.

---

## Final response in Cursor

After writing `FRESH_GAMEPLAY_FEEL_AUDIT.md`, stop. Do not begin implementation.

In chat, provide only:

1. Your independent one-paragraph verdict.
2. The three to five root causes, ranked.
3. The single first implementation phase you recommend.
4. The path to the audit file.
5. Any blocker that materially reduced confidence.

Do not pad the response with a file inventory or a narration of routine tool use.
