# THE SAUCE

**What it is. What Smash has. What sumo has. What PenguinPow has. What to do now.**

This is a design diagnosis, not a patch list. No production combat numbers were changed for this document. Frame data and system claims below are from current source (`server-io/constants.js`, `commandGrabSystem.js`, `collisionSystem.js`, `grabMechanics.js`, and the existing combat audits).

---

## If you only remember one thing

**Sauce is not juice, and it is not more moves.**

Juice is the sound, the freeze, the spark, the slide. You have been juicing the ice and the contact for a long time, and it shows. That work is real. It is also not the hole you are pointing at.

**Sauce is the human story that a correct read is allowed to become.**

"I saw what you were going to do. I made you do it. Then I took something from you that you could feel — your feet, your body, your turn, the ring — and everyone watching knew it happened."

Smash's sauce is that sentence, told a hundred different ways. Real sumo's sauce is that sentence in ten seconds on clay. Your game already has the ending of the sentence (ring-out / posture dump) and the weather of the sentence (ice). **The middle of the sentence is missing.** A hit does not become your turn. A grab is no longer a conversation. A correct guess does not feel like skill, because the next moment looks like the last moment.

You leaned into the ice. The ice writes displacement. **The next lean is cashing the ice.**

---

## 0. Three words people mash together

Players, streamers, and designers use these as synonyms. They are not.

| Word | What it actually is | What it is not | PenguinPow status |
|---|---|---|---|
| **Feel** | The tactile contract. Input → motion → contact → consequence, in milliseconds. Steve Swink's *Game Feel*: "the tactile, kinesthetic sense of manipulating a virtual object." | Pretty VFX. | Strong and getting stronger. Tip-rail strikes, ice coast, hitstop, slide-slap convert. |
| **Juice** | Exaggerated sensory feedback that sells an event that already happened. Hitstop, shake, particles, bass, squash. Jan Willem Nijman / Vlambeer: polish that doubles down on what the game is about. | A substitute for a mechanic. | You have been here for months. Contact seams, hitstop tiers, slap hold, crowd, callouts. |
| **Sauce** | Style that the *rules* allow to exist. The clip. The swagger. The "ohhhh." In Smash community usage (Dabuz, sauce polls), it means a character / player / game is *fun to watch and fun to express yourself with* — surprise, variety, readable creativity — not merely strong. | More buttons. A roster. Another particle. | This is the hole. |

A juicy game can still have no sauce. *Cookie Clicker* is juicy. A lab dummy with perfect hitstop is juicy. **Sauce requires a person on the other side, a risk that could have gone the other way, and a reward that changes the conversation.**

Nijman's own rule for juice is the one that matters here: *double down on whatever your game is about.* If the game is about jumping, juice the landing. If it is about shooting, juice the gun. **If your game is about stealing someone's body on ice and throwing them out of a ring, juice and rules both have to serve that theft.** Extra sparkle on a +0 slap that hands the turn back is seasoning on a sentence that ends too early.

---

## 1. What "sauce" means when fighting-game people say it

### Smash community (the usage you are reaching for)

When Dabuz and the Ultimate community say a character "has sauce," they are not saying the hurtboxes are juicy. They are voting on **spectator joy + player expression**:

- Variety of ways to win, so the match does not play the same movie twice
- Surprise — if you know the next thirty seconds, there is no reason to watch
- Pacing that does not stall (Sonic timer-camping is the anti-sauce even when it wins)
- Room for a human to look like *themselves* on a character
- Moments that are readable from the couch: launch, spike, edgeguard, reverse 3-0, clip

Dabuz's "well-designed" criteria (Twitch, 2020) are even more useful than the sauce polls, because they name the *mechanical* half:

> Bowser: "He's intimidating. When he puts pressure on you, he puts pressure on you. But when you counter his pressure, whiff punish him, out-frame data him, out-range him, put him at disadvantage, **you feel rewarded and feel like it's your time to fight.**"

That last clause is the whole document. **Sauce is "your time to fight."** Not "you both woke up and flipped the same three-sided coin again."

### Traditional FGC

Same word, same hunger, different costume:

