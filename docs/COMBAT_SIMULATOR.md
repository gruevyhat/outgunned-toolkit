# Combat Simulator — implementation and status

Written 2026-09-07. Read `PLAN.md` §0 first: never invent rule values, keep `app/src/engine` pure, `rng` first, `npm test` and `npm run build` from `app/` before handoff, do not commit unless asked.

## Implementation status

The first implementation is complete in the working tree and remains **uncommitted**. It has passed the full 131-test suite and `npm run build`, plus an interactive browser run-through: assembling a crew, generating an Enemy, simulating 500 fights, opening the sample log, and checking the 390 × 844 layout. The browser reported no console warnings or errors, the document stayed at 390 px with no page-level horizontal overflow, and the hero table scrolled inside its own container.

| File | State | What it is |
|---|---|---|
| `app/src/engine/combat.js` | new | The engine: `resolveRoll`, `createFighter`, `createOpponent`, `simulateCombat`, `runSimulations`, `verdictFor`, `combatMarkdown`, plus `RULES`, `REACTION_ROLLS`, `RANGES`, `DEFAULT_OPTIONS` |
| `app/src/ui/screens/CombatSim.jsx` | new | The screen; also exports `CombatReport` for tests |
| `app/tests/engine/combat.test.js` | new | 25 engine tests (scripted dice, fuzz, determinism, ranking) |
| `app/tests/ui/combat.test.jsx` | new | 4 render tests |
| `app/src/ui/App.jsx` | modified | `mode === 'combat'` route; passes the shared `crew` and `setCrew` |
| `app/src/ui/screens/Menu.jsx` | modified | "Combat Simulator" tile after NPC Generator |
| `app/src/ui/screens/Crew.jsx` | modified | New `onChange` prop so the app shell sees crew edits |
| `app/src/ui/screens/NpcGenerator.jsx` | modified | `EnemyCard` exported; reroll button optional |
| `app/src/ui/app.css` | modified | `.combat-*` styles appended at the end |
| `app/tests/ui/screens.test.jsx` | modified | Smoke render of the new screen |
| `docs/NOTES.md` | modified | Summary of the rulings, duplicated in §4 below |

### Possible follow-up work

1. **Review the interpretations in §4** if a higher-fidelity transcription of the Dangerous-roll icons on PDF pp. 144–147 becomes available.
2. **Optional refinements:** use `actionSuccessProbability` instead of raw pool size when a Hero picks an attack; add Full Auto and Covering Fire as Hero policies; add Carefree Bullets once `gear.json` records one- versus two-handed guns; model Call for Backup by swapping in a higher Template.
3. Commit as one task if requested.

## 1. Purpose

Given a crew of 2–5 Heroes (the existing hero model, including working-sheet state such as Grit used and Conditions) and one Enemy (from `npc.js`), play combat by the Corebook rules until one side is defeated, repeat it hundreds of times with a seeded rng, and report who wins and what it costs. Output is for the Director planning a scene: a verdict, a win rate, how long fights run, and per-hero risk.

## 2. Engine contract (`app/src/engine/combat.js`)

```js
resolveRoll(rng, { pool, difficulty, count = 1, freeReroll = false, policy })
  → { dice, units, need, passed, steps[], snakeEyes, summary }
createFighter(hero, options)      // snapshot of a hero sheet for one fight
createOpponent(enemy, options)    // snapshot of an npc.js enemy
simulateCombat(rng, crew, enemy, options, enemyFeatCatalog)
  → { winner: 'heroes'|'enemy'|'stalemate', rounds, heroes[], foe, log: [{round, turn, text}] }
runSimulations(rng, crew, enemy, options, enemyFeatCatalog)
  → { runs, options, outcomes, heroWinRate, verdict, rounds: {mean, median, p10, p90, min, max},
      heroes: [{ name, role, gritLost, damage, damageShare, counters, hitZeroRate, rouletteSpins,
                 leftForDeadRate, conditions, brokenRate, adrenalineSpent, spotlightSpent,
                 magsEmptied, rerolls, attacks: [{name, share}] }],
      enemy: { name, gritLeftOnWin, adrenalineGained, medkitRate, actionsUsed: [{id, perRun}] },
      sample }   // the first fight in full, for the log
verdictFor(rate)                  // Pushover ≥ .9, Fair fight ≥ .7, Deadly ≥ .4, else Overwhelming
combatMarkdown(report, data)
RULES                             // [{ text, pageRef }] shown in the UI
```

