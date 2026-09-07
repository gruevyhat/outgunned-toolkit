# Outgunned Toolkit — Combat Manager and NPC Generator

Design for two additions to the toolkit described in `PLAN.md`: an **NPC generator** (enemies and allies) and a **combat manager** that runs a fight between a crew of Heroes and one or more enemy stat blocks. Written to the same conventions as `PLAN.md` so that tasks can be handed to coding agents, several in parallel (§8).

Revision 1 (2026-09-06). Status: proposal; picks up the "M5+ backlog" line of `PLAN.md` §8 as milestones M6–M8.

Page numbers are **PDF page indices** of `books/core/Outgunned_Corebook_ENG.pdf`, matching the `pageRef` convention already used in `app/data` (printed page = index − 2). Other sources are named explicitly: *AD* = `books/core/extras/OG_Assistent_Director_ENG_1_0.pdf`, *WoK* = `books/world-of-killers/OG_WoK_ENG.pdf`.

---

## 0. Ground rules

All of `PLAN.md` §0 applies. In addition:

1. **The markdown conversion drops the enemy Grit tracks.** Pages 132, 134, 136, 150 and 151 render the Grit boxes and Hot Boxes as glyphs that `pdftotext` and the `.md` files lose entirely. Transcribe them from a rendered page (`pdftoppm -f N -l N -r 220 -png`) and record the check in `docs/NOTES.md`. The values verified for this document are in §2.1.
2. **Automate the mechanical, prompt for the narrative.** The engine applies every effect that is pure arithmetic on tracked state (Grit, Adrenaline, Conditions, modifiers, turn skips). Anything that needs a Director's judgement (which Condition on a Bad Box, which enemy answers a Call for Backup, how a Weak Spot plays out) becomes a *prompt* the UI must resolve before play continues. Nothing is silently decided.
3. **The table rolls real dice.** Every roll in the combat manager accepts either dice faces typed in, a success summary ("Critical + Basic"), or an in-app roll. The engine never assumes it made the roll.
4. **Heroes stay the source of truth.** The combat manager works on copies of Hero objects and writes changed resources back only on an explicit "apply to crew" action, through the same `resources`/`conditions` fields the working Hero Sheet already edits.
5. **One reducer, no hidden state.** `combat.js` is a pure `(state, event, rng) → state` function. Undo is a history of states; share and resume are `JSON.stringify(state)`.
6. **Effect vocabulary is closed.** Enemy Feats and Special Actions are data records whose `effect.kind` comes from the list in §2.9. The integrity test fails if a record uses a kind the engine does not implement, so a transcription can never look automated when it is not.

---

## 1. What the tools do

### 1.1 Rules digest

The combat rules the engine encodes, one line each, with the page that fixes the value. Implementers verify against the PDF, not this table.