- **Footsies** (the *Footsies Handbook* lineage): walk just outside their range, make them swing, take your turn. The sauce is the whiff, not the combo trial.
- **Yomi** (David Sirlin, *Playing to Win*, "Spies of the Mind"): reading the person, not the animation. Layer 1 = I know you'll throw. Layer 2 = you know I know. Layer 3 = I throw anyway. **If all moves are equally good, the layers collapse.**
- **The clip**: a Daigo parry, a Leo clip, a Guilty Gear wall break, a Ken drive-rush confirm. Someone took a risk that had a name.

### Design research (so this is not just vibes)

Hicks, Gerling, et al., *Good Game Feel: An Empirically Grounded Framework for Juicy Design* (DiGRA / academic follow-ups): developers themselves say juiciness only works when it is **contextualized** — feedback married to mastery and control, not sprayed on every click. Direct, multimodal feedback is how the player *feels* that they caused something. If the rules then immediately take the something back, the brain files the event as noise.

Sid Meier's old line still holds: a game is a series of **interesting decisions**. An interesting decision has unequal payoffs and incomplete information. A 33/33/33 unreactable RPS with +0 on every result is a decision, but it is not an interesting one. It is a coin with extra faces.

---

## 2. Smash's sauce, taken apart

You said it yourself: it's everything, and it still feels simpler at the beginner level than a "real" fighting game. That is not an accident. Sakurai has said the quiet part for twenty years.

### Why it feels simple

- **One attack button.** Context does the taxonomy (tilt / smash / aerial / dash attack). Beginners do not learn a movelist. They learn a situation.
- **The consequence is a picture.** Percent goes up. They fly. You do not need frame data to know you got hit hard.
- **You can mash and still get a story.** A kid can smash-attack someone off the side. The story is complete. The expert story (DI, mixup, edgeguard) is the same sentence with better grammar.
- Sakurai, Famitsu / GDC-adjacent interviews: he balances for the **intermediate party player**, not the tournament turtle. He will accept "worse balance" to keep smash attacks, items, and stages *fun*. He has also said that **simplifying inputs is not the same as making a game easier** — if you strip options, you strip comebacks and creativity, and the skill gap gets crueler.

That last point is the trap you are in danger of walking into the other way. You already kept the kit small and comprehensible. Good. **Do not add Smash's movelist.** Add Smash's *sentence structure*.

### Why it has sauce anyway (the load-bearing pieces)

Smash is not saucy because Fox has twenty aerials. It is saucy because a hit **changes whose conversation it is.**

1. **Win condition is a drama, not a bar.** Percent is a fuse. The blast zone is a cliff. Last stock is a movie ending. You already copied this: no HP, ring + posture. **Keep it. This is one of your two real sauces.**
2. **Movement is a mixup.** Dash-dance, drift, waveland, empty hop, fade-back nair. The beginner presses a direction. The expert lies with their body. You have the seed of this on ice (coast, slide, henka, rope jump).
3. **Unsafe options create punish stories.** Landing lag, endlag, missed tech, bad recovery. The spectator can see the crime. The punisher gets a turn that lasts long enough to *do something*.
4. **Advantage is a place, not a plus-frame.** They are in the air, or offstage, or on their back. You can walk up and continue the sentence. The combo is optional; the *turn* is not.
5. **Characters are identity** — and you do not have a roster. That is fine. Smash uses characters because Nintendo has characters. **Your identity split has to live in playstyle** (oshi vs yotsu, slap-push vs grab-dump, ice-skater vs planter), the way real sumo does.
6. **Party + spectator readability.** A launch is a hieroglyph. Your kimarite banners are the same idea. Use them for *plays*, not just round results.

The beginner-complexity paradox you noticed is real: Smash has more ways to attack and feels less like homework because **the verbs collapse into situations**, and **every situation draws a picture of who is winning.** Your game is also easy to comprehend. The problem is the picture after a successful play is "we are both standing here again."

---

## 3. Real sumo's sauce (this is your genre, not Smash)

If you steal Smash's movelist you will get a worse Smash. If you steal sumo's *drama structure* you will get a game only you can make.

### The actual ingredients

