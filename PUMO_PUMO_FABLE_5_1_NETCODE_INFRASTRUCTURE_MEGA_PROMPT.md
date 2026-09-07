# PUMO PUMO — Fresh Netcode, Online Performance, and Live Infrastructure Overhaul

## Forensic audit, architecture decision, and first durable implementation phase

Read this entire prompt before doing anything.

You are the principal real-time multiplayer engineer, network-simulation architect, backend architect, performance engineer, SRE, and security reviewer for **PUMO PUMO**, a commercial Electron game intended for Steam.

This is not a request to sprinkle optimizations onto the existing networking code. It is also not an instruction to install rollback, replace Socket.IO, move away from Heroku, add Redis, use peer-to-peer networking, or adopt any fashionable architecture by default.

Your mission is to independently determine the strongest practical online architecture for this actual game, prove that decision with executable evidence, and then implement the first substantial, permanent phase of that architecture. You have permission to retain, tune, delete, replace, or comprehensively redevelop any networking, simulation, session, deployment, or client-reconciliation subsystem when the evidence says that is the correct solution.

There is no artificial limit on the eventual size of the overhaul. There is, however, a very high bar for changing foundations without first understanding them. Maximum ambition means reaching the best end state with proof, not maximizing churn or selecting the most complicated technology.

---

## Product facts and constraints

- PUMO PUMO is a fast, physics-like, 1v1 penguin sumo game.
- It is a sumo game at heart, not a conventional combo-heavy fighting game.
- It does not depend on the same strict combo-link timing as some traditional fighters, but immediate controls, trustworthy outcomes, fairness, consistency, and clear cause-and-effect under real network conditions are still commercial requirements.
- The shipping client is an Electron application intended for Steam.
- Online play is presently 1v1.
- A future **online Basho mode** will contain eight tournament entrants. Every entrant plays every other entrant once. Each tournament round can therefore contain four separate 1v1 matches running concurrently. Best record wins; ties lead to playoffs.
- Do **not** implement online Basho mode in this phase. Ensure the chosen architecture does not create a dead end for it.
- The current public server is reportedly running on one Heroku dyno. Treat that as the current prototype deployment, not as something to preserve and not as proof that Heroku is wrong.
- Expected launch concurrency, player geography, monthly infrastructure budget, acceptable queue time, and target Steam Deck support are not yet specified. Do not invent certainty. Recommend sensible launch defaults, expose the variables, and identify which few product decisions genuinely require the developer.
- Offline, local, training, CPU, and any already-working non-online modes must not be accidentally broken by the online overhaul.

The desired outcome is the best system that can realistically be engineered, tested, operated, and maintained for this codebase. Do not propose magical proprietary technology, hand-wave hard integration work, or select something merely because a famous game uses it.

---

## Mandatory clean-room reset

Form your own opinion from the current executable system.

### Exclude inherited prose

- Do **not** read or use repository Markdown files, old audits, architecture plans, design notes, performance reports, roadmaps, prior AI recommendations, or postmortems as evidence.
- If the environment requires an agent-instruction file to be read, obey its procedural rules, but do not import its claims about the game or architecture into your diagnosis.
- Do not inspect git history or old branches to inherit previous explanations.
- Do not use this prompt's list of candidate technologies as an implied answer.
- The only Markdown report you may create in this pass is the deliverable named below.

### Treat comments and names as untrusted

- Code comments, TODOs, docstrings, debug labels, variable names, and function names may help locate code, but their claims are not evidence.
- Trace the live executable path and verify what actually happens.
- Existing tests and benchmark scripts may be useful, but first inspect what they truly exercise. A green test proves only its assertions; an existing benchmark proves only its actual workload.
- Do not cite a comment or an old benchmark summary as the basis for an architectural decision.

### Evidence hierarchy

Prefer evidence in this order:

1. Reproducible behavior and measurements from the current client/server path.
2. Executable production code, configuration, protocol payloads, and deployment behavior.
3. Targeted instrumentation or tests that distinguish competing explanations.
4. Existing tests after their methodology has been verified.
5. Expert inference, explicitly labeled as inference.

