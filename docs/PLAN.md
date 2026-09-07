# Outgunned Toolkit — Design Plan

A browser-based set of play aids for **Outgunned** (Two Little Mice), hosted as a GitHub Page, modeled on the earlier toolkits in this workspace:

| Sibling | What we take from it |
|---|---|
| `../cy_borg` | Personality quiz, per-field rerolls, base64 share links, single-file HTML distributable |
| `../tmnt` | Pure rules **engine** separated from UI, page-cited JSON data, TDD and integrity tests, fuzz-validated generation, milestone gates |
| `../travtools` | GitHub Actions Pages workflow, `base` path config, local typed reference data |

Written to be executed task-by-task by coding agents, several in parallel (§9). Do not invent rule values.

Revision 2 (2026-09-05): app draws its own sheet; extraction scripts, reroll graph, sentence templates, mission PDF, text-exclusion flag and official-sheet filling removed or deferred; UI split per screen to allow parallel work.

---

## 0. Ground rules

1. **Never fabricate a rule value.** Every point allocation, feat list, gear entry, range modifier and random-table row traces to a page in `books/` (a gitignored symlink to the local library). Data records carry `pageRef`. Unverifiable values are marked `"status": "pending"` and greyed out, never guessed.
2. **The markdown conversions in `books/**/*.md` are aids, not sources of truth.** Known defects: the Corebook markdown lost the `###` on *Cool but Distressed*, *Jerk with a Heart of Gold* and *Last Boy/Girl Scout*; the Assistant Director conversion dropped its table pages (13, 16-17, 56-59). Verify against the PDF with `pdftotext -layout -f N -l N file.pdf -`.
3. **Engine before UI, tests before engine.** `app/src/engine/` is pure JS with no React or DOM; every randomised function takes `rng` first; no `Math.random()` outside `dice.js`.
4. **One hero model, three front doors.** Random, Guided and Questionnaire all go through the same `build.js` kernel; the sheet view, PDF and share link never know which door was used.
5. **`npm test` after every task; commit per task** as `M<n>.T<m>: <description>`. Do not commit unless asked; leave the tree commit-ready.
6. **No new dependencies** beyond §2 without recording why in `docs/NOTES.md`.
7. **Contracts freeze before fan-out.** §4 and §5 are the interfaces parallel workers build against; changing them is a plan edit, not a local decision.

---

## 1. What the tools do

### 1.1 Hero creation (Corebook pp. 17-59)

1. **Role** (10): Commando, Fighter, Ace, Agent, Face, Nobody, Brain, Sleuth, Criminal, Spy. +1 to one fixed Attribute, +1 to each of 10 Skills, 2 Feats from a list of 6, starting Gear, suggested Jobs / Catchphrases / Flaws.
2. **Personal data**: Name, Job, Age (Young / Adult / Old), Catchphrase, Flaw.
3. **Trope** (18): Bad to the Bone, Cheater, Cool but Distressed, Diehard, Free Spirit, Genius Bruiser, Good Samaritan, Hot Stuff, Hunk, Jerk with a Heart of Gold, Last Boy Scout / Girl Scout, Leader, Lone Wolf, Mentor, Neurotic Geek, Party Killer, Trusty Sidekick, Vigilante. +1 to **one of two** Attributes (if the Role already raised one of them, the other is mandatory), +1 to each of 8 Skills, 1 Feat from a list of 4.
4. **Attributes & Skills**: start at 2 in all 5 Attributes and 1 in all 16 Skills; max 3. Role + Trope add 2 Attribute and 18 Skill points; then **2 free Skill points** anywhere below the cap.
5. **Feats**: 3 (2 Role + 1 Trope) from the 47 core Feats. **Young**: 1 Role Feat only, gains *Too Young to Die*, starts with 2 Adrenaline. **Old**: 1 extra Feat from Role or Trope lists, 2 Lethal Bullets, may start with 1 Experience.
6. **Gear**: from the Role (some entries are choices); each gun starts with 2 Mags; optional one extra useful item. Guns carry Melee / Close / Medium / Long modifiers from p. 105.
7. **Resources**: 1 Adrenaline, 1 Spotlight, 1 Cash (3 with *Cash Flow*), 12 empty Grit boxes, no Conditions, 1 Lethal Bullet.