| Rule | Value | Page |
|---|---|---|
| Difficulty levels | Basic 2-of-a-kind, Critical 3, Extreme 4, Impossible 5, Jackpot 6+ | 64, 68 |
| Double difficulty | 2 Basic / 2 Critical / 2 Extreme; never 2 Impossible; one roll, two successes needed; one scored success avoids one consequence | 66 |
| Pool | Attribute + Skill ± modifiers, clamped to 2..9 | 63 |
| Combining | 3 smaller successes = 1 greater; 1 greater = 3 smaller | 69 |
| Re-roll | needs ≥1 success; re-roll the dice not in a combination; "better" = an extra success or an upgraded one; otherwise lose one success of your choice | 70 |
| Free Re-roll | never loses a success; allowed with zero successes | 70 |
| All In | only after a better Re-roll; better again or lose every success | 71 |
| Extra successes | extra Basic = Quick Action, Critical = Full Action, Extreme = Cool Action; any extra success can be given to a friend who failed the same roll | 74–75 |
| Help | +1, or automatic success, or a requisite to roll; default +1 | 75 |
| Adrenaline | max 6; 1 = +1 die or activate a Feat; 6 = a Spotlight; +2 when the Hot Box (12th Grit box) fills | 76, 85 |
| Spotlight | max 3; automatic Extreme Success, save a friend at the Death Roulette (+1 Lethal Bullet for them), remove any Condition, save a Ride, anything agreed; coin flip after use: tails keeps it (or gives it to the saved friend); no flip in a Showdown | 77, 169 |
| Dangerous Roll failure | lose Basic 1 / Critical 3 / Extreme 9 / Impossible all Grit | 83 |
| Damage Control | each Basic scored avoids 1 Grit, each Critical 3; none on Impossible rolls | 84 |
| Grit boxes | 12; 8th = Bad Box (a Condition), 12th = Hot Box (+2 Adrenaline); a loss ≥ open boxes fills all; a further loss at zero = Death Roulette | 84–85 |
| Recover Grit | sleep, Catch a Break, end of Shot: all Grit | 85 |
| Gamble | after all re-rolls, every 1 showing costs 1 Grit; "go all out" = +1 and a Gamble | 88–89 |
| Conditions | Hurt/Nervous/Like a Fool/Distracted/Scared = −1 on that Attribute; Tired no penalty; a 4th Condition = Broken (−1 to all) and no more Conditions | 90, 94 |
| Death Roulette | d6 > Lethal Bullets survives and adds a bullet; else Left for Dead unless a friend spends a Spotlight | 96 |
| Turn loop | Action Turn (free Quick Action + Action Roll per Hero) alternates with Reaction Turn (every Hero reacts against enemy Attack); Heroes attacking first or surprising start on an Action Turn, ambushed Heroes on a Reaction Turn, coin when in doubt | 116–119 |
| Attack | difficulty = enemy Defense; 1 Grit per success at that level, a higher success is worth 3 | 117 |
| Reaction | difficulty = enemy Attack; all Reaction Rolls in combat are Dangerous; Heroes out of the enemy's range may auto-pass | 118 |
| Extra reactions | an extra success ≥ Defense counters for 1 Grit (repeatable); an extra success ≥ Attack protects a friend who failed; no Damage Control on a friend's behalf | 119 |
| Brawl | Action Rolls only, vs enemy Attack; match = a blow landed, else lose Grit; vs double Attack one success trades blows (deal 1, take the failed consequence) | 122–123 |
| Range | Melee ≤2 m, Close 2–10 (Quick Action to reach), Medium 10–50 (one turn), Long 50–300 (2–3 turns), Out of Range; guns' range modifiers in `gear.json` | 124, 105 |
| Cover | Partial +1 Reaction / −1 Action (Quick Action to reach); Total auto-success Reaction / −3 Action (full turn to reach, Quick Action to leave) | 125 |
| Carefree Bullets | ignore range: one-handed guns +0, two-handed +1, gun Feats still apply | 125 |
| Mags | never spent by shooting; lose one on a failed shooting roll, Full Auto (+1), Covering Fire (friends +1 next Reaction, your whole turn), or bad luck; Quick Action to reload; Akimbo = twice the mags, no bonus | 126–127 |
| Danger to others | shooting into a Melee that contains friends is a Gamble at their expense: each 1 = 1 Grit to each friend in Melee | 127 |
| Enemy sheet | Grit boxes, Attack, Defense; one Enemy record may be any number of opponents | 128–129 |
| Enemy types | Goons (1 Feat Point), Bad Guys (3), Bosses (5); five Templates each, ordered by difficulty | 130–131, 138 |
| Cannon Fodder | 9 Grit, 2 Basic Attack, Basic Defense, no Feats; "spicy" = Critical/Critical | 131 |
| Hot Boxes (enemy) | filling one gives the Director 1 Adrenaline for Special Actions (cost 1/2/3); unused Adrenaline is lost when combat ends, except an enemy whose *last* box is a Hot Box may still spend after defeat | 139, 144 |
| Weak Spot | Focus+Detect at Defense (or Intuition + 1 Adrenaline); d6 chooses the table, d6 the row; one per enemy; each Hero who knows it may exploit it once | 148–149 |
| Villain | −1 to all rolls against the Villain outside a Showdown; cannot lose before the Showdown; no Spotlight against them before the Showdown; a Right Hand is a Boss or a high-Template Bad Guy and can only be defeated in a Turning Point or Showdown | 177 |
| Supporting Character | Name, Help, Flaw; 3 Grit lost 1 at a time; 5 Attributes at 3 + 1–6 extra points, each 3..5; may be sacrificed for a Spotlight's effect and is then Left for Dead; recovers 1 Grit per Break or Time-Out | 178–180 |
| Heat | starts at the number of Heroes; 6 = +1 Lethal Bullet each; 9 = every enemy +1 Feat Point; 12 = +1 Adrenaline and +1 Lethal Bullet each; locked at the Showdown | 183 |
| Solo variants | enemies never have double difficulty; Special Actions fire as soon as a Hot Box fills (1st Hot Box a 1-cost action, 2nd a 2-cost, …); Goons before the Turning Point, Bad Guys after, Bosses at the Showdown | AD 53 |

### 1.2 NPC generator

**Enemies.** Pick, or let the tool pick, a Type and Template; spend the Feat Points on Enemy Feats; attach a short list of Special Actions when the Template has Hot Boxes; give it a name and a one-line description. "Thematically appropriate" means every choice is filtered by a **theme** (§2.6): a squad tagged `military` gets Automatic Weapons, Tactics and Grenade, never Sharp Blades and Grab and Throw. Themes come from an explicit pick, from the campaign's Villain (Strong Spots map to themes, §2.6), or from a roll on the booklet's Thematic Oracles.

Inputs the generator understands: `type`, `template`, `theme`, `phase` (Establishing / Shot / Turning Point / Showdown, which weights Type per AD 53), `heat` (≥ 9 adds a Feat Point), `solo` (never double difficulty), and `pins` for every field so that ↻ on one field never disturbs the others, exactly like `hero.js`.

Ready-made: the 10 Corebook *On Demand Enemies* (pp. 150–151), the 10 *World of Killers* ones (WoK pp. 92–93) when that pack is on, and Cannon Fodder in both flavours.

Special cases: **Right Hand** (Boss, or Bad Guys Template 4–5, themed from the Villain, flagged so the combat manager applies the Villain rules); **the Villain as an enemy** when they have the *Extraordinary individual* Strong Spot (Boss).

**Allies (Supporting Characters).** Name from `names.json`; Help and Flaw from the booklet's d66 tables already in `mission_tables.json`; 3 Grit; Attributes at 3 plus 1–6 extra points placed by weights keyed to the Help (§2.7). A campaign's rolled allies (`campaign.allies[]`) can be *promoted* into full cards with one click.

Output: an on-screen card, Markdown in the same portable style as `heroMarkdown.js`, a share link, and "add to the bench" (a roster the combat manager draws from).

### 1.3 Combat manager

Setup: choose Heroes (the crew, share links, or Markdown imports), one or more enemies (bench, on-demand list, Cannon Fodder, or a fresh roll from the generator), any allies, the scene options (Combat or Brawl, phase, Heat, range rules, solo variants) and who opens.

Loop: the manager announces the turn, lists what each Hero must roll (attack vs Defense; reaction vs Attack with a suggested Attribute+Skill from the p. 118 table), computes the modifier stack for each roll from tracked state, takes the dice, offers Re-roll / Free Re-roll / All In, lets the player spend extra successes (damage, counter, protect a friend, Quick/Full/Cool action, Damage Control), then applies the outcome: enemy Grit and Hot Boxes, Director Adrenaline, Hero Grit with Bad Box and Hot Box triggers, Gamble losses, Conditions, Death Roulette prompts. Between turns the Director sees which Special Actions are affordable and triggers one with a click; the manager runs the Hero reaction it calls for and applies its effect.