For claims about current vendors, Steamworks, transports, libraries, or hosting platforms, use current official documentation when web access exists. Avoid SEO articles, generic multiplayer tutorials, vendor-comparison spam, and unsourced community opinion. If current documentation cannot be checked, label vendor-specific conclusions provisional.

---

## Authority and change freedom

Nothing is protected merely because it exists.

You may, when justified:

- replace the transport or networking library;
- redesign the protocol and message taxonomy;
- extract or rebuild the simulation boundary;
- change authority, prediction, reconciliation, interpolation, lag-compensation, or rollback strategy;
- replace in-memory room/session architecture;
- redesign the server process model;
- separate control-plane and match-server responsibilities;
- introduce a proper identity, reconnect, result-integrity, observability, or deployment layer;
- remove obsolete code after its replacement is complete;
- refactor large cross-cutting blocks instead of placing patches around a bad foundation.

Do not preserve weak architecture out of politeness or sunk cost. Conversely, do not rewrite a sound subsystem merely to make the result look ambitious. For every major subsystem, explicitly choose **keep, harden, replace, or redesign**, and connect that choice to evidence.

The repository can be reverted through version control. Use that fact to make a bold but coherent implementation, not to become careless. Inspect git status first, preserve unrelated developer changes, never discard existing work, and do not use destructive git commands. Do not commit, push, deploy, provision paid services, or modify external accounts.

---

## Define the problem correctly

Do not collapse all online quality into the word “netcode.” Analyze these as related but distinct layers:

1. **Input and simulation model** — fixed step, state ownership, command processing, ordering, collision/outcome authority, clocks, timers, randomness, and determinism.
2. **Responsiveness model** — local presentation, input delay, prediction, remote presentation delay, interpolation, reconciliation, correction hiding, and rollback where appropriate.
3. **Protocol semantics** — message classes, reliability needs, sequencing, deduplication, acknowledgments, redundancy, stale-data rejection, snapshots, deltas, keyframes, resynchronization, reconnect, and versioning.
4. **Transport** — WebSocket/TCP, UDP-like messaging, Steam Networking Sockets, Steam Datagram Relay, or another justified option. Transport is not the same thing as rollback.
5. **Session and identity** — authentication, stable player identity, matchmaking, room allocation, reconnect ownership, result submission, version compatibility, and abuse prevention.
6. **Hosting and orchestration** — regions, placement, stateful match processes, control plane, persistence, draining, scaling, capacity, health, deployment, and disaster behavior.
7. **Performance and observability** — server tick health, event-loop stalls, CPU, memory, garbage collection, serialization, bandwidth, client frame time, and actionable production telemetry.
8. **Security and competitive integrity** — trust boundaries, validation, replay/duplication resistance, forged timestamps, impossible inputs, result integrity, denial-of-service exposure, secrets, and least privilege.
9. **Client asset/render stalls** — image decode, sprite upload, audio decode, cache misses, garbage collection, and long tasks that may look like network lag.

The ninth item is a diagnostic boundary in this pass, not permission to turn this into an asset-pipeline overhaul.

---

## Required end-to-end investigation

### 1. Establish the actual current architecture

Start with the relevant manifests, executable entry points, build/deploy configuration, and runtime wiring. Locate the real packaged-client path and the real production-server path; do not assume development and packaged modes behave the same.

Build an evidence-backed map of:

- Electron main, preload, renderer, and any local server responsibilities;
- remote server entry points and process lifecycle;
- how a client discovers and connects to a server;
- transport configuration and fallbacks;
- connection, authentication, matchmaking, room creation/join, ready/start, round, rematch, disconnect, and cleanup flows;
- where authoritative state lives;
- where simulation advances and at what clocks/rates;
- every path by which player input becomes a game action;
- every path by which an outcome becomes visible on both clients;
- snapshot/event production, serialization, transmission, receipt, buffering, interpolation, prediction, and correction;
- state that is tied to a connection ID versus stable player or match identity;
- persistence and cross-process coordination;
- health checks, logging, deployment configuration, and shutdown behavior;
- client and server dependency versions relevant to networking.