**Invariants** (each a test): values within `[2..3]` / `[1..3]`; trope attribute rule honoured; exactly 2 free points, never onto a Skill already at 3; feat count 3 / 3 / 4 by age from permitted lists; crews have distinct Roles.

### 1.2 Three front doors

| Mode | Behaviour |
|---|---|
| **Random Hero** | One click. Random Role, Trope, legal attribute choice, Feats, Job / Catchphrase / Flaw from the Role's suggestions, generated Name, Age weighted to Adult, free points placed under the Role's Attribute. Every field has ↻. |
| **Guided Hero** | Wizard in book order: Role → Personal Data → Trope (attribute rule enforced live) → Free points → Feats (age-aware) → Gear choices → Review. Going back re-runs the pipeline from that step. |
| **Questionnaire** | ~16 scenario questions; each answer carries weights over Skills / Attributes / Tropes. Engine scores all Roles and Tropes by dot product with their skill lists and proposes the top 3 of each; player confirms or overrides, then lands in the wizard at step 2, or auto-completes with the random rules. |

Extras: **Crew** (2–5 heroes, distinct Roles), **share link** (base64url hash), **edit mode** on the sheet.

### 1.3 Mission generator (Assistant Director booklet + Corebook §VI)

Fills the **Assistant Director Sheet** structure (booklet p. 9): campaign name & setting → Villain (Nature / Desire / Problem, p. 13; 2–3 Strong Spots and 1–2 Weak Spots, Corebook pp. 175-176; 3–5 Approach keyword pairs from the Thematic Oracles) → Mission & Stakes (free text with prompts) → 2 Allies (Help + Flaw D66, p. 17) → 2 Leads or a MacGuffin (D66, p. 16) → five Campaign Phases (p. 18) each with Aim (free text), Hurdle (D6) and Climax (D6), the Turning Point carrying one of the four twists (Corebook p. 169).

Rolled results are shown as the book's words plus its prompt; the Director writes the sentence. No sentence-assembly templates.

Standalone rollers for the table: Yes/No Oracle, Thematic Oracles, Clue, Scene Drama, Mission Generator, Unisex Names, Locations (Urban, Store, Skyscraper, Natural, Desert & Jungle, World Region), Enemy Weak Spots (Corebook p. 149).

Output: on-screen sheet, copy as Markdown, share link. No PDF for missions in v1.

---

## 2. Stack and project config

- React 18, Vite 6, plain JSX. No CSS framework, router or state library. One `theme.js` style object; `mode` state for navigation; share state in `location.hash`.
- **UI is split per screen** (`src/ui/screens/*.jsx`) so screens can be built in parallel. This is a deliberate departure from the single-file convention of the sibling repos.
- Vitest. `pdf-lib` for the hero sheet PDF (bundled from npm; standard fonts only, no network).
- `vite build` for Pages (`base: '/outgunned/'`); `vite-plugin-singlefile` in `--mode singlefile` for `play/outgunned-tools.html`.
- No Python in the app path. The existing `src/outgunned_pdf` package stays as-is for book conversion.

`app/package.json`:

```json
{
  "name": "outgunned-tools",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:html": "vite build --mode singlefile && cp dist/index.html ../play/outgunned-tools.html",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0", "pdf-lib": "^1.17.1" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^6.0.0", "vite-plugin-singlefile": "^2.0.0", "vitest": "^3.0.0" }
}
```

### 2.1 PDF export