Everything is logged. Combat ends when every engaged enemy is defeated, every Hero is at zero Grit, or the Director ends it; the summary shows each Hero's changed resources and applies them to the crew on request.

Out of scope for these milestones: chases (pp. 152–163), Superheroes Power and Assemble actions, Adventure supernatural enemies, Action Flicks Qi. §9 lists them as backlog with the hooks left for them.

---

## 2. Data contracts

Same envelope as `PLAN.md` §4: `_meta.source`, `_meta.transcribed`, lowercase snake-case ids, `pageRef` on every record, `status: "pending"` on anything unverifiable. Verified by `tests/data/integrity.test.js` extensions listed per file.

### 2.1 `enemy_templates.json`

```json
{ "templates": { "bad_guys_2": {
  "name": "Bad Guys – Template 2", "type": "bad_guys", "template": 2, "pageRef": 134,
  "grit": 9, "hotBoxes": [3, 7],
  "attack": { "level": "critical", "count": 1 }, "defense": { "level": "critical", "count": 1 },
  "featPoints": 3,
  "examples": "soldiers, burly batterers, a lone commando" } },
  "special": { "cannon_fodder": { "name": "Cannon Fodder", "pageRef": 131, "grit": 9, "hotBoxes": [],
     "attack": { "level": "basic", "count": 2 }, "defense": { "level": "basic", "count": 1 }, "featPoints": 0 },
   "cannon_fodder_spicy": { "…": "critical / critical, otherwise identical" } } }
```

`level` ∈ `basic | critical | extreme`; `count` ∈ `1 | 2`. `hotBoxes` are 1-based positions. `examples` is a short paraphrase (§10), not the book's line.

Values verified from rendered pages 132, 134, 136 and cross-checked against the On Demand sheets on 150–151 (which repeat the Template tracks):

| Template | Grit | Hot Boxes | Attack | Defense |
|---|---|---|---|---|
| Goons 1 | 6 | — | Basic | Basic |
| Goons 2 | 6 | — | 2 Basic | Basic |
| Goons 3 | 9 | — | 2 Basic | Basic |
| Goons 4 | 9 | — | Critical | Basic |
| Goons 5 | 12 | — | Critical | Basic |
| Bad Guys 1 | 6 | 3 | Critical | Critical |
| Bad Guys 2 | 9 | 3, 7 | Critical | Critical |
| Bad Guys 3 | 6 | 2, 4 | 2 Critical | Critical |
| Bad Guys 4 | 9 | 4, 8 | 2 Critical | Critical |
| Bad Guys 5 | 12 | 3, 6, 9 | 2 Critical | Critical |
| Boss 1 | 6 | 1, 3, 5 | Extreme | Critical |
| Boss 2 | 9 | 2, 5, 8 | Extreme | Critical |
| Boss 3 | 12 | 3, 6, 9 | Extreme | Critical |
| Boss 4 | 3 | 1, 2, 3 | Extreme | Extreme |
| Boss 5 | 6 | 2, 4, 6 | Extreme | Extreme |

Tests: 15 templates + 2 specials; Goons have no Hot Boxes; Hot Box positions strictly increasing and ≤ `grit`; Feat Points 1/3/5 by type; Templates ordered so that no Bad Guy is weaker than any Goon on (attack, defense) — a sanity check of p. 131's ordering statement, not a rule.

### 2.2 `enemy_feats.json`

```json
{ "feats": { "automatic_weapons": {
  "name": "Automatic Weapons", "cost": 1, "pageRef": 140, "source": "Outgunned Corebook ENG",
  "summary": "Heroes who react without at least a Basic Success become Nervous; if already Nervous they lose 1 more Grit.",
  "effect": { "kind": "reaction_fail_condition", "condition": "Nervous" },
  "themes": ["military", "crime", "law", "spy"] } } }
```

Corebook set (pp. 140–143), 20 records: 1 point — Automatic Weapons, Bulletproof Vests, Fighters, Heavy-handed, Mob, Sharp Blades, Tactics, Walking Hazard; 2 points — Armored, Hard to Kill, Martial Arts, Medkit, One Step Ahead, Piercing Bullets, Relentless, Shotguns; 3 points — Explosive Weapons, Flamethrower, Rage, Titan. *World of Killers* adds (pp. 88–89) Thermal Imagers, Troublemakers (1), Incendiary Bullets, Samurai (2), Poisoned Weapons, Grapplers (3) under `source: "World of Killers ENG"` in `packs/`.

Tests: costs ∈ {1,2,3}; every `effect.kind` in §2.9; every theme in `npc_themes.json`; every feat carries at least one theme or `"any"`.

### 2.3 `enemy_special_actions.json`

```json
{ "actions": { "grab_and_throw": {
  "name": "Grab and Throw", "cost": 1, "pageRef": 144,
  "trigger": "after_hero_hit",
  "summary": "After a Hero attacks, a Critical Reaction Roll in Brawn+Endure or they are prone (−1 to all rolls until a Quick Action).",
  "roll": { "attribute": "brawn", "skill": "endure", "difficulty": "critical", "who": "target" },
  "effect": { "kind": "on_fail_flag", "flag": "prone" },
  "themes": ["martial", "street", "animal"] } } }
```

`trigger` ∈ `any | after_hero_hit | after_hero_attack | reaction_turn | hero_spends_adrenaline | hero_spends_spotlight | on_defeat`. `roll.who` ∈ `target | all_engaged`. Corebook set (pp. 144–147), 20 records: 1 Adrenaline — Counter, Disarm, Flashbang!, Foul Play, Grab and Throw, I Don't Think So!, Pile On, Tackle; 2 — Call for Backup, Chaos, Clamp Down, Grenade, Parry, Surround, Threats, Weak Spot; 3 — Final Move, Infamy, Secret Weapon, To the End. *WoK* pp. 90–91 adds Smoke Bombs, Stand in the Way (1), Pincer Maneuver, Poisoned Strike (2), Combat Drugs, You're Coming with Me (3).