Trace at least these concrete journeys end to end:

1. process start to two players entering a real online match;
2. physical/logical input to immediate local response;
3. that input to authoritative consumption and resolution;
4. the resulting action/outcome to the remote player's rendered view;
5. simultaneous or near-simultaneous conflicting actions;
6. delayed, duplicated, stale, or missing application messages;
7. a transient disconnect and successful or failed recovery;
8. round completion, result ownership, room cleanup, and rematch;
9. server drain/restart while players are connected.

For each journey, distinguish simulation truth, transport delivery, client prediction, and rendered presentation. Do not call a visible pause “latency” until main-thread stalls, asset decode, simulation stalls, and network delay have been separated.

### 2. Inventory protocol semantics, not merely event names

Create a compact internal table of every gameplay-relevant message:

- producer and consumer;
- payload and approximate encoded size;
- frequency or trigger;
- ordered or unordered requirement;
- reliable, redundant, superseding, or disposable semantics;
- sequence/frame/tick identity;
- acknowledgment or retry behavior;
- deduplication and idempotency;
- stale-message behavior;
- reconnect/recovery behavior;
- validation and trust boundary.

Do not assume the underlying library provides the exact delivery semantics the game needs. Verify both normal operation and interruption behavior.

### 3. Audit simulation and time

Trace all clocks and scheduling mechanisms that influence gameplay:

- fixed-step versus variable-step advancement;
- wall-clock calls versus monotonic time;
- timers, intervals, animation clocks, delayed callbacks, and async side effects;
- server tick catch-up and overload behavior;
- input timestamps, clock-offset estimation, latency estimates, and sanitization;
- random number generation and seeds;
- iteration/order dependencies;
- floating-point and cross-runtime behavior;
- physics/collision state;
- effects, audio, UI, analytics, and networking side effects coupled to simulation;
- state that cannot presently be serialized or restored.

Identify where latency changes the rules, not just the visuals. For competitive interactions, compare symmetric and asymmetric latency. Determine whether either player can gain an unintended timing advantage, whether high RTT broadens or narrows an action window, and which clock is ultimately trusted.

### 4. Establish an honest baseline before editing production code

Before implementing changes, create temporary audit and measurement material under:

/tmp/pumo_net_audit

Keep raw captures, one-off probes, generated traces, and disposable scripts there. Do not litter the repository with scratch files.

Run the existing project with its existing package manager and installed environment when safely possible. Do not globally install tools. You may add a project dependency during the later implementation phase only if it is essential, current, justified, and its lockfile is updated normally.

Exercise the real production server/protocol with two actual clients or the closest headless two-client harness that faithfully reproduces both clients' connection and message behavior. A single fake client, direct calls into simulation functions, or server-controlled CPU matches are not sufficient as the sole network test.

If a GUI cannot be automated, combine:

- a real server process;
- two protocol-faithful client processes;
- direct simulation tests for mechanisms that cannot be observed headlessly;
- a clearly labeled statement of what remains unverified in the rendered client.

Use monotonic timestamps and shared trace identifiers where possible. Quantify clock-sync uncertainty rather than pretending clocks are exact.

At minimum measure:

- input to local visible/predicted response;
- client input creation to server receipt and server consumption;
- input to authoritative action/outcome;
- authoritative outcome to each client's receipt and rendered application;
- remote-state age and presentation delay;
- prediction success and misprediction rate;
- correction frequency, magnitude, duration, and visible snapping;
- server tick duration, scheduling jitter, missed deadlines, catch-up, and event-loop delay;
- snapshot/event cadence, gaps, encoded bytes, and bytes per second per player/match;
- duplicate, stale, rejected, or missing commands;
- state-resync frequency and correctness;
- disconnect detection, reconnect time, restored state, and failure mode;
- CPU, memory, garbage collection, and serialization cost as concurrent matches increase;
- client frame time and long tasks during the same run so renderer/asset stalls are not blamed on the network.