The app **draws its own stripped-down Hero Sheet** with pdf-lib: same information architecture as the official sheet so players find things where they expect, rendered in the toolkit's own theme with no publisher art. Needs no asset and works identically in both builds. Filling the official fillable PDF is backlog (§8, M5+); its field map is preserved in `docs/hero-sheet-field-map.json`.

---

## 3. Repository layout (target)

```
outgunned/
  app/
    index.html  vite.config.js  vitest.config.js  package.json
    data/
      roles.json  tropes.json  feats.json  gear.json  names.json
      questionnaire.json  mission_tables.json
    src/
      engine/                   # pure JS, TDD
        dice.js  tables.js  build.js  hero.js  validate.js
        questionnaire.js  crew.js  mission.js  share.js
      pdf/heroSheet.js
      ui/
        theme.js  App.jsx
        screens/Menu.jsx  HeroSheet.jsx  RandomHero.jsx  GuidedHero.jsx
                Questionnaire.jsx  Crew.jsx  Mission.jsx  Oracles.jsx
        components/             # dots, banner, buttons shared by screens
      main.jsx
    tests/engine/  tests/data/  tests/pdf/  tests/fixtures/  tests/ui/
  play/outgunned-tools.html     # committed single-file build
  docs/PLAN.md  docs/NOTES.md  docs/hero-sheet-field-map.json
  .github/workflows/deploy.yml
  books -> ~/Documents/DND/Outgunned/books   # gitignored symlink
  src/outgunned_pdf/  pyproject.toml  .gitignore  README.md  CLAUDE.md
```

---

## 4. Data contracts

Every file: `{ "_meta": { "source": "Outgunned Corebook ENG" | "Assistant Director ENG 1.0", "transcribed": "YYYY-MM-DD" }, ... }`. Ids are lowercase snake case; every record has `pageRef`. Transcribed by hand from the PDF, verified by `tests/data/integrity.test.js`.

Attribute ids: `brawn nerves smooth focus crime`. Skill ids in sheet order: `endure fight force stunt | cool drive shoot survival | flirt leadership speech style | detect fix heal know | awareness dexterity stealth streetwise`.

### 4.1 `roles.json`
```json
{ "roles": { "commando": {
  "name": "The Commando", "pageRef": 20,
  "tagline": "STRONG. WELL TRAINED. UNSTOPPABLE.",
  "attribute": "brawn",
  "skills": ["endure","fight","force","cool","shoot","survival","leadership","fix","awareness","stealth"],
  "feats": ["hard_to_kill","hunter","intimidation","marksman","military_background","thats_all"],
  "gear": [ {"item":"knife"}, {"choice":["telephone","radio"]}, {"choice":"any_gun"} ],
  "jobs": ["Soldier","Marine","Mercenary"],
  "catchphrases": ["Stay back, I got this","Nobody left behind","If it bleeds, we can defeat it"],
  "flaws": ["I don't trust anyone","I think everyone else is weak","I never know when to back down"]
}}}
```
Gear grammar: `{"item": id}` · `{"choice": [ids]}` · `{"choice": "any_gun" | "any_1cash_item" | "any_precious_item" | "any_item"}` · `{"ride": {"speed": 1}}` · `{"either": [[...],[...]]}` (the Nobody). Tests: 10 roles; 10 skills; 6 feats; attribute valid; every gear id resolves in `gear.json`.

### 4.2 `tropes.json`
```json
{ "tropes": { "bad_to_the_bone": {
  "name": "Bad to the Bone", "pageRef": 42, "quote": "Listen, I'm no hero. I do not care.",
  "attributes": ["nerves","crime"],
  "skills": ["force","stunt","drive","shoot","flirt","style","dexterity","streetwise"],
  "feats": ["knife_thrower","parkour","proven_driver","shadow"],
  "blurb": "one-sentence paraphrase"
}}}
```
Tests: 18 tropes; 2 attributes; 8 skills; 4 feats; ids resolve.