Tests: costs ∈ {1,2,3}; triggers and kinds from the closed lists; `roll` present iff the summary names a Reaction Roll.

### 2.4 `enemies_on_demand.json`

```json
{ "enemies": { "commando_team": { "name": "Commando Team", "template": "bad_guys_2", "pageRef": 150,
  "feats": ["tactics", "armored"], "specialActions": ["flashbang", "grenade", "tackle"], "themes": ["military"] } } }
```

10 Corebook records (pp. 150–151); 10 WoK records (pp. 92–93) in `packs/`, including *Secret Weapon (Flamethrower)* as `{ "id": "secret_weapon", "choice": "flamethrower" }`. Tests: every template, feat and action id resolves; feat costs sum to the template's Feat Points or less (the book's presets never exceed them — if one does, mark `status: "pending"` and record it in NOTES rather than "fix" the data).

### 2.5 `mission_tables.json` additions

- `enemy_reactions` — d6, `pageRef` 118 (AD 53 repeats it): columns `prompt, attribute, skill`. Rows: 1 fists and bars → brawn/fight; 2 shooting → brawn/stunt; 3 crush or choke → brawn/endure; 4 push to the ground → brawn/force; 5 thrown furniture → nerves/stealth; 6 surround → nerves/awareness.
- `enemy_weak_spots` already exists (p. 149, `d6x2`); the combat manager reuses `rollTable`.

### 2.6 `npc_themes.json` — original content

The theme vocabulary is the toolkit's own; it never encodes a rule value.

```json
{ "themes": { "military": {
  "name": "Military", "blurb": "Soldiers, commandos, mercenaries, private armies.",
  "groupNouns": ["Squad", "Strike Team", "Mercenaries", "Private Army", "Patrol"],
  "adjectives": ["Black-ops", "Veteran", "Hired", "Rogue", "Elite"],
  "descriptors": ["in matching fatigues", "with suppressed rifles", "moving in perfect formation"],
  "preferredTypes": { "goons": 0.5, "bad_guys": 2, "boss": 1.5 } } },
  "villainStrongSpots": { "Law enforcement": ["law"], "Organized crime": ["crime", "street"], "Untouchable": ["law", "spy"],
     "Extraordinary individual": ["martial", "boss_solo"], "Unlimited funding": ["military", "spy"],
     "Secret organization": ["spy", "martial"], "Cutting-edge tech": ["tech", "vehicle"], "Leverage on the Heroes": ["crime", "spy"] } }
```

Initial theme set: `street` (thugs, hooligans, bikers, mobs), `law` (cops, agents, feds), `crime` (mob, yakuza, cartel), `military`, `spy` (assassins, secret organisations), `martial` (ninjas, dojos, duellists), `animal` (dogs, bears, packs), `vehicle` (armoured cars, gunships), `tech` (drones, private security with gadgets), `boss_solo` (a single extraordinary opponent). Every Enemy Feat and Special Action carries `themes`; `"any"` is allowed for neutral entries (Counter, Parry, Hard to Kill). Names are built as `{adjective} {groupNoun}` or a themed proper name; descriptors decorate the card.

Tests: every theme referenced by a feat, action or Strong Spot exists; each theme has ≥ 3 group nouns and adjectives; for each theme and Type there are enough tagged feats to spend the Feat Points (so the generator never falls back to off-theme picks silently — when it must, it records `offTheme: true` on the pick).

### 2.7 `supporting_characters.json` — original content

Attribute weights per Help entry of the booklet's `help` table (AD 17), used to place the 1–6 extra points, plus a generic fallback:

```json
{ "helpWeights": { "Boxer": { "brawn": 3, "nerves": 1 }, "Cop": { "nerves": 2, "focus": 1, "crime": 1 },
                   "Hacker": { "focus": 3 }, "_default": { "brawn": 1, "nerves": 1, "smooth": 1, "focus": 1, "crime": 1 } },
  "flavour": { "Boxer": ["cauliflower ears", "still wears the belt"] } }
```

Tests: every `help` row has weights or falls to `_default`; weights only name the five Attribute ids.

### 2.8 Additions to existing files