Report distributions, not only averages: at least median, p95, p99 where sample count makes that meaningful, plus worst observed value and sample count.

### 5. Test adverse conditions correctly

Use safe existing OS facilities, a local network proxy, or an application-level impairment harness. Do not require privileged system changes. If a technique is unavailable, use the closest valid alternative and explain the limitation.

Cover a representative matrix rather than creating endless permutations:

- round-trip latency around 0, 30, 60, 100, 150, and 250 ms;
- asymmetric routes or unequal player latency;
- stable and variable jitter;
- isolated spikes and burst stalls;
- 1–5 percent loss where network-layer loss can be simulated;
- brief connection interruption and longer reconnect windows;
- server CPU pressure and event-loop stalls;
- increasing concurrent 1v1 matches until the measured saturation boundary becomes visible.

Interpret impairment at the correct layer:

- With an ordered reliable TCP/WebSocket path, network loss normally manifests through retransmission delay and head-of-line blocking, not arbitrary application-message reordering.
- Separately inject application-level drop, duplication, delay, and stale delivery where needed to prove the game protocol's defenses and recovery semantics.
- If evaluating a UDP-style candidate, test its real message-channel reliability and ordering policies rather than projecting WebSocket behavior onto it.

Include action patterns that stress the game rather than only idle connections: rapid direction changes, held inputs, edge-triggered actions, simultaneous actions, repeated contacts, round transitions, rematches, and disconnects during meaningful states.

Do not declare capacity from serialization microbenchmarks alone. A capacity result must include the real tick loop, room lifecycle, protocol work, representative action traffic, memory, event-loop delay, and a stated safety margin.

---

## Mandatory rollback feasibility proof

Rollback is a candidate, not a predetermined answer. It is not to be dismissed as a proprietary secret, and it is not to be adopted because it has prestige.

Before deciding, perform a bounded proof under /tmp/pumo_net_audit using the current executable simulation:

1. Identify the complete minimal gameplay state for one match.
2. Determine whether it can be captured without renderer, audio, network, wall-clock, and external side effects.
3. Attempt to serialize or clone that state at a known simulation frame.
4. Advance through a recorded input sequence.
5. Restore the earlier state.
6. Replay the same inputs without rendering.
7. Compare canonical state hashes at every replayed frame.
8. Repeat enough times and through enough representative interactions to expose nondeterminism.
9. Measure state size, capture/restore time, single-tick time, multi-tick replay cost, memory pressure, and garbage-collection behavior.
10. Identify cross-process, cross-runtime, and cross-platform risks that the local proof does not settle.

Also inspect:

- fixed simulation quanta;
- random state;
- wall-clock access;
- timer callbacks;
- event ordering;
- object/collection iteration;
- floating-point sensitivity;
- side effects that would double-fire during replay;
- the separation, or lack of separation, between simulation and presentation;
- how confirmed versus speculative audio, VFX, UI, and round results would be committed.

If the current code cannot pass the proof, that is not automatically a rejection of rollback. Quantify what must be redesigned and estimate the migration sequence. Conversely, a small deterministic toy extraction is not proof that the complete game is rollback-ready.

Issue a direct verdict:

- adopt full rollback now;
- build toward rollback through a staged simulation rewrite;
- use a server-mediated or hybrid rollback model;
- reject rollback for this game and use a stronger authoritative prediction/reconciliation model;
- or choose a better architecture you can defend.

State the player-facing gain, fairness model, cheat implications, engineering cost, operational cost, and failure modes. Choose; do not hide behind “it depends.”

---

## Architecture decision: compare real alternatives

Compare at least these families against the actual game and measured baseline:

1. Hardened regional server-authoritative simulation with snapshot/event replication.
2. Server authority with substantially broader client prediction, reconciliation, input redundancy, and justified lag compensation.
3. Deterministic input synchronization with GGPO-style rollback over peer-to-peer or relayed connections.
4. Server-mediated or hybrid rollback with an authoritative server.
5. Any materially better design discovered during the investigation.