- **The tachiai.** Minutes of ritual, then one collision that often decides the bout. Sumo Fan Magazine calls it the explosive end of a narrowing of distance: 50 meters apart, then 7, then 80 centimeters, then impact. You already have salt, crouch, hakkiyoi. The *gameplay* tachiai is the first ice collision — slap war, charge, or grab — and it should feel like a fork in the bout, not a reset button.
- **Oshi vs yotsu.** Pusher-thruster versus belt-grappler. This is the closest thing sumo has to a character select. Two humans, same body, different sentence. Your slap / palm / charged path is oshi. Your grab path is yotsu. **They must feel like different sports that share a ring**, not three buttons in a circle.
- **The ring is the health bar.** Space is blood. Every step back is a cut. Ice makes this louder than clay ever could. You leaned in correctly.
- **Kimarite.** 80+ named ways to win. The finish has a *name*. You already label THRUST OUT, PUSH OUT, OVERARM THROW, DEMOLISHED. That is sauce infrastructure. The play leading to it has to deserve the name.
- **Henka.** The sidestep at the charge. Legal, cheap, hated when a yokozuna does it, beloved when it is a read. You have sidestep. It should be the "I knew you'd lunge" verb — a story, not a get-out-of-jail iframe.
- **Utchari / edge theater.** The bout dies at the tawara. The best sumo is two bodies an inch from death, still wrestling. Your edge already multiplies posture (`SLAP_EDGE_POSTURE_MULT`). Lean here, not in mid-screen mash.

Sumo is not "safe." A slap that misses is a belt for the other man. A charge that is henka'd is a trip to the dirt. A belt grip that is lost is the bout. **The sport is a chain of stolen balances.** That is the sumo sauce. Ice should make the thefts bigger, not wash them out.

---

## 4. Fighting-game sauce as a machine (why your gut is right)

### Yomi needs unequal moves

Sirlin, *Playing to Win*, chapter 7:

> "Here's where the inequality of risk/reward comes in. **If all my moves are equally good, this whole thing falls apart.**"

He then builds yomi layers on a move that is *better* than the others (the throw you want), a counter (throw escape), a counter-counter (big slow move), and a wrap-around (the original throw beats the person who blocked the slow move).

Your current neutral is the collapse he warned about:

- Slap beats grab
- Parry beats slap
- Grab beats parry
- **All unreactable**
- **Almost everything that lands is +0**

That is not yomi. That is RPS with a penguin skin. Yomi is "I want the grab, I keep not throwing it, I make you stop looking for it, then I take your soul." That requires **a move that is actually better when it works**, and **a cost that is actually worse when it fails.**

You already wrote the cost on paper. Grab whiff is 450ms and fully vulnerable (`GRAB_WHIFF_RECOVERY_MS`). Empty parry is a 300ms jail (`AP_WHIFF_RECOVERY_MS`). Slap whiff pays an extra 45ms. Those are real windows. **They do not feel like stories** because the *success* side of the same verbs does not grant a turn. The brain compares "I guessed right" to "we both stood up." The ratio is wrong.

### Advantage is the sauce delivery system

Every saucy fighter has a word for "it's my turn now":