- `feats.json`: optional `combat` hook on the core Feats the manager can act on, e.g. `"combat": { "freeReroll": { "weapon": "pistol" } }` (Gunslinger), `{ "freeReroll": { "unarmed": true }, "negates": "martial_arts" }` (Martial Arts), `{ "badBox": "no_condition" }` (Too Young to Die), `{ "badBox": "adrenaline_plus_one" }` (Hard to Kill), `{ "afterHit": { "adrenaline": 1, "grit": 1 } }` (Combo), `{ "reaction": { "attribute": "brawn", "skill": "fight" } }` (Counter), `{ "rangeBonus": ["close", "medium"] }` (Flying Kick), `{ "oncePerCombat": "punch_reload" }`, `{ "weakSpot": "adrenaline" }` (Intuition), `{ "fullTurn": "get_down" }`. Supplement Feats stay hook-less and are shown as text reminders.
- `gear.json`: `hands: 1 | 2` on guns for the Carefree Bullets rule (p. 125 gives the rule, not the list; mark each gun's value `pending` unless the book states it, and let the UI ask).

### 2.9 Effect vocabulary (closed list)

Enemy Feats: `attack_modifier` (`filter`: `ranged | melee | unarmed | all | close_range`, `value`), `reaction_modifier`, `reaction_fail_condition` (`condition`, `else_grit: 1`), `extra_grit_on_loss` (Mob), `attack_is_dangerous` (Walking Hazard), `damage_stops_at_hot_box` (Hard to Kill), `revive_once` (Medkit), `no_weak_spot` (One Step Ahead), `ignore_cover_bonus` (Piercing Bullets), `ignore_covering_fire` (Relentless), `melee_end_of_turn_penalty` (Shotguns), `reactions_are_gambles` (Explosive Weapons; WoK Incendiary Bullets combines it with `ignore_cover_bonus`), `reaction_fail_skip_turn` (Flamethrower, `threshold: critical`), `start_adrenaline` (Rage), `max_grit_per_attack` (Titan), `reposition_coin_flip` (Tactics), `move_requires_roll` (Grapplers), `dark_penalty` (Thermal Imagers, reminder only).

Special Actions: `counter_same_grit`, `on_fail_lose_weapon`, `on_fail_condition_and_penalty`, `on_fail_skip_action`, `on_fail_flag` (`prone | trapped | surrounded`), `cancel_adrenaline_feat`, `pile_on`, `on_fail_next_roll_penalty`, `swap_enemy`, `flag_no_adrenaline_bonus` (Chaos), `group_reaction` (Grenade: Extreme, Brawn+Stunt, Impossible bounces and defeats), `ignore_grit_this_hit` (Parry), `quick_action_costs_grit` (Surround), `on_fail_lose_adrenaline_or_scared` (Threats), `next_reaction_penalty` (Weak Spot, −2), `on_fail_broken` (Final Move), `flag_infamy`, `gain_feat` (Secret Weapon), `heal_and_stop_adrenaline` (To the End, 2), plus WoK `blind_until_end`, `block_non_attack_action`, `pincer`, `on_fail_two_conditions`, `combat_drugs`, `on_defeat_death_roulette`.

Tests: the engine exports `EFFECT_KINDS`; integrity asserts every data record's kind is in it, and a unit test per kind asserts a state change.

---

## 3. Engine contracts

Pure JS, `rng` first on every randomised function, no DOM. New modules alongside the existing ones in `app/src/engine/`.

### 3.1 `rolls.js` — extends `actionRoll.js`

```js
successes(dice)                            // [{face, count, level}] sorted high→low  (p. 68)
units(successes)                           // Basic-equivalents: Basic 1, Critical 3, Extreme 9, Impossible 27
passes(successes, difficulty)              // {level, count}; units ≥ count × 3^(level−2)   (p. 66, 69)
freeDice(dice, successes)                  // the dice not in a combination
reroll(rng, roll, {free=false, drop=null}) // keeps combination dice, re-rolls the rest; better ⇔ more dice in combinations;
                                           // not better and !free → remove the `drop` combination (default: the smallest)   (p. 70)
allIn(rng, roll)                           // better or lose everything   (p. 71)
snakeEyes(dice)                            // count of 1s after the final roll   (p. 89)
dangerousLoss(difficulty, successes)       // 3^(level−2)×count − units(spent on Damage Control), floor 0; Impossible = 'all'   (p. 83–84)
damageDealt(successes, defense, {cap})     // floor(units / 3^(defense.level−2)), honouring Titan   (p. 117)
spend(successes, plan)                     // validates a spending plan; returns the ledger and leftovers   (p. 74–75, 119)
successProbability(pool, difficulty, {combine:true, reroll:false})   // exact single roll (existing enumerator); Monte Carlo when reroll
```

`rollAction` in `actionRoll.js` stays for the Hero Sheet dice roller; `rolls.js` is the superset used by combat.

### 3.2 `enemy.js`

```js
makeEnemy(data, {templateId | onDemandId, name, feats, specialActions, isVillain, isRightHand, heat})
                                           // → enemy object (§3.4), Rage pre-loads Adrenaline, Heat ≥ 9 adds a Feat Point
featBudget(enemy, heat)                    // {points, spent, remaining}
loseGrit(enemy, amount, {hardToKill})      // → {enemy, hotBoxesFilled, defeated, revived}
validateEnemy(enemy, data)                 // budget, hot boxes, ids, Goons-have-no-actions
```

### 3.3 `npc.js`

```js
generateEnemy(rng, data, {type, template, theme, phase, heat, solo, pins={}})   // → enemy + generation record {theme, offTheme[]}
generateAlly(rng, data, {help, flaw, extraPoints, pins={}})                      // → supporting character
promoteAlly(rng, data, campaignAlly)                                               // wraps generateAlly with help/flaw pinned
generateRightHand(rng, data, campaign, {heat})                                    // Boss or Bad Guys 4–5, theme from Strong Spots
villainAsEnemy(rng, data, campaign)                                               // Boss when 'Extraordinary individual' is a Strong Spot
themeForVillain(campaign, themes)                                                  // Strong Spots → weighted theme choice
```

Selection: Type by `phase` weights (AD 53) unless pinned; Template uniform unless pinned; Feats by a knapsack over on-theme feats that spends the budget exactly when possible, otherwise as much as possible; 1–4 Special Actions, at least one per cost tier the Template's Hot Boxes can fund; name from the theme grammar; `solo` collapses `count: 2` to 1. **Reroll is `generateEnemy` with pins minus the field**, so the record can never go stale.

Supporting character object:

```js
{ meta:{version:1, seed}, name, help, flaw, grit:3, gritLost:0,
  attributes:{brawn:3, nerves:4, smooth:3, focus:5, crime:3}, extraPoints:5, flavour:[], leftForDead:false }
```

### 3.4 `combat.js` — the reducer

```js
startCombat(rng, data, {heroes, enemies, allies, scene, opener:'action'|'reaction'|'coin'})  // → state
reduce(state, event, rng, data)            // pure; throws RuleError on an illegal event
pendingPrompts(state)                      // what the UI must resolve before END_TURN is legal
rollContext(state, heroId, intent)         // {difficulty, attribute, skill, modifiers:[{source,value}], pool, gamble, freeRerolls:[featIds]}
applyToHeroes(state)                       // → [{heroId, resources, conditions}] for write-back
```

State:

```js
{ meta:{version:1, seed, createdAt},
  scene:{ mode:'combat'|'brawl', phase:'establishing'|'shot'|'turning_point'|'showdown', heat, rangeRules:'carefree'|'full', solo:false },
  turn:{ kind:'action'|'reaction', number:1 },
  heroes:[{ id, name, attributes, skills, feats, gear, gritUsed, conditions, adrenaline, spotlight, lethalBullets,
            engaged: enemyId|null, range:'melee'|'close'|'medium'|'long'|'out', cover:'none'|'partial'|'total',
            flags:{ prone, trapped, surrounded, skipNextAction, nextRollModifier, nextReactionModifier, coveringFireBonus, punchReloadUsed },
            leftForDead:false, current: null | { intent, dice, successes, history:[…], plan } }],
  allies:[ supportingCharacter… ],
  enemies:[{ id, name, templateId, type, template, attack, defense, grit:[{filled, hot}], feats, specialActions,
             weakSpot:null|{roll, text, knownBy:[], exploitedBy:[]}, flags:{ medkitUsed, toTheEnd, parryThisTurn, defeated },
             isVillain, isRightHand }],
  director:{ adrenaline, chaos:false, infamy:false, noMoreAdrenaline:false },
  log:[{ turn, kind, text, delta }] }
```

Events (the `type` field): `DECLARE` (intent: `attack | other | find_weak_spot | help | covering_fire | full_auto | reach_cover | get_down | exploit_weak_spot | pass`, target, attribute, skill, weaponId, extras: `{adrenaline, gamble, help}`), `ROLL` (`dice` optional; a `summary` such as `"critical+basic"` is accepted and expanded to representative faces), `REROLL`, `ALL_IN`, `SPEND` (plan), `RESOLVE`, `REACTION` (enemyId, `roll` or `'random'`; per-Hero override allowed, p. 118 "Different Reactions"), `SPECIAL_ACTION` (enemyId, actionId, targets), `PROMPT_ANSWER` (id, value — Bad Box Condition, Death Roulette die, Spotlight use, Call for Backup replacement, Secret Weapon feat), `ADJUST` (any tracked number, logged as a Director override), `END_TURN`, `CATCH_A_BREAK`, `END_COMBAT` (outcome).

Turn rules the reducer enforces: every engaged Hero has resolved (or passed) before `END_TURN`; a Reaction Turn needs a `REACTION` declaration per enemy first; Special Actions are legal only when affordable and their trigger matches; Heroes at zero Grit who fail a Dangerous Roll get a `death_roulette` prompt; a 4th Condition becomes Broken; Adrenaline clamps to 6, Spotlight to 3; `skipNextAction` consumes itself; Hot Box on a Hero grants 2 Adrenaline once per fill; enemy defeat drops Director Adrenaline unless the last box is hot (`director.finalBlow = enemyId` until the next `END_TURN`).

Modifier stack (`rollContext`): Conditions (existing `conditionPenalty`), cover, weapon range or Carefree Bullets, enemy Feats (`attack_modifier`, `reaction_modifier`, Martial Arts unless the Hero has it), Villain −1 outside the Showdown, `nextRollModifier` flags, covering fire, Weak Spot +1, Help +1, Adrenaline +1 per point (blocked under Chaos), Full Auto +1 (costs a mag), "go all out" +1 (turns the roll into a Gamble). Every entry names its source so the UI can show the sum and let the Director strike any line.

### 3.5 Exports and share

- `combatMarkdown(state)` — after-action report: participants, turn-by-turn log, final resources.
- `npcMarkdown(npc, data)` — portable stat block in the `heroMarkdown` style; importable by the bench.
- `share.js`: `#n=` for an NPC, `#f=` for a combat state; decode validates with `validateEnemy` / a `validateCombat` before rendering. Keep the 8 KiB size test; a 5-Hero, 2-enemy state must fit.

---

## 4. UI spec

Two new modes in `App.jsx`: `npc` and `combat`. Menu tiles: **ROLL AN ENEMY** and **START A FIGHT** placed after NEW MISSION. Theme and components as `PLAN.md` §6; usable at 390 px.

**NPC screen.** Tabs *Enemy* / *Ally*. Enemy tab: controls for Type, Template, Theme, Phase, Heat, Solo, then the card — name and descriptor, Type/Template line, Grit track drawn with the `Tracker` component in a new `enemy` variant (Hot Boxes flagged), Attack/Defense, Feat chips with cost and one-line summary, Special Action chips grouped by cost. Every field has ↻ (pins). Buttons: ROLL EVERYTHING, ON DEMAND (picker), CANNON FODDER, COPY MARKDOWN, COPY LINK, ADD TO BENCH. Ally tab: Help, Flaw, extra points, attribute row, Grit 3, same buttons. From the Mission screen: "Roll the Right Hand" and "Promote" on each ally.

**Combat screen.** Three stages.

1. *Setup*: Heroes (checkboxes over the crew; import link/Markdown), enemies (bench + on-demand + Cannon Fodder + "roll one"), allies, scene options, opener. START.
2. *Turn loop*: a banner `ACTION TURN 3` / `REACTION TURN 3`; enemy cards on top (Grit track live, Director Adrenaline, affordable Special Actions highlighted, Weak Spot state); one row per Hero: Grit `Tracker`, Conditions, Adrenaline/Spotlight/Lethal Bullets, engaged toggle, range/cover pickers when `rangeRules: 'full'`, and the ROLL button pre-filled from `rollContext` with the modifier stack expanded. The roll dialog is the existing `DiceRoller` moved to `components/` and extended with faces entry, success summary entry, Re-roll / Free Re-roll (lists which Feat grants it) / All In, a Gamble tally, and the success-spending panel (damage, counter, protect, actions, Damage Control) that shows the resulting Grit changes before CONFIRM. Prompts render as a modal queue; END TURN is disabled until the queue is empty. Undo steps back one state.
3. *Summary*: outcome, log, per-Hero deltas, APPLY TO CREW, COPY REPORT, COPY LINK, NEW FIGHT (same participants, fresh enemy).

Allies appear as compact chips with Grit 3 and a "Help this roll" toggle in the roll dialog (+1, or auto-success / requisite as the Director chooses) and a "Sacrifice for a Spotlight" action.

---

## 5. Rules interpretations

Decisions the engine makes where the book leaves room; each is a named constant or documented branch so it can be changed in one place, and each is listed in `docs/NOTES.md` when implemented.

1. **Units.** Successes are combined and spent as Basic-equivalents (1/3/9/27), so three Basic Successes pass a Critical roll even though the p. 69 table ignores that case (§6). Passing a double difficulty needs twice the level's units; Damage Control against a double difficulty subtracts units from the doubled loss (2 Critical failed with one Critical scored = lose 3; with one Basic = lose 5). Basis: pp. 66, 69, 84.
2. **Better re-roll.** "Additional success or an upgraded success" is implemented as *strictly more dice in combinations* after the re-roll; since kept dice are not re-rolled this is equivalent. Losing "one success" removes one whole combination.
3. **Brawl damage.** Each success at or above the enemy's Attack level deals 1 Grit (a higher level deals 3, by the units rule); failure costs the Attack-level loss minus Damage Control. Basis: the worked example on p. 123.
4. **Special Action reactions are Dangerous.** p. 118 says all Reaction Rolls in combat are Dangerous, so a failed roll called by a Special Action loses Grit *and* suffers the listed effect. Pile On, Chaos, Surround and the other roll-less actions cause no extra Dangerous Roll.
5. **Mob** adds 1 Grit to *any* Grit loss, including Gambles (literal reading of p. 140).
6. **Titan** caps Grit per attack at 1 including Combo's extra point (Combo is "after hitting", the same attack).
7. **Hard to Kill (enemy)** stops overflow at the Hot Box only for the hit that reaches it; later hits proceed normally.
8. **Extra successes given to a friend** must be at the failed roll's difficulty level; the friend's own smaller successes still count as Damage Control if the gift is not enough. Basis: p. 119.
9. **Death Roulette** spins once per failed Dangerous Roll at zero Grit, not once per Grit point. The saving Spotlight belongs to another Hero; a Supporting Character sacrifice counts as a Spotlight here.
10. **Heat ≥ 9** adds a Feat Point at enemy creation; an enemy already in play does not gain one mid-fight unless the Director uses `ADJUST`.
11. **Solo variants** are a scene option, not a hidden rule change: `count: 2` collapses to 1 and Special Actions fire automatically in cost order when Hot Boxes fill.
12. **Out-of-range Heroes** are represented by the engaged toggle; the manager auto-passes their Reaction Roll and says so in the log.

---

## 6. Testing policy

`PLAN.md` §7 applies. Additions:

- **Book probability table (p. 69).** The table counts *natural* n-of-a-kind only: it does not apply the "three smaller = one greater" rule from the same page (checked 2026-09-06: the current enumerator, which does combine, gives 40.6% for 6 dice vs Critical where the book prints 37%, and 100% for 9 dice where it prints 84%). So `successProbability` takes `{combine}`; the test compares `combine: false` against the table to ±0.6 points (the book rounds to whole percents, with a few fractional entries under 5%), and a separate test asserts the combining rule on fixed dice. The re-roll columns are reproduced by simulation of the policy "re-roll whenever the roll has not passed and has at least one success", `combine: false`, over 200,000 trials per cell, to ±1.5 points. This pins the re-roll semantics.
- **Worked-example fixtures.** The grenade scene (pp. 86–87: 2 Basic vs Critical → lose 1), the combat scene (pp. 120–121: Critical vs Basic Defense → 3 Grit; Basic → 1; both pass Basic Attack; extra Basic counters for 1), the Brawl box (p. 123), and the p. 72–73 re-roll failure (Victor loses his only Basic) are replayed through `rolls.js` and `combat.js` with pinned dice.
- **Reducer invariants** (property tests over 500 seeded combats driven by a random legal policy): Grit used ∈ 0..12, enemy filled ≤ grit, Adrenaline ≤ 6, Spotlight ≤ 3, Conditions ≤ 3 or Broken present, Director Adrenaline never negative, every Hot Box fill logged exactly once, every combat terminates within 60 turns or is ended by the policy, `reduce` never mutates its input, `JSON.parse(JSON.stringify(state))` round-trips.
- **Generator fuzz.** 1,000 seeded enemies pass `validateEnemy`, never exceed the Feat budget, never give Goons Special Actions, and record `offTheme` only when the theme pool is exhausted; 1,000 allies keep Attributes in 3..5 with 1–6 extra points; reroll-with-pins leaves every other field byte-identical.
- **Data integrity.** As listed per file in §2; plus a snapshot of §2.1's table, so a re-transcription that changes a Grit track fails loudly.
- **UI smoke.** `renderToString` for both screens in all three combat stages; the modifier stack renders each source; 390 px width check in the browser at Gate M8.

---

## 7. Milestones

Gates as in `PLAN.md` §8. Commit per task as `M<n>.T<m>: <description>` only when asked.

### M6 — Enemy data and the roll engine
| # | Task | DoD |
|---|---|---|
| T6.1 | Transcribe `enemy_templates.json` from rendered pp. 129–137; cross-check against pp. 150–151 | integrity green; render check noted in NOTES |
| T6.2 | Transcribe `enemy_feats.json` (pp. 140–143) with effect kinds and themes | integrity green, 20 records |
| T6.3 | Transcribe `enemy_special_actions.json` (pp. 144–147) | integrity green, 20 records |
| T6.4 | Transcribe `enemies_on_demand.json` (pp. 150–151) and the WoK pack (pp. 88–93) | ids resolve; budgets hold |
| T6.5 | Add `enemy_reactions` to `mission_tables.json` (p. 118) | die-space test green |
| T6.6 | `rolls.js` by TDD: successes, units, re-roll, All In, Gamble, Damage Control, spend | p. 69 table test green |
| T6.7 | `enemy.js` by TDD | green |
| T6.8 | Integrity suite extensions (§2) and `EFFECT_KINDS` export with a placeholder implementation per kind | green |

**Gate M6**: p. 69 reproduction green; five templates, five feats and five actions spot-checked against the PDF and recorded in NOTES.

### M7 — NPC generator
| # | Task | DoD |
|---|---|---|
| T7.1 | Author `npc_themes.json` and `supporting_characters.json` | §2.6–2.7 tests green |
| T7.2 | `npc.js` by TDD with pins; fuzz 1,000 enemies and allies | green |
| T7.3 | `npcMarkdown.js`, `#n=` share, bench store in `App.jsx` (persisted like pack selection) | round-trip green |
| T7.4 | NPC screen (both tabs, ↻ per field, on-demand picker) | smoke green; manual run-through |
| T7.5 | Mission screen hooks: Right Hand, Villain-as-enemy, Promote ally | smoke green |

**Gate M7**: fuzz green; the user reviews 10 rolled enemies and 5 allies for theme coherence; 390 px check.

### M8 — Combat manager
| # | Task | DoD |
|---|---|---|
| T8.1 | `combat.js` reducer by TDD, worked-example fixtures first | fixtures green |
| T8.2 | Implement every effect kind (§2.9) with a unit test each | kind tests green |
| T8.3 | Move `DiceRoller` to `components/`; add faces/summary entry, re-roll controls, spending panel | Hero Sheet unchanged in behaviour; smoke green |
| T8.4 | Combat screen: setup, turn loop, prompt queue, undo, summary | smoke green |
| T8.5 | Write-back to crew; `combatMarkdown`; `#f=` share | round-trip green; 8 KiB test |
| T8.6 | Property tests (§6) over 500 seeded combats | green |
| T8.7 | Browser run-through: 3 Heroes vs Commando Team, Special Actions used, a Death Roulette, apply to crew; then a Brawl | no console errors; screenshots in NOTES |

**Gate M8**: all fixtures and property tests green; the run-through at 390 px; `play/outgunned-tools.html` rebuilt and verified offline.

---

## 8. Parallel work plan

**Lane A — sequential, one author, holds the rule interactions.** T6.6 `rolls.js` → T6.7 `enemy.js` → T8.1 `combat.js` → T8.2 effect kinds → T8.4 Combat screen. The reducer's state and event shapes (§3.4) freeze before Lane C starts.

**Lane B — independent, well-specified, mechanically verified; all at once.**

| Task | Input | Verified by |
|---|---|---|
| T6.1 templates | rendered pp. 129–137, 150–151 | snapshot + integrity |
| T6.2 feats | pp. 140–143, WoK 88–89 | integrity + kind list |
| T6.3 special actions | pp. 144–147, WoK 90–91 | integrity + trigger list |
| T6.4 on-demand | pp. 150–151, WoK 92–93 | id resolution + budgets |
| T6.5 reactions table | p. 118 | die-space |
| T7.1 themes, ally weights | §2.6–2.7 | §2 tests |
| T6.8 integrity extensions | §2 | runs green on stub data |

**Lane C — parallel once contracts exist.** T7.2–T7.5 (after T6.7), T8.3 (any time; touches only the shared roller), T8.5 (after T8.1's state shape), T8.6 (after T8.2).

Each Lane B and C task is handed out with the relevant §2/§3 excerpt, the page numbers, the test file it must turn green, and the instruction to mark anything unverifiable `pending` rather than guess.

---

## 9. Backlog and hooks left for it

- **Chases** (pp. 152–163): Need/Speed track, driver vs passengers, ten chase Special Actions. `combat.js`'s prompt/effect machinery is reusable; the scene gets `mode: 'chase'`.
- **Outgunned Superheroes** (pp. 144–148): free-form Grit 3–15, 6 Feat Points, Power instead of Adrenaline, *Assemble* actions, *One Enemy Each* — the multi-enemy `engaged` field already covers the last. **Adventure** (pp. 106–110, supernatural enemies §6): free-form Grit 3–12, Bad Box on enemies. **Action Flicks**: Qi, supervillains, Predator Aliens (10 Feat Points). Each is a pack file under `packs/` using the §2 shapes; the `attack`/`defense`/`grit`/`hotBoxes` fields are already general enough.
- **Pets and Sidekicks** (WoK; AD 47) as ally variants that never die on their last Grit.
- **Director Sheet PDF** (p. 173) drawn with pdf-lib in the `heroSheet.js` style, filled from the bench and the campaign.
- **Advancement** hooks: Turning Point and Showdown "Heroes Advance" prompts once the Hero object grows an advancement record.

---

## 10. Legal

`PLAN.md` §10 applies unchanged. For these files specifically: `enemy_templates.json`, `enemy_feats.json`, `enemy_special_actions.json` and `enemies_on_demand.json` hold numbers, list membership and one-line paraphrases only; the Templates' example lines and the Feat and Special Action texts are paraphrased, never copied. Themes, name grammars, ally attribute weights and every UI string are original. The Hot Box glyph is drawn by the toolkit's own `Tracker`, not the publisher's art.