For each, evaluate:

- local responsiveness;
- remote motion and action quality;
- fairness under symmetric and asymmetric latency;
- behavior during jitter, spikes, and loss;
- correction or rollback artifacts;
- cheat resistance and result integrity;
- determinism and state-snapshot requirements;
- bandwidth, CPU, memory, and scaling;
- Electron/JavaScript/runtime integration;
- Steam identity, relay, and dedicated-server integration;
- disconnect and recovery behavior;
- implementation and migration risk;
- testability;
- operational complexity and cost;
- whether an AI coding agent can actually implement and verify it in this repository without unavailable proprietary technology.

Do not conflate:

- rollback with peer-to-peer;
- dedicated servers with server-authoritative snapshots;
- Steam Datagram Relay with hosting compute;
- a Socket.IO adapter with shared live match state;
- reconnecting a socket with restoring a match;
- low average ping with fair interaction rules;
- a high server tick rate with low input-to-display latency.

Produce one recommended target architecture and one explicit fallback. If the best target requires a large redevelopment, say so without softening it. Then define a migration that reaches that target without maintaining two permanent netcode systems.

---

## Required protocol design

For the chosen architecture, define exact semantics for each class of information:

- continuous input state;
- input edges and one-shot actions;
- simulation frames/ticks;
- authoritative state;
- speculative state;
- corrections or rollbacks;
- irreversible gameplay events;
- round/match results;
- clock/latency samples;
- connection health;
- resynchronization;
- reconnect/resume;
- matchmaking and allocation;
- protocol and game-build version.

Specify which data is:

- reliable;
- unreliable or superseding;
- redundantly sent;
- acknowledged;
- idempotent;
- sequenced;
- frame-addressed;
- bounded in size/frequency;
- safe to discard;
- persisted outside a live match process.

Define behavior for gaps, late input, duplicates, impossible sequence jumps, clock uncertainty, malicious timestamps, backpressure, slow clients, version mismatch, and partial recovery. “The library handles it” is not an acceptable protocol specification.

---

## Required production hosting and Steam plan

The live architecture must distinguish:

### Control plane

Longer-lived services such as:

- Steam-backed identity and entitlement verification;
- matchmaking and region selection;
- match allocation and signed connection authorization;
- tournament scheduling and standings in the future;
- durable results, ratings, sanctions, and audit records;
- configuration and compatible-version policy.

### Match data plane

Latency-sensitive, stateful work such as:

- one or more active 1v1 simulations per worker/process;
- client input ingestion;
- authoritative or rollback simulation;
- state/event delivery;
- live reconnect window;
- match result handoff;
- health, admission control, and graceful drain.

Determine from measurements whether isolation should be one match per process/container, multiple matches per worker, or another model. Do not guess a huge matches-per-instance number. Establish a load curve and a safe admission limit with headroom.

Design region placement using measured latency from both players. Explain the compromise when the geographically fair region is not the absolute lowest latency for either player. Include queue-time relaxation policy, region outage behavior, and what happens when no region meets the quality threshold.

Compare the current Heroku arrangement with a small set of credible current launch options. Include at least:

- a minimal regional container/VM deployment;
- a managed game-server/session platform;
- a major-cloud game-server option;
- a self-operated orchestrator only if it is genuinely appropriate.

Choose a recommended **prototype-to-staging path**, **Steam-launch path**, and **growth path**. Evaluate:

- available regions and routing;
- stateful connection behavior;
- process lifecycle and graceful draining;
- placement/allocation API;
- autoscaling and warm capacity;
- observability;
- DDoS/network protection;
- operational burden for a small team;
- vendor lock-in and migration;
- measurable cost drivers.

Use current official pricing only if it can be verified. Otherwise provide a cost formula using variables such as concurrent matches, worker capacity, regional hours, egress, relay traffic, database operations, and warm spare capacity. Do not fabricate a monthly bill from unknown player counts.