### 4.3 `feats.json`
```json
{ "feats": { "gunslinger": { "name": "Gunslinger", "pageRef": 52,
  "activation": "passive" | "adrenaline" | "quick_action" | "full_turn",
  "summary": "Free Re-roll when using, repairing, evaluating, or handling a gun.",
  "exclusive": null | "young" }}}
```
One-line paraphrased summaries only; no full rule text. Tests: 47 core + `too_young_to_die`; every Role/Trope feat resolves.

### 4.4 `gear.json`
Guns (p. 105: `cost`, `features[]`, `range: {melee, close, medium, long}` as strings, `"X"` kept), tools of the trade (p. 104), ride types and speeds (pp. 106-108), and the Role starting items not in the price lists (badge, handcuffs, elegant clothes, notebook, pencil, knife) as `common` items cited to the Role page.

### 4.5 `names.json` — original first names and surnames, plus the booklet's Unisex Name Table (p. 57).

### 4.6 `questionnaire.json` — original content.
```json
{ "questions": [ { "id": "q01", "prompt": "The getaway car stalls with sirens closing in. You…",
   "answers": [
     { "text": "Pop the hood. Thirty seconds.", "weights": { "skill:fix": 2, "attr:focus": 1, "trope:neurotic_geek": 1 } },
     { "text": "Draw down and buy everyone time.", "weights": { "skill:shoot": 2, "skill:cool": 1, "attr:nerves": 1 } },
     { "text": "Bail and run the alleys.", "weights": { "skill:stunt": 2, "skill:stealth": 1, "attr:crime": 1 } },
     { "text": "Talk the first cop into a lift.", "weights": { "skill:speech": 2, "attr:smooth": 1, "trope:cheater": 1 } }
   ] } ] }
```
Tests: 3–4 answers per question; every weight key resolves; every Skill appears in at least 3 answers, every Attribute in at least 6, every Trope has at least 2 direct weights; 100 seeded random answer sets produce at least 8 distinct top Roles and 10 distinct top Tropes.

### 4.7 `mission_tables.json`
```json
{ "tables": { "hurdle": { "die": "d6", "pageRef": 17, "source": "Assistant Director ENG 1.0",
    "columns": ["hurdle"], "rows": [ { "roll": 1, "hurdle": "Extreme weather / Natural disaster" } ] } } }
```
`die` ∈ `d6 | d66 | d6x2 | d6xcoin`; multi-column tables (Villain Generator, Thematic Oracles, Scene Drama) list a value per column per row; D66 rows use `"roll": "11-12"`. Required tables: `villain_generator` (p. 13), `macguffin` (16), `help`, `flaw` (17), `hurdle` (17), `climax` (18), `thematic_oracles` (56), `general_clues`, `mission_generator`, `scene_drama`, `unisex_names` (57), `urban_locations`, `store`, `skyscraper` (58), `world_region`, `natural_locations`, `desert_jungle` (59), `yes_no_oracle` (45), `scene_prompts` (56); from the Corebook: `turning_point_twists` (169), `villain_strong_spots` (175), `enemy_weak_spots` (149), `campaign_phases` (booklet 16). Test: every table's rows cover its die space exactly once.

---

## 5. Engine contracts

### 5.1 `dice.js` — `makeRng(seed)` (mulberry32, copied from tmnt), `d6`, `d66`, `coin`, `pick`, `shuffle`.
### 5.2 `tables.js` — `roll(rng, table)` → `{ roll, row }` for every `die` kind; `validateTable(table)`.

### 5.3 `build.js` — the rules kernel (one author, sequential)
```js
baseHero()                                  // attrs 2, skills 1, resources p.58
applyRole(hero, role)
tropeAttributeOptions(hero, trope)          // both, or the forced single option
applyTrope(hero, trope, chosenAttr)
freeSkillTargets(hero)                      // skills < 3
applyFreeSkillPoints(hero, [a, b])          // a === b allowed only from 1
featSlots(hero)                             // {role, trope, extra, forced[]} by age
applyFeats(hero, {role, trope, extra})
resolveGear(hero, choices)                  // gear grammar → concrete guns/items/ride, mags 2
applyAge(hero, age)
finalize(hero)                              // Cash Flow, meta
```
Pure functions; typed `RuleError` on illegal input. Tests: one per §1.1 invariant; Johnny Reed fixture (Agent / Last Boy Scout, p. 19 and the pregen sheet).