| Game | What "my turn" looks like |
|---|---|
| Street Fighter | Plus frames, confirm, knockdown, drive rush |
| Virtua Fighter | Knockdown → wake-up mixup (Sirlin's Akira/Pai example) |
| Smash | They're in the air / offstage / in hitstun long enough to chase |
| Nidhogg | One hit and you *run* — the whole screen becomes yours |
| Lethal League / Windjammers | You hit the object; you created a problem they have to solve |
| Real sumo | You have the belt, or they are on their heels at the tawara |
| For Honor (failure mode) | You guessed the unreactable branch; you got 20 damage; you guess again |

**Nidhogg is the best small-kit analog you have.** Two stances, almost no buttons, all the sauce is territorial momentum. A successful hit does not reset the RPS. It *gives you the map.*

**For Honor is the warning label with your name on it.** Attack / parry / guard-break is the same triangle you described. When the lights are 400ms and the mixup is unreactable, players do not say "this is yomi." They say "this is rock-paper-scissors" and they mean it as an insult (Steam discussions, years of them). Wesley Rockholz's 2017 Gamasutra/Game Developer piece on For Honor names the other failure mode: if defense is also unpunishable, the game turtles until the hardware dies. You accidentally built a cousin of both problems at once — **unreactable offense and no lasting reward for being right.**

### Reactable vs unreactable (both are required)

This is the part that gets religious. You do not want everything reactable. Then the best player holds parry and the game dies (For Honor turtle). You do not want everything unreactable. Then the game is a coin (For Honor lights, your current triangle).

The split that works in every good fighter:

| Put the unreactable mixup here | Put the reactable / punishable commitment here |
|---|---|
| After you have *earned* advantage (knockdown, broken posture, corner, slide convert) | Neutral buttons that miss |
| True 50/50s that finish a story already written | Raw grab from downtown |
| Option-selects at the last pixel of the ring | Empty parry, charged lunge, aerial landing, sidestep recovery |

Unreactable is the spice. **Earned unreactable is sauce.** Unreactable as the entire diet is why nothing feels like skill.

Sakurai again, inverted: Smash feels simple because the *commitments* are huge and visible (a smash attack, a recovery, a landing). The mixups live *inside* those pictures. Your mixups live *instead of* pictures.

---

## 5. Diagnosis: PenguinPow, from source, not vibes

### What already has sauce (do not throw this away)

1. **The win condition.** Knock them out, or dump them when posture is gone. This is Smash percent + sumo tawara. It is the best idea in the game. You said it. You are right.
2. **The ice.** Coast, slide, pair-slide on slap (`SLAP_ONHIT_ATTACKER_PUSH` / `VICTIM_DRIFT`), bigger distances, henka, rope jump. This is your movement identity. You leaned in. Correct.
3. **The convert you already hid in the ice lean.** Slide-slap is **+50ms, not +0** (`SLIDE_SLAP_ADVANTAGE_MS`), with a follow drift. The comment in `constants.js` is the whole philosophy you need, already written by you:

   > "Convert is +X, not +0. Just enough lock after you are free that they cannot sprint the hole closed during the plant. Pocket mash stays +0."

   **Pocket mash +0 is a tachiai slap war. Convert +X is sauce.** You already know the difference. You applied it once.
4. **Counter-hit bonus** (`SLAP_COUNTER_HIT_BONUS_MS` 35, KB 1.25). A seed of "you interrupted me."
5. **Perfect parry as a hero moment.** Regular AP is tuned +0. Perfect is a real stun (`AP_PERFECT_HITSTOP_MS` 210, advantage floor 420). That is the "I reacted" verb. Protect it. Make it the thing people clip.
6. **Grab whiff is long on purpose.** `executeGrabWhiff` literally says the 450ms window is "the primary answer to a fished grab" and the skid is so "the punish window reading as a punish." The *intent* is already sauce. The *follow-through* after you land the answer is not.
7. **Ritual, kimarite, penguin comedy + Shinto gravitas, Basho ladder.** Identity sauce. Party-adjacent. Keep.
8. **Contact fidelity.** Tip-rail, park, seam, hitstop. This is feel/juice in the good sense. It makes a hit *look* like a hit. It cannot make a hit *mean* a turn.

### What is killing the sauce

**+0 became a religion.**

It is not one number. It is a house style. From source, on purpose:

- Pocket slap: victim lock matches attacker. Tests exist to protect this (`slap-grab-followup`, `palm-plus-zero`).
- Palm: `collisionSystem.js` — "+0 like pocket slap."
- Regular slap parry: begin delay + stagger = plant, "+0 after freeze."
- Pull: "The yank IS the lock… settle is +0."
- Drive: test asserts "landing a Drive must not also hand over frame advantage."
- Buffered slap → grab: "the follow-up stays fully contestable."
- Flap slam: "neutral slam is still +0."

The philosophy was fairness: nobody gets a free sequence, the ice does the talking, trades stay glued. Fairness is not the same as sauce. **Fair +0 means a correct play relocates the next coin flip.** The ice changed their X. The conversation did not change speaker.

You can feel this from the couch. A Smash hit says "he's in the air, go get him." A PenguinPow slap says "nice spark, your move."

**The triangle is unreactable and complete.**

Slap / parry / grab with no react window is For Honor's attack / parry / GB with less animation windup. There is no "I saw the grab coming" — there is "I picked slap this time." That does not feel like skill even when it *is* a read, because the body never told a story before the result. Sirlin's yomi is supposed to feel like mind-reading. Unreactable RPS feels like luck with extra steps. Same math, worse poetry.

**Punish windows exist. Punish stories do not.**

Premium Combat Foundation already logged this in mechanical language: "No whiff-punishable limbs despite readable extended recovery art" — and Phase 4 then shipped authored slap/palm limb hurt volumes. So the *geometry* of a punish is closer than it was. The *emotional* punish is still missing, because:

- On-hit does not give you a guaranteed next verb
- The grab you want to cash a whiff into is itself a 85ms startup that they can slap or parry on the same wake-up
- Command grab connect then *removes* the wrestling

A punish the player cannot continue is a notification, not a play.

**Nobody is ever truly safe — and that destroys the feeling of being unsafe.**

This is the paradox you named. If every state can be RPS'd for free, then "unsafe" has no contrast. Smash landing lag feels deadly *because* the rest of the game has places you can stand. Your game is a hot stove with no countertop. The player never gets to say "I caught you in the kitchen."

### The grab game now (the question you asked)

Here is the honest answer from the current command-grab contract.

**You replaced a wrestling conversation with a command-grab cutscene.**

`commandGrabSystem.js` says it in the file header:

> Replaced the mutual clinch subgame (Drive / Plant / Jolt / Throw / Pull / Brace / Open / Deep Grip) with three discrete outcomes chosen at input time.

After connect:

- No Grab Break
- No Brace
- No Open
- "Uninterruptible"
- CPU comment: "there is nothing to decide after a grab connects"

Variant is chosen **before** the grab goes active (`commandGrabInput.js`: M2 = Drive, M2+W = Throw, M2+Back = Pull). Then a tell plays so the *audience* can read which cinematic they are in. Then Drive carries, Pull yanks +0, Throw arcs. Kill versions are posture-gated at connect. Drive's ring KO is stamina-gated.

That is a clean system. It is also why the grab has no sauce.

Old clinch (still documented in `CLINCH_JOLT_SPEC.md`) had **turns inside the hold**: plant vs push vs jolt, 250ms tell, 400ms recovery, +150ms if you read the plant, −400ms if you jolted into a push. That is yomi. That is sumo. That is "I felt you go stiff so I broke your hips."

New grab is: guess the button in neutral (unreactable), win the triangle, watch a tween.

So when you ask **"what's the grab game now?"** the accurate answer is:

**There isn't one. There is a grab *result*.**

Drive / Pull / Throw is a finish menu. It is a good finish menu. It is not a grab *game*. A grab game is the contested second between "I have you" and "you are gone." You deleted that second on purpose (prediction, honesty, no Open punish state). The netcode got simpler. The sauce left with the Open.

---

## 6. The answer: what *your* sauce is

Not Smash's. Not Street Fighter's. Not "add more attacks until it feels like a real fighter."

### The sentence only this game can say

**I stole your feet. Then I stole your body. Then I stole the ring.**

| Act | Verb | What the player should feel |
|---|---|---|
| 1. Steal their feet | Slap / palm / charged / slide / ice | Their soles left the conversation. They are on *your* weather. |
| 2. Steal their body | Grab as **cash-in**, not as a neutral coin | You have them. The room knows. They are in trouble. |
| 3. Steal the ring | Drive / throw / push-out / kimarite | The sentence ends with a name. |

Right now Act 1 does not grant Act 2. Act 2 skips the hold and jump-cuts to Act 3. The sentence is broken in the middle, which is why the ending — the part you already love — feels lonely.

This is oshi-zumo on ice. It is a hockey hit that becomes a board fight that becomes a goal. It is Nidhogg's "I hit you, now the screen is mine," except the screen is a circle with a death lip. It is Smash's percent fuse without Smash's aerial essay.

**You do not need more ways to attack. You need the ways you have to write the next act.**

### Identity without a roster

Sakurai gives every fighter a one-sentence theme. You have one body. Your themes are playstyles, like real rikishi:

- **Oshi (the slapper):** I write on the ice until you run out of ring or posture. Grab is the dagger I pocket for the parry addict.
- **Yotsu (the grabber):** I survive the slaps to take your belt. The ice is how I close. The dump is the point of my life.
- **The henka rat:** I make you lunge at ghosts and take your back.
- **The edge demon:** I live on the tawara and I am better there than you.

Those four humans should be able to exist in the *same kit* the way Fox and Falco are not required for "camp vs rushdown" to exist in Melee. The kit has to *pay* those identities, not flatten them into a triangle.

### Where the sauce lives in each verb (target feeling, not numbers)

**Attacks.** A pocket slap war can stay +0. That is the tachiai glue; it is one of the only things that already feels like sumo. Everything else that is a *read* or a *convert* must speak a different sentence: counter-hit, slide-slap, edge hit, limb snag, charged plant. The spectator should know which one happened without a banner. You already started this with slide-slap. Finish the family.

**Grabs.** Stop asking grab to be a fair neutral button. **Grab is how you cash the ice.** Three contexts, three feelings:

1. **Raw grab** — the parry call. High risk (you already have 450ms). Should lose to slap (it does). This is the layer-0 "I want this" move Sirlin requires. It *must* be better than a slap when it works, or nobody will ever develop the layers.
2. **Punish grab** — they whiffed, they landed, they empty-parried, they slid past. This grab should be *theirs to lose*, not a second coin flip. This is "I baited you." This is the feeling you said is missing.
3. **Finish grab** — posture gone, gassed, on the line. Drive / Throw / Pull as the last page. Unreactable mixups belong *here*, where they finish a story.

The missing meat is still a **contested hold**. You do not need the old clinch back in full on day one (Plant / Jolt / Brace / Open / Deep Grip was a second video game). You need *one* human moment after connect where the victim is not a passenger and the attacker is not in a cutscene. Even a single break / dump / carry triangle with a tell would put the sport back in the sport. Command-grab Drive/Pull/Throw can stay as the *resolution* of that moment.

**Parry.** This is your "I reacted" verb in a game that is otherwise too fast to react. Regular parry can stay a check. Perfect parry should remain rare and humiliating. Empty parry should remain a crime. If nothing else in the kit is reactable, this one has to *feel* like a hero moment or the player will never believe skill happened.

**Movement.** The ice is not the combo system by itself. The ice is the *paper*. Combos in this game should be sequences of **theft**: slap that puts them on weather → chase → grab the sliding body → dump. If both players are free the instant the spark dies, the paper is blank again.

---

## 7. You leaned into ice. Now what?

Not "add a fifth attack." Not "build a roster to fake Smash sauce." Not "another presentation pass."

### The next lean: cash the ice

Ask this of every successful play:

**When I win a moment on the ice, what do I get to DO with that win?**

Current honest answer: almost nothing. You both become actionable. Maybe they are closer to a line. Then the triangle runs again.

Target answer: you get a **verb they cannot freely RPS out of** — a chase they cannot instantly slap, a grab that is actually yours, a carry they have to break, a dump they have to earn out of. The ice already moved the bodies. **Give the winner the bodies.**

### A compass, not a patch (do not implement from this list blindly)

These are direction tests. If a change does not pass them, it is juice or clutter.

1. **Keep pocket-slap +0.** It is the tachiai. It is the one +0 that has a soul.
2. **Let converts, counters, edge hits, and limb snags pay in turn, not just in pixels.** You already did this once (`SLIDE_SLAP_ADVANTAGE_MS`). That comment is the template. Use it as a family, not a one-off.
3. **Make punish grab a different object than raw grab.** Same button is fine. Different contract after *their* recovery / whiff / empty AP / landing. If a 450ms grab whiff does not become *your* belt, the comment in `grabMechanics.js` is lying to the player.
4. **Put a human second back in the grab.** Not the whole old clinch. One contested beat. The current "nothing to decide after connect" line is the sauce leaving the file.
5. **Keep unreactable mixups for earned finishes.** Drive vs Throw at low posture is a boss death animation with a guess. That can be spicy. The same guess in mid-screen neutral is why the game feels skill-less.
6. **Make one option in the triangle slower or louder on purpose.** Yomi needs a "best move" and a "I see you fishing it." If grab is the belt you want, it can stay fast *and* be the thing people look for — then slap and henka become the counters that *feel* like reads. Right now nothing is the thing you want; everything is the thing you flip.
7. **Name the thefts.** Kimarite already names the KO. Call out the play that *created* the KO: convert, henka, matador break, posture snap, rope steal. Smash does this with the picture. You can do it with the picture *and* the word. You already have EXPOSED / MATADOR BREAK / DEMOLISHED energy.
8. **Do not add a Smash-sized kit to chase Smash's feeling.** Sakurai's depth is situational, not combinatorial. Your situations are: pocket, slide, edge, air, hold, gassed. Make those six places play like six different games that share a penguin.

### What "done" feels like (playtest, not metrics)

You will know the sauce is back when a stranger can watch a round on mute and retell it:

> "He kept slapping him toward the line, the other guy went for the belt, ate the slap, started sliding, and then he took him and dumped him."

That is a story. It has a bait, a punish, a cash-in, and a nameable finish.

You will know it is still missing when the recap is:

> "They slapped a bunch, then someone grabbed, then it was over. I don't know why."

That is your current recap. It is not a content problem. It is a sentence-structure problem.

---

## 8. Sources (the deep dive, condensed)

**Juice / feel**

- Steve Swink, *Game Feel* — feel is kinesthetic control of a virtual body, not polish.
- Jan Willem Nijman (Vlambeer), "The Art of Screenshake" / "Secrets of Game Feel and Juice" — juice doubles down on the fundamental action; it cannot invent one.
- Hicks, Gerling, Dickinson, Vanden Abeele, *Good Game Feel: An Empirically Grounded Framework for Juicy Design* — juiciness is abundant feedback *in context*; mastery and control have to be real or the feedback is empty calories.
- Sense Central / Solana Garden syntheses of the same tradition: anticipation → contact → follow-through. You already built the contact chapter. Follow-through is the missing chapter.

**Yomi / interesting decisions**

- David Sirlin, *Playing to Win*, "Spies of the Mind" (Yomi Layers 0–3) — unequal risk/reward is load-bearing; layer 4 wraps to 0.
- Sirlin, "Balancing Multiplayer Games, Part 2: Viable Options" — double-blind guessing keeps third-best moves alive; remove it and the game solves.
- Sid Meier — interesting decisions require unequal payoffs.

**Smash**

- Masahiro Sakurai, Famitsu columns (esp. vol. 480, "The Act of Balancing") and later interviews — party/intermediate target; simple inputs ≠ easy game; stripping options kills comebacks; he will take "worse" tournament pacing to keep smash attacks fun.
- Dabuz, Ultimate sauce polls + 2020 "well-designed" list — sauce is fun to watch + "your time to fight" after you beat someone's pressure.
- Community writing on footsies / mixups (HitHix, Esportsheaven Dabuz deliberations) — surprise, pacing, and punish as spectator joy.

**The RPS trap**

- Wesley Rockholz, "Rock, Paper, Guard Breaks" (*Gamasutra* / Game Developer, 2017) — For Honor's triangle, guessing vs dice, turtle meta.
- Years of For Honor player language: 400ms lights as "unreactable," "it's just RPS" as a complaint, not a compliment.

**Sumo**

- Tachiai as the bout's real opening (the-sumo.com, Wikipedia *tachi-ai*, Sumo Fan Magazine Issue 21).
- Oshi/tsuki vs yotsu, kimarite catalogue, henka-as-legal-sin (tachiai.org kimarite essays).
- The tawara as theater: the sport is stolen balance, named at the end.

**Small-kit cousins worth stealing from *structurally***

- Nidhogg — hit grants the map.
- Lethal League / Windjammers — you create a problem, they solve it.
- Divekick — two buttons, all sauce is timing and space.
- ARMS — punch commits, grab punishes, dash rewrites space.
- Real sumo — two bodies, one ring, a belt or a slap.

---

## 9. Closing

You asked what the real sauce of your game is.

It is not the penguin. It is not the particle. It is not "more attacks like Smash." It is not even the ice, alone.

**It is the theft.**

Feet, then body, then ring. Ice is the weather that makes the thefts huge. The win condition is the courtroom. The grab is supposed to be the handcuffs. Right now the weather is beautiful, the courtroom is real, and the handcuffs turn into a cutscene after a coin flip.

You do not need a new game. You need to stop resetting the speaker every time someone says something true.