Evaluate Steamworks as a set of components rather than a magic hosting answer:

- Steam session-ticket authentication and stable Steam identity;
- lobbies or matchmaking integration;
- Steam Networking Sockets;
- Steam Datagram Relay for peer-to-peer and/or dedicated servers;
- dedicated game-server authentication and deployment requirements;
- native SDK or Node/Electron integration risk;
- partner-only configuration, credentials, tickets, or deployment steps that require the developer.

Do not expose player IP addresses without explicitly evaluating that security and privacy choice. Do not put publisher secrets in the Electron renderer or distributable client.

### Future Basho compatibility

Do not build Basho now. Define how the future mode fits:

- one tournament coordinator with durable tournament identity, schedule, standings, and playoff rules;
- four independent 1v1 match allocations per tournament round;
- stable entrant identity separate from socket connection;
- regional match placement;
- signed result reporting and duplicate/idempotent result handling;
- reconnect, no-show, forfeit, abandoned-match, and server-failure policy;
- tournament progress that survives any one match worker exiting.

Avoid coupling all eight entrants to one live simulation process unless evidence proves that is the best design.

---

## Security and failure review

Trace trust boundaries instead of producing a generic checklist. Verify:

- how a client proves identity and match authorization;
- which client claims affect gameplay;
- how inputs and timestamps are bounded;
- sequence replay, duplication, flooding, oversized payloads, malformed values, and impossible state;
- whether a connection identifier is incorrectly treated as permanent identity;
- whether one client can submit another player's action or result;
- session fixation or resume-token theft;
- CORS/origin assumptions;
- secrets and default credentials in source or distributable builds;
- logging of tokens or private data;
- denial-of-service amplification and per-IP/per-account/per-match limits;
- server-crash containment;
- stale workers and split-brain match ownership;
- result submission exactly-once effects through idempotency, not wishful exactly-once transport.

For each material risk, state exploitability, player impact, evidence, and the concrete architectural correction. Do not let security work consume the entire pass unless it is a top launch blocker.

---

## Asset-loading boundary

The reported first-use lag around sprites/images/audio may be real and important, but it is a separate client-runtime workstream.

In this pass:

- measure client frame time, long tasks, decode/upload/cache activity, and memory pressure alongside network traces;
- determine whether apparent network problems correlate with asset or render stalls;
- identify the executable asset paths responsible when the evidence is clear;
- ensure new network instrumentation itself does not cause frame stalls;
- include a concise handoff section in the report.

Do **not** redesign preloading, sprite sheets, animation assets, audio encoding, caches, or the broader rendering pipeline here. Do not hide asset work inside the netcode diff. A later dedicated pass should solve it with its own baseline and acceptance tests.

---

## Implementation mandate

This is not audit-only.

After establishing the baseline, completing the rollback proof, and selecting the target architecture, implement the **largest coherent first production phase that can be completed and honestly verified in this run**.

The first phase must:

- be a permanent part of the selected target architecture, not a disposable patch;
- attack the highest-leverage verified limitation or establish the unavoidable foundation for doing so;
- be end to end where possible, rather than adding unused abstractions;
- include protocol, server, client, and tests when the chosen slice crosses them;
- remove or replace superseded paths when migration is complete;
- avoid a permanent dual-stack or half-switched protocol;
- preserve unrelated local/offline modes;
- contain explicit compatibility behavior when old and new client/server builds could meet;
- include production-usable telemetry needed to validate it, with bounded overhead and no sensitive data;
- have measurable before/after acceptance criteria.

The size of this phase is determined by coherence and proof, not by a small-file-count rule. A broad refactor is allowed. A full netcode rewrite is allowed if it can be made internally complete and tested. Do not begin a sprawling rewrite that ends with essential paths stubbed, commented out, or “to be finished later.”

Examples of potentially valid first phases include a deterministic simulation/state boundary, a frame-addressed input ledger and replay core, a complete input/protocol reliability contract, a new prediction/reconciliation vertical slice, or a stateful regional match-worker boundary. These are examples only. Select the phase from evidence; do not choose one because it appears in this prompt.