### 5.4 `hero.js`
```js
{ meta: { version: 1, seed, mode, createdAt },
  personal: { name, job, age, catchphrase, flaw, portraitDataUrl: null },
  role, trope, tropeAttribute,
  attributes: { brawn, nerves, smooth, focus, crime },
  skills: { endure, ... },
  freeSkillPoints: [a, b],
  feats: [ids],
  gear: { guns: [{ id, name, range, mags }], items: [{ id, name, bag }], storage: [], ride: null | { name, speed, types } },
  resources: { adrenaline, spotlight, cash, lethalBullets },
  experiences: [], mission: "" }
```
`generateRandom(rng, data, pins = {})` runs §5.3 end to end; any field present in `pins` is kept instead of rolled. **Reroll is just `generateRandom(rng, data, {...pinsExcept(field)})`**, so downstream state can never go stale. Fuzz: 1,000 seeds pass `validateHero` and draw a PDF without throwing.

### 5.5 `validate.js` — `validateHero(hero, data)` → `[]` or a list of rule violations; used by the fuzz test, edit mode and share decoding.
### 5.6 `questionnaire.js` — `drawQuestions(rng, bank, n)`, `score(answers, data)` → sorted `{ roles, tropes }`, `suggest(answers, data)` → top 3 each.
### 5.7 `crew.js` — `generateCrew(rng, data, size)` with distinct Roles.
### 5.8 `mission.js` — `generateCampaign(rng, tables)` → the campaign object (§1.3); `rollTable(rng, tables, id)`; `rerollField(rng, campaign, path)` re-rolls just that table.
### 5.9 `share.js` — base64url of the hero (`#h=`) or campaign (`#m=`); decode runs `validateHero` before rendering; 8 KiB size test.

### 5.10 `pdf/heroSheet.js` — `drawHeroSheet(hero, data)` → `Uint8Array`
One landscape Letter page from a `SHEET_LAYOUT` spec of named boxes (points). Regions mirror the official sheet: identity strip with optional portrait; five attribute blocks with skill ●/○ dots; 12 Grit boxes; 6 Feat boxes (name + wrapped summary); Adrenaline 6 / Spotlight 3 / Cash 5 / Death Roulette 6 with loaded chambers filled; You Look list; Guns table (name, four range columns, 3 mag marks) plus 5 gear lines with bag marks; Storage; Ride (name, speed, 3+3 shields, type). Empty trackers are drawn. Helvetica only. Layout reports overflow as an error. Tests: every fuzz hero renders; re-read text contains name, role, trope and feat names; a maximal fixture (Old, 4 feats, 3 guns, 5 items, ride) fits.

---

## 6. UI spec