Successes are counted in Basic units (Basic 1, Critical 3, Extreme 9, Impossible 27, Jackpot ∞). This makes three-for-one combining (p. 69), Enemy Grit per success (p. 117), Damage Control (p. 84) and the 1/3/9 Grit loss for failed Dangerous rolls (p. 83) the same subtraction: a failed Dangerous roll costs `need − units`.

### Options (`DEFAULT_OPTIONS`)

| Key | Default | Choices | Source |
|---|---|---|---|
| `runs` | 500 | 1–5000 | — |
| `range` | medium | melee, close, medium, long | p. 124 "when in doubt, Medium" |
| `firstTurn` | action | action, reaction, coin | p. 119 |
| `reaction` | shoot | the six p. 118 examples, or `random` each turn | p. 118 |
| `cover` | none | none, partial | p. 125 |
| `badBoxCondition` | Hurt | Hurt, Tired, Nervous, Scared | p. 91 (Director's choice) |
| `reroll` | when_needed | when_needed, always, never | pp. 70-71 |
| `allIn` | never | never, desperate | p. 71 |
| `adrenaline` | reactions | never, reactions, always | p. 76 |
| `spotlight` | finish | never, save, finish | p. 77 |
| `enemyFeats` | true | — | p. 138 (Director may ignore them) |
| `tactics` | spend | spend, hoard, ignore | p. 139 |

### Fight loop

1. **Action Turn.** For each living hero: skip if Foul Play or Flamethrower took the turn; if trapped by Clamp Down, roll Critical Brawn+Force to break free instead. Otherwise stand up (prone), then choose an attack: every gun with mags left and a non-`X` modifier at the hero's range (Nerves+Shoot), or melee (Brawn+Fight) at Melee/Close (Close→Melee is the free Quick Action; Tactics forces a coin flip), or Flying Kick from Medium. The largest pool wins; ties prefer a Free Re-roll, then melee. With nothing in reach the hero closes one range step. Hits = `floor(units / defenseUnits)`, capped by Titan, stopped by Hard to Kill at a Hot Box, negated by Parry, mirrored by Counter. A failed shot empties a mag; Walking Hazard makes a failed attack cost Grit; shooting past a friend in Melee sends the roll's 1s to that friend as Grit (p. 127).
2. **Reaction Turn.** The Director first spends Adrenaline on the most expensive affordable proactive Special Action (or hoards for the 3-cost one). Then every hero makes the same Dangerous roll against the Enemy Attack (Counter feat swaps in Brawn+Fight; Outsmart lets Know stand in). Extra successes protect friends who failed, then counter for 1 Grit each (p. 119). Failed heroes lose `need − units` Grit, then Automatic Weapons / Heavy-handed / Sharp Blades, Flamethrower and Explosive Weapons riders apply.
3. **Grit.** Bad Box (8th) gives the chosen Condition unless Too Young to Die; Hard to Kill adds 1 Adrenaline and +1 next roll; Hot Box (12th) gives 2 Adrenaline; a fourth Condition is Broken. Mob adds 1 to every loss. A hero at 0 Grit who would lose more spins the Death Roulette; a living friend with a Spotlight always saves them (coin: tails gives the saved hero a Spotlight).
4. **End.** Heroes win when Enemy Grit is 0 (Medkit revives once). The Enemy wins when every living hero has 0 Grit (p. 129). Stalemate after 40 rounds. If the Enemy's last box is a Hot Box the Director gets one parting Special Action (Final Blow, p. 139).

## 3. UI (`app/src/ui/screens/CombatSim.jsx`)

- Menu tile "Combat Simulator", `mode: 'combat'`.
- Left column: the crew, shared with Assemble a Crew through App state (`crew`, `setCrew`). Size picker and "Assemble random crew"; each hero card shows name, Role, Trope, Shoot/Fight/Stunt pools, Grit, Adrenaline, Spotlight, guns with mags, Conditions, plus reroll and remove buttons.
- Right column: the NPC generator's enemy controls (type, template, theme, heat, solo) plus a "Use Feats & Special Actions" toggle, and the shared `EnemyCard`.
- "The scene" panel: the option selects above, then "Run N fights" and "Copy Markdown".
- Report: verdict banner (coloured by label), outcome bar, four stat tiles, hero table (scrolls horizontally), Special Actions used, one fight's log behind a toggle with its seed, and a `<details>` listing `RULES` with page references.
- Styles are the `.combat-*` block at the end of `app.css`; two columns collapse at 860 px, selects go single-column at 560 px.

## 4. Rulings and interpretations

Verified against the Corebook text:

- Combat structure, Attack/Defense as difficulties, Grit per success, Dangerous Reaction Rolls, extra reactions: pp. 116-119, 129.
- Re-roll rules: only loose dice are re-rolled; a normal Re-roll that is not better loses one chosen success (the smallest); Free Re-rolls never lose and may be taken from nothing; All In loses everything: pp. 70-71.
- Double difficulty needs two successes; one success avoids one consequence: pp. 66, 123.
- Damage Control 1 per Basic, 3 per Critical, none on Impossible: p. 84. Bad Box, Hot Box: p. 85. Conditions and Broken: p. 90. Death Roulette and saves: pp. 96-97. Mags and stray bullets: pp. 126-127. Cover: p. 125. Range and gun table: pp. 105, 124. Enemy Feats: pp. 140-143. Special Actions: pp. 144-147. Final Blow: p. 139.

Interpretations where the book leaves it to the table (each also appears in `RULES`):

- **Jackpot!** takes the Enemy out of the fight (p. 68 makes it narrative).
- **Special-Action Reaction Rolls** (Tackle, Flashbang, Foul Play, Disarm, Grab and Throw, Threats, Clamp Down, Final Move) carry only the consequence printed for them. **Grenade** is a Dangerous Extreme roll because the text says friends "do not lose Grit" on a bounce. The markdown loses the Dangerous icon; check the PDF.
- **Tactics** (p. 141): on heads the hero loses their Action Roll for the turn, the literal reading of "loses their action".
- **Infamy** is used reactively on the next Adrenaline or Spotlight a hero spends; the summary in `npc.json` reads it the same way.
- **Finishing blow** (Spotlight policy `finish`): a hero spends a Spotlight for an automatic Extreme Success only when that ends the fight and the Enemy has at least Critical Attack, so Spotlights are not wasted on Goons.
- **Adrenaline** is spent one point per roll for +1; the Combo Feat is used after any hit while Adrenaline remains.
- **Bad Box Condition** defaults to Hurt (p. 92 lists taking a beating as the trigger); Tired is offered as the book's "never wrong" alternative (p. 94).
- **Hero Feats modelled:** Gunslinger (pistol, revolver, silenced pistol, machine pistol), Marksman (rifle, shotgun, SMG, machine gun, assault rifle, precision rifle), Archer, Knife Thrower, Martial Arts (unarmed Fight rolls), Flying Kick, Counter, Outsmart, Combo, Hard to Kill, Punch Reload, Too Young to Die. All others are narrative or out of combat and ignored.
- **Not simulated:** Call for Backup, Weak Spot discovery (p. 148), Full Auto, Covering Fire, Total Cover, Carefree Bullets (`gear.json` has no one/two-handed flag, so the +1 rule cannot be applied without inventing data).

## 5. Tests

`tests/engine/combat.test.js` uses a scripted rng (`faces → rng`) so single rules can be pinned: three-for-one, re-roll better/worse/free/no loose dice, All In bust, double difficulty, pool clamping and Snake Eyes; fighter snapshots and pack-prefixed Feat ids; Enemy level mapping and Rage; a 300-seed fuzz over every option for termination and state bounds; determinism; no mutation of inputs; Grit per success; Damage Control and Bad Box; Death Roulette and Spotlight saves; Hot Box Adrenaline, Hard to Kill, Titan, Mob, Medkit; mags and closing range; Special Actions used or ignored; Grenade and Jackpot; aggregate sums, Goons T1 versus Boss T5 ranking, Markdown, verdicts, and that every `RULES` entry has a page.

`tests/ui/combat.test.jsx` renders the menu tile, the empty-crew state, a crew summary, and a full `CombatReport`.

## 6. Sanity figures from the reference implementation

Random crew of four (seed 11) against military-themed Enemies, 400 fights each, default options:

| Enemy | Crew wins | Median rounds |
|---|---|---|
| Goons T1 | 100% | 1 |
| Goons T5 | 100% | 1 |
| Bad Guys T1 | 100% | 3 |
| Bad Guys T3 | 91% | 3 |
| Bad Guys T5 (2 Critical Attack) | 21% | 5 |
| Boss T1 | 59% | 3 |
| Boss T3 | 6% | 3 |
| Boss T4 | 11% | 3 |
| Boss T5 | 1% | 3 |

This matches the book's framing on pp. 132-136: Goons are unlikely to win, Bad Guys Templates 3-5 keep Heroes on their toes, Bosses 4-5 are "truly excessive" without Spotlights. The 2 Critical Attack on Bad Guys T3-5 is the biggest swing in the rules: a failed reaction costs 6 Grit.