If a material blocker makes production implementation unsafe—for example the actual runtime cannot be executed, the simulation boundary cannot yet be identified, or a required product decision changes the architecture—do not fabricate completion. Finish the evidence-backed audit and feasibility work, state the blocker precisely, and identify the smallest decision or access needed to continue.

Do not:

- change gameplay balance or action rules merely to hide network problems;
- add artificial input delay without proving its tradeoff;
- mask corrections with animation while leaving authority divergence unresolved;
- increase update frequency without bandwidth and tick-budget evidence;
- add Redis, a queue, Kubernetes, microservices, or a native dependency as architecture theater;
- replace Socket.IO solely because “real games use UDP”;
- retain Socket.IO solely because replacing it is inconvenient;
- claim rollback is complete without deterministic replay and desync tests;
- claim Steam readiness using mocked authentication alone;
- claim production scalability from a localhost microbenchmark;
- deploy or purchase infrastructure.

---

## Verification after implementation

Re-run the same representative baseline scenarios after the implementation. Compare like for like.

At minimum:

- run relevant existing tests after checking their meaning;
- add focused tests for the new architecture and its failure modes;
- run client and server build/type/lint checks that the repository actually uses;
- test two-client match start, meaningful actions, round completion, rematch, disconnect/reconnect, and cleanup;
- test sequence gaps, duplicates, stale messages, invalid payloads, and version mismatch;
- repeat the adverse-network subset most relevant to the implemented phase;
- repeat the concurrency/load curve far enough to identify regression or improvement;
- check offline/local/training/CPU modes affected by shared code;
- inspect git diff for accidental asset, generated-file, formatting, or unrelated churn.

Use quantitative gates based on the actual tick rate and product target. Where a target was not supplied, propose one and label it a recommendation. Do not quietly convert “better” into a subjective claim.

For every claimed improvement, provide:

> baseline scenario and metric → implementation mechanism → post-change metric → residual limitation

If a metric did not improve, say so. If the first phase is foundational and is not expected to improve player-visible latency yet, prove the new capability it unlocks and do not pretend it already changed match feel.

---

## Required report

Create exactly one new Markdown report at the repository root:

FRESH_NETCODE_INFRASTRUCTURE_AUDIT.md

It must be concise enough to be actionable but complete enough for another senior multiplayer engineer to challenge and continue the work. Include:

### A. Executive verdict

- Why online play is or is not currently ready for a commercial Steam launch.
- The central technical pattern behind the most important quality limits.
- The chosen target architecture in plain language.
- The first production phase you implemented.

### B. Evidence and limitations

- Runtime paths, deployment configuration, and protocol flows inspected.
- Exact tests, traces, harnesses, environments, and sample counts used.
- What could not be executed or verified.
- Which statements are direct evidence versus inference.

### C. Actual end-to-end architecture

A compact diagram and explanation of the current client, server, simulation, transport, room/session state, and deployment model. Include the input-to-render timeline for local and remote players.

### D. Measured baseline

Use compact tables for normal and adverse network conditions, tick/event-loop health, bandwidth, corrections, reconnect behavior, and concurrency. Include percentile, worst case, and sample count where meaningful.

### E. Ranked root causes and launch risks

Limit this to the highest-leverage findings. For each:

- player-facing or operational symptom;
- verified mechanism and executable path;
- competing explanations considered;
- severity and confidence;
- keep, harden, replace, or redesign;
- correction and measurable success criterion.

### F. Rollback feasibility verdict

- Result of snapshot/restore/replay/hash proof.
- State size and capture/replay cost.
- Determinism and side-effect blockers.
- Full, staged, hybrid, or rejected recommendation.
- Why rollback would or would not outperform the alternatives for this game.

### G. Architecture decision record

A comparison matrix for credible candidates, the selected target, the fallback, rejected alternatives, tradeoffs, and migration path. Do not end with several equal recommendations.