- **Shell** (`App.jsx`): `mode: 'menu'|'random'|'guided'|'quiz'|'crew'|'mission'|'npc'|'combat'|'oracles'`; hash decode on boot; Crew and Combat Simulator share crew state.
- **Menu**: RANDOM HERO · GUIDED HERO · WHO ARE YOU? · ASSEMBLE A CREW · NEW MISSION · NPC GENERATOR · COMBAT SIMULATOR · ORACLES. Footer legal line (§10).
- **HeroSheet**: identity strip → attribute blocks with dots → feats → resources row → guns & gear → ride. Fields carry ↻ in random mode and ✎ in edit mode. Buttons: EXPORT PDF, COPY LINK, NEW HERO, ADD TO CREW. Usable at 390 px.
- **GuidedHero**: 7 steps (§1.2); header shows Role / Trope / points remaining; Trope step greys the Role's attribute with the reason; free-points step blocks maxed Skills; Feats step shows the age-correct slot count; Gear step renders each choice as a picker.
- **Questionnaire**: one question per screen, progress bar; result screen with score bars and ACCEPT & FINISH (into the wizard at step 2) or JUST ROLL IT.
- **Crew**: size 2–5, compact cards, per-member open/reroll, export = one PDF per hero.
- **Combat Simulator**: shared crew builder, Enemy generator controls, configurable scene and table policies, seeded multi-fight report, Markdown export, and a sample combat log. Its pure rules engine and interpretation notes are specified in `COMBAT_SIMULATOR.md`.
- **Mission**: form mirroring the Assistant Director Sheet with 🎲 beside every rolled field and ROLL EVERYTHING; phase cards; COPY MARKDOWN, COPY LINK.
- **Oracles**: the standalone rollers with a result log; phone-friendly.
- **Theme** (`theme.js`): paper `#f3ede0`, ink `#17161a`, red `#c8202f` for banners and primary buttons, muted `#6b6660`; condensed display face (`"Arial Narrow", Impact, sans-serif`), humanist body; diagonal red section banners via `clip-path`; faint film grain via CSS gradient. No external fonts, images or publisher marks.

---

## 7. Testing policy
Engine: TDD, expectations read from the JSON except pinned book values with a page comment. Data: `tests/data/integrity.test.js` as listed per file in §4. Fixtures: Johnny Reed; one Hot Shot campaign (booklet p. 64) replayed through `mission.js` shapes. PDF: render + re-read as in §5.10, plus one manual visual check per gate. UI: `renderToString` smoke per screen. `npm test` green before every gate.

---

## 8. Milestones

Gates are attempted only when every task's DoD is met. If a gate fails, cut scope into the next milestone and record it in `docs/NOTES.md` (running notes: rulings with page citations, plan deltas, open items). No per-milestone retro documents.

### M0 — Contracts and data
| # | Task | DoD |
|---|---|---|
| T0.1 | Freeze §4/§5 contracts; scaffold `app/` (§2), `.gitignore` (`node_modules`, `dist`, `books`), Pages workflow, `README.md`, `CLAUDE.md` | `npm run dev` clean; CI runs `npm test` and `npm run build` |
| T0.2 | `dice.js`, `tables.js` + tests | green |
| T0.3 | Transcribe `roles.json` | integrity green, 10 roles |
| T0.4 | Transcribe `tropes.json` (fix the three mis-headed tropes from the PDF) | integrity green, 18 tropes |
| T0.5 | Transcribe `feats.json` with one-line summaries | integrity green, 48 entries |
| T0.6 | Transcribe `gear.json` | integrity green; every Role gear id resolves |
| T0.7 | Transcribe `mission_tables.json` from `pdftotext -layout` pages | die-space coverage green |
| T0.8 | Author `names.json` and `questionnaire.json` (30 questions) | §4.6 tests green |
| T0.9 | `theme.js` + shared components (dots, banner, buttons) + Menu screen | smoke green |
| T0.10 | `tests/data/integrity.test.js` covering §4 | green |

**Gate M0**: integrity suite green over all seven data files; spot-check 3 roles, 3 tropes, 5 feats and 3 tables against the PDFs, recorded in NOTES.

### M1 — Random Hero end to end
| # | Task | DoD |
|---|---|---|
| T1.1 | `build.js` by TDD, one test per invariant | green |
| T1.2 | `hero.js` `generateRandom` with pins, `validate.js`, fuzz 1,000 | green |
| T1.3 | Johnny Reed fixture | green |
| T1.4 | `share.js` + hash boot | round-trip green |
| T1.5 | `pdf/heroSheet.js` layout + drawing (§5.10) | render/re-read/overflow tests green |
| T1.6 | HeroSheet screen with ↻ per field, EXPORT PDF, COPY LINK; RandomHero screen | manual run-through in dev and in `play/` build |
| T1.7 | Visual check: Johnny Reed export vs the official pregen for completeness of information | every datum present; screenshot in NOTES |

**Gate M1**: fuzz green; PDFs for 5 seeds open in Preview and Acrobat and print legibly; Pages URL serves the app; 390 px check.

### M2 — Guided Hero and Questionnaire
T2.1 `questionnaire.js` by TDD; T2.2 GuidedHero screen (7 steps, back re-runs the pipeline with pins); T2.3 Questionnaire screen and hand-off into step 2; T2.4 fixture replayed as a wizard step sequence. **Gate**: a fresh session builds a hero start to finish with no dead ends; illegal states unreachable from the UI and rejected by the engine; questionnaire diversity test green.

### M3 — Missions and Oracles
T3.1 `mission.js` by TDD; T3.2 Mission screen; T3.3 Oracles screen; T3.4 Markdown copy + share; T3.5 Hot Shot fixture. **Gate**: 200 seeded campaigns render; user reviews one for usefulness.

### M4 — Crew and polish
T4.1 `crew.js` + Crew screen; T4.2 edit mode with validation; T4.3 mobile pass; T4.4 single-file build re-verified offline. **Gate**: crew of 5 exports five PDFs; `play/outgunned-tools.html` works from `file://` with zero network requests.

### M5 — Combat Simulator
T5.1 pure combat engine and rule interpretations; T5.2 deterministic, fuzz and aggregate tests; T5.3 shared Crew/Enemy UI and report; T5.4 responsive browser pass and Markdown export. **Gate**: full test suite and production build are green; 500 fights, sample log and 390 px layout work without console errors or page overflow.

### M6+ — Backlog (each its own milestone when picked up)
Content packs with a "books in play" selector and `source` on every record: World of Killers (5 Roles, 9 Tropes, Special Roles), Action Flicks 1–3, Outgunned Adventure (own Roles, Fortune Seeker, Adventure generator), Superheroes. Optional fill of the official fillable Hero Sheet from a user-supplied blank (field map in `docs/`). Mission one-pager PDF. Portrait generation (cy_borg pipeline). Advancement tracking.

---

## 9. Parallel work plan

Contracts (§4, §5) freeze in T0.1 before anything fans out. After that, tasks split into three lanes.

**Lane A — one capable author, sequential.** T0.1 contracts and scaffold → T1.1 `build.js` → T1.2 `hero.js` and `validate.js` → T1.6 sheet/random screens integration → every gate's visual check. These hold the rule interactions and are the interfaces everything else consumes.

**Lane B — independent, well-specified, mechanically verified; suitable for smaller models, all at once.**

| Task | Input | Verified by |
|---|---|---|
| T0.3 `roles.json` | Corebook pp. 20-39 | integrity test |
| T0.4 `tropes.json` | pp. 42-47 | integrity test |
| T0.5 `feats.json` | pp. 51-57 | integrity test + id resolution |
| T0.6 `gear.json` | pp. 104-108 | schema test |
| T0.7 `mission_tables.json` | booklet pp. 13, 16-19, 45, 56-59; Corebook pp. 149, 169, 175 | die-space coverage |
| T0.8 `names.json`, `questionnaire.json` | §4.5-4.6 schemas, weight vocabulary | §4.6 tests |
| T0.2 `dice.js`, `tables.js` | tmnt originals | unit tests |
| T0.9 `theme.js`, shared components, Menu | §6 theme | smoke test |
| T0.10 integrity suite | §4 | runs green on stub data |
| Pages workflow, README, CLAUDE.md | travtools workflow | CI green |

**Lane C — parallel once Lane A's hero contract exists (after T1.2).**