### H. Target protocol and simulation contract

Message classes, frame/tick semantics, reliability, ordering, redundancy, acknowledgments, idempotency, resync, prediction/reconciliation or rollback behavior, clocks, versioning, and failure behavior.

### I. Hosting and Steam launch architecture

- Control plane versus match data plane.
- Region measurement and match placement.
- Match-worker isolation and measured capacity model.
- Prototype/staging, launch, and growth recommendations.
- Current-provider limitations and provider comparison.
- Steam identity/network/relay/dedicated-server integration.
- Graceful drain, deploy, outage, and observability plan.
- Cost formula and the inputs still needed.

### J. Future online Basho compatibility

Show how eight entrants and four concurrent isolated 1v1s fit the architecture without implementing the mode.

### K. Security and failure findings

Only material, evidence-backed risks and corrections.

### L. Implemented first phase

- Exact files and paths changed.
- Why this was the correct durable slice.
- Intentional behavior/protocol changes.
- Removed or superseded paths.
- Tests added.
- Baseline versus post-change evidence.
- Regressions checked.
- Remaining limitations.

### M. Asset-loading handoff

Only the measured evidence needed for a future dedicated asset/preload performance pass. No asset solutions or asset-pipeline changes here unless a tiny diagnostic correction was strictly necessary to measure accurately.

### N. Remaining roadmap

Define coherent phases to reach the target architecture. For each include:

- player or operational outcome;
- scope and major dependencies;
- acceptance gate;
- rollback/migration boundary;
- what must be learned before continuing.

Identify the single recommended next phase. Do not produce a giant undifferentiated backlog.

### O. Genuine developer decisions

List only choices that cannot be resolved from code, measurements, or engineering judgment. Give your recommended default and consequences for each. Likely examples are launch regions, budget envelope, acceptable matchmaking wait, and appetite for native Steamworks integration. Do not ask questions merely to avoid making a recommendation.

---

## Failure conditions

This work fails if it:

- imports conclusions from old Markdown or code comments;
- begins with a predetermined demand for rollback, UDP, dedicated servers, Redis, or a provider;
- equates a more complex architecture with a better one;
- performs a broad rewrite before capturing a baseline;
- tests only localhost with no impairment;
- tests one client or idle sockets and calls it multiplayer validation;
- reports averages without tails or sample counts;
- measures server throughput while ignoring tick deadlines and client experience;
- treats transport reliability as application correctness;
- treats a reconnect as match recovery without proving state restoration;
- treats Steam as free global game-server hosting;
- assumes additional Heroku processes automatically share in-memory matches;
- uses asset-loading stutters as proof of network failure;
- rewrites the asset pipeline during this pass;
- promises rollback without a deterministic replay proof;
- claims “production ready” without failure, load, version, security, and deployment evidence;
- leaves the repository with half-migrated production paths or placeholder architecture;
- writes many reports instead of one evidence-backed report;
- pads the result with a file inventory, generic best-practices checklist, or speculative future systems.

This work succeeds if:

- an expert can reproduce the measurements;
- the chosen architecture follows from the game's actual behavior and constraints;
- rollback receives a real proof rather than worship or dismissal;
- the hosting plan separates stateful matches from durable coordination;
- future Basho fits naturally without being prematurely built;
- the implemented phase is substantial, permanent, tested, and points directly at the target end state;
- every important claim distinguishes proof, recommendation, and remaining uncertainty.

---

## Final response in Cursor

After the report, implementation, and verification are complete, stop.

In chat, provide only:

1. A direct verdict on current Steam-launch readiness.
2. The chosen long-term netcode and hosting architecture.
3. The rollback verdict and the proof behind it.
4. The production phase actually implemented.
5. The most important before/after measurements.
6. The single next phase.
7. The path to FRESH_NETCODE_INFRASTRUCTURE_AUDIT.md.
8. Any blocker that materially reduced confidence.

Do not narrate routine file searching or produce a celebratory summary. Be precise about what is complete and what is not.