| Task | Depends on | Verified by |
|---|---|---|
| T1.5 `pdf/heroSheet.js` | hero object shape, `feats.json` summaries | render/re-read/overflow tests |
| T1.4 `share.js` | hero shape, `validateHero` | round-trip test |
| T2.1 `questionnaire.js` | roles/tropes JSON | unit + diversity tests |
| T3.1 `mission.js` | `mission_tables.json`, `tables.js` | 200-seed test |
| T2.2 GuidedHero screen | `build.js` API | smoke + manual |
| T2.3 Questionnaire screen | `questionnaire.js` | smoke |
| T3.2 Mission screen, T3.3 Oracles screen | `mission.js` | smoke |
| T4.1 `crew.js` + Crew screen | `generateRandom` pins | distinct-role test |

Each Lane B and C task is handed out with: the relevant §4/§5 excerpt, the page numbers, the test file it must turn green, and the instruction to mark anything unverifiable as `pending` rather than guess.

---

## 10. Legal and publishing

Outgunned is © Two Little Mice. As of September 2026 they have said a third-party licence is being worked on but none is published, and there is no SRD.

- `books/` stays a gitignored symlink; PDFs and markdown conversions are never committed.
- `app/data/` holds mechanics (allocations, list membership, table rows, range numbers) and one-line paraphrases only. No full rule text ships.
- The official sheet PDF is never bundled; the app draws its own.
- Questionnaire, names, UI and layout are original.
- Footer: "Unofficial fan tool. Outgunned is © Two Little Mice. Not affiliated with or endorsed by Two Little Mice."
- Whether the repo goes public is the user's call at Gate M1; nothing in the build depends on it.

---

## Appendix A — Official Hero Sheet field map (reference only)

Derived 2026-09-05 from the blank fillable sheet (1 page, 841.89 × 595.28 pt, 165 widgets). Kept for the backlog "fill official sheet" feature and as the reference for the app-drawn layout's regions. Full JSON: `docs/hero-sheet-field-map.json`. `tx` = `Campo testo`, `cb` = `Casella di controllo`.

| Sheet area | Fields |
|---|---|
| Personal data | name tx1012 · role tx1013 · trope tx1014 · job tx1015 · age tx1017 · flaw tx1016 · catchphrase tx1018 · portrait `IMG` |
| Attribute 3rd dot | brawn cb153 · nerves cb200 · smooth cb201 · focus cb162 · crime cb202 |
| Skill dots 2 & 3 | endure 154/155, fight 156/157, force 158/159, stunt 160/161 · cool 168/169, drive 170/171, shoot 172/173, survival 174/175 · flirt 176/177, leadership 178/179, speech 180/181, style 182/183 · detect 184/185, fix 186/187, heal 188/189, know 190/191 · awareness 192/193, dexterity 194/195, stealth 196/197, streetwise 198/199 |
| Grit (12, left→right) | cb85 90 86 93 91 87 94 92 88 95 89 96 |
| Feats (6 × 2 lines) | (tx100,101) (102,103) (104,105) (106,107) (108,109) (1010,1011) |
| Spotlight / Adrenaline | cb113-115 / cb130-135 |
| Mission / Experiences | tx40 / tx41-44 |
| You Look | hurt cb145, nervous cb143, like a fool cb141, distracted cb139, scared cb137, tired cb144, other cb142/140/138 + tx45-47, broken cb136 |
| Death Roulette 2–6 | cb206-210 (chamber 1 pre-printed; verify order visually) |
| Guns (3 rows) | name tx48/52/53 · melee tx49/50/51 · close tx65/66/67 · medium tx68/69/70 · long tx71/72/73 · mags (116,119,122) (117,120,123) (118,121,124) |
| Gear (5 rows) | tx54-58, bags cb125-129 |
| Cash (5) | cb112 111 110 109 103 |
| Storage | tx59, 62, 63, 64 |
| Ride | name tx60 · speed tx61 · armor cb97/99/101 (+ cb98/100/102) · bike cb104, car cb105, nautical cb106, flying cb107, armored cb108 |
