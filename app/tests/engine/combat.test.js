import { describe, expect, it } from 'vitest'
import { gameData } from '../../src/data.js'
import { makeRng } from '../../src/engine/dice.js'
import { generateRandom } from '../../src/engine/hero.js'
import { generateCrew } from '../../src/engine/crew.js'
import { generateEnemy } from '../../src/engine/npc.js'
import { combatMarkdown, createFighter, createOpponent, DEFAULT_OPTIONS, resolveRoll, runSimulations, simulateCombat, verdictFor, RULES } from '../../src/engine/combat.js'

// An rng that deals the given faces in order: d6 = floor(rng * 6) + 1.
const scripted = faces => { let index = 0; return () => ((faces[index++ % faces.length] - 1) + 0.5) / 6 }
const enemyFeats = gameData.npc.feats

const makeEnemy = (overrides = {}, seed = 1) => ({ ...generateEnemy(makeRng(seed), gameData, { type: 'goons', template: 1, theme: 'street' }), feats: [], specialActions: [], ...overrides })
const crewOf = (size, seed = 5) => generateCrew(makeRng(seed), gameData, size)

describe('resolveRoll', () => {
  it('counts successes in Basic units and combines three for one (p. 69)', () => {
    const roll = resolveRoll(scripted([2, 2, 5, 5, 3, 3]), { pool: 6, difficulty: 3, policy: { reroll: 'never' } })
    expect(roll.units).toBe(3)
    expect(roll.passed).toBe(true)
  })

  it('re-rolls loose dice only when short of the needed success and keeps a better result (p. 70)', () => {
    const roll = resolveRoll(scripted([4, 4, 1, 2, 3, /* re-roll */ 4, 6, 6]), { pool: 5, difficulty: 3 })
    expect(roll.steps).toEqual(['re-roll improved'])
    expect(roll.units).toBe(4) // Critical (4,4,4) + Basic (6,6)
    expect(roll.passed).toBe(true)
  })

  it('loses the smallest success when a normal Re-roll is no better (p. 70)', () => {
    const roll = resolveRoll(scripted([4, 4, 1, 2, 3, /* re-roll */ 1, 2, 3]), { pool: 5, difficulty: 3 })
    expect(roll.steps).toEqual(['re-roll failed, lost a success'])
    expect(roll.units).toBe(0)
  })

  it('never risks the initial success on a Free Re-roll and takes it even without a success (p. 70)', () => {
    const noGain = resolveRoll(scripted([4, 4, 1, 2, 3, /* re-roll */ 1, 2, 3]), { pool: 5, difficulty: 3, freeReroll: true })
    expect(noGain.units).toBe(1)
    const fromNothing = resolveRoll(scripted([1, 2, 3, 4, 5, /* re-roll */ 6, 6, 6, 6, 6]), { pool: 5, difficulty: 3, freeReroll: true })
    expect(fromNothing.units).toBe(27)
  })

  it('does not re-roll when there are no loose dice', () => {
    const roll = resolveRoll(scripted([2, 2, 5, 5]), { pool: 4, difficulty: 3 })
    expect(roll.steps).toEqual([])
    expect(roll.units).toBe(2)
  })

  it('going All In loses everything on a worse result (p. 71)', () => {
    const roll = resolveRoll(scripted([4, 4, 1, 2, 3, /* re-roll */ 5, 5, 1, /* all in */ 2, 3]), { pool: 5, difficulty: 4, policy: { allIn: 'desperate' } })
    expect(roll.steps).toEqual(['re-roll improved', 'all in lost everything'])
    expect(roll.units).toBe(0)
  })

  it('needs two successes against a double difficulty (p. 66)', () => {
    const roll = resolveRoll(scripted([3, 3, 3, 1, 2, 4, /* re-roll */ 5, 6, 1]), { pool: 6, difficulty: 3, count: 2 })
    expect(roll.need).toBe(6)
    expect(roll.passed).toBe(false)
  })

  it('clamps pools to 2–9 dice and counts Snake Eyes for Gambles (p. 89)', () => {
    expect(resolveRoll(scripted([1, 1]), { pool: -3, policy: { reroll: 'never' } }).dice).toHaveLength(2)
    expect(resolveRoll(scripted([1, 1, 1, 1, 1, 1, 1, 1, 1]), { pool: 20, policy: { reroll: 'never' } }).snakeEyes).toBe(9)
  })
})

describe('createFighter / createOpponent', () => {
  it('reads Grit, resources and gear from the working hero sheet', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.resources.gritUsed = 5
    hero.conditions = ['Tired']
    const fighter = createFighter(hero, DEFAULT_OPTIONS)
    expect(fighter.grit).toBe(7)
    expect(fighter.conditions).toEqual(['Tired'])
    expect(fighter.guns[0]).toMatchObject({ id: 'shotgun', mags: 2 })
    expect(fighter.adrenaline).toBe(1)
    expect(fighter.range).toBe('medium')
  })

  it('strips content-pack prefixes from Feat ids', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.feats = ['supplements__gunslinger']
    expect(createFighter(hero).feats).toEqual(['gunslinger'])
  })

  it('maps enemy Attack and Defense to difficulties and starts Rage with 1 Adrenaline (p. 143)', () => {
    const foe = createOpponent(makeEnemy({ attack: { level: 'critical', count: 2 }, defense: { level: 'extreme', count: 1 }, feats: [{ id: 'rage' }] }))
    expect(foe.attack).toEqual({ difficulty: 3, count: 2 })
    expect(foe.defense).toEqual({ difficulty: 4, count: 1 })
    expect(foe.adrenaline).toBe(1)
    expect(createOpponent(makeEnemy({ feats: [{ id: 'rage' }] }), { ...DEFAULT_OPTIONS, enemyFeats: false }).adrenaline).toBe(0)
  })
})

describe('simulateCombat', () => {
  it('terminates with a valid winner and sane state for many seeded matchups', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const rng = makeRng(seed)
      const crew = crewOf(2 + (seed % 4), seed)
      const enemy = generateEnemy(makeRng(seed + 1000), gameData, { heat: seed % 13 })
      const options = { range: ['melee', 'close', 'medium', 'long'][seed % 4], firstTurn: ['action', 'reaction', 'coin'][seed % 3], reaction: seed % 5 === 0 ? 'random' : 'shoot', cover: seed % 2 ? 'partial' : 'none', allIn: seed % 7 === 0 ? 'desperate' : 'never', adrenaline: ['never', 'reactions', 'always'][seed % 3], tactics: ['spend', 'hoard', 'ignore'][seed % 3], reroll: ['when_needed', 'always', 'never'][seed % 3] }
      const result = simulateCombat(rng, crew, enemy, options, enemyFeats)
      expect(['heroes', 'enemy', 'stalemate']).toContain(result.winner)
      expect(result.rounds).toBeGreaterThanOrEqual(1)
      expect(result.log.length).toBeGreaterThan(2)
      for (const hero of result.heroes) {
        expect(hero.grit).toBeGreaterThanOrEqual(0)
        expect(hero.grit).toBeLessThanOrEqual(12)
        expect(hero.adrenaline).toBeGreaterThanOrEqual(0)
        expect(hero.adrenaline).toBeLessThanOrEqual(6)
        expect(hero.spotlight).toBeLessThanOrEqual(3)
        expect(hero.lethalBullets).toBeLessThanOrEqual(6)
        expect(hero.conditions.length).toBeLessThanOrEqual(4)
        for (const gun of hero.guns) if (gun.mags !== null) expect(gun.mags).toBeGreaterThanOrEqual(0)
      }
      expect(result.foe.grit).toBeGreaterThanOrEqual(0)
      if (result.winner === 'heroes') expect(result.foe.grit).toBe(0)
      if (result.winner === 'enemy') expect(result.heroes.filter(hero => hero.alive).every(hero => hero.grit === 0)).toBe(true)
    }
  })

  it('is deterministic for a seed', () => {
    const crew = crewOf(3)
    const enemy = generateEnemy(makeRng(9), gameData, { type: 'bad_guys', template: 3, theme: 'crime' })
    const a = simulateCombat(makeRng(42), crew, enemy, {}, enemyFeats)
    const b = simulateCombat(makeRng(42), crew, enemy, {}, enemyFeats)
    expect(a.log).toEqual(b.log)
    expect(a.winner).toBe(b.winner)
  })

  it('does not mutate the crew or enemy passed in', () => {
    const crew = crewOf(3)
    const enemy = generateEnemy(makeRng(9), gameData, { type: 'boss', template: 2 })
    const before = JSON.stringify({ crew, enemy })
    simulateCombat(makeRng(1), crew, enemy, {}, enemyFeats)
    expect(JSON.stringify({ crew, enemy })).toBe(before)
  })

  it('costs the Enemy 1 Grit per success at its Defense (p. 117)', () => {
    const hero = generateRandom(makeRng(3), gameData) // shotgun, Nerves 3 + Shoot 3
    hero.personal.name = 'Sam'
    const enemy = makeEnemy({ grit: 6, attack: { level: 'basic', count: 1 }, defense: { level: 'basic', count: 1 } })
    // 6 dice at medium with shotgun −2 → 4 dice: 5,5,5,2 = Critical = 3 Grit, then the enemy's Basic attack: 2,2,3,4,5,6 passes.
    const result = simulateCombat(scripted([5, 5, 5, 2, 2, 2, 3, 4, 5, 6]), [hero], enemy, { adrenaline: 'never', reroll: 'never', spotlight: 'save' }, enemyFeats)
    expect(result.log.map(line => line.text)).toContainEqual(expect.stringContaining('loses 3 Grit'))
  })

  it('applies Damage Control and fills the Bad Box with a Condition (pp. 84-85)', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.resources.gritUsed = 6
    hero.personal.name = 'Sam'
    const enemy = makeEnemy({ grit: 30, attack: { level: 'critical', count: 1 }, defense: { level: 'extreme', count: 1 } })
    // Reaction first. Brawn 2 + Stunt 3 = 5 dice: 4,4,1,2,3 = Basic → loses 3 − 1 = 2 Grit, crossing the Bad Box (used 6 → 8).
    const result = simulateCombat(scripted([4, 4, 1, 2, 3, 6, 6, 6, 6, 6, 6, 6, 6, 6]), [hero], enemy, { firstTurn: 'reaction', adrenaline: 'never', reroll: 'never', badBoxCondition: 'Tired' }, enemyFeats)
    const text = result.log.map(line => line.text).join('\n')
    expect(text).toContain('Sam loses 2 Grit (failed Reaction), 4 left.')
    expect(text).toContain('Sam looks Tired.')
  })

  it('spins the Death Roulette at 0 Grit and lets a friend spend a Spotlight (pp. 96-97)', () => {
    const crew = crewOf(2, 8)
    crew.forEach((hero, index) => { hero.resources.gritUsed = 12; hero.personal.name = `Hero${index}`; hero.resources.lethalBullets = 6 })
    crew[1].resources.spotlight = 1
    crew[0].resources.spotlight = 0
    const enemy = makeEnemy({ grit: 30, attack: { level: 'extreme', count: 1 }, defense: { level: 'extreme', count: 1 } })
    const result = simulateCombat(makeRng(2), crew, enemy, { firstTurn: 'reaction', adrenaline: 'never' }, enemyFeats)
    const text = result.log.map(line => line.text).join('\n')
    expect(text).toMatch(/spins the Death Roulette|Death Roulette/)
    expect(result.winner).toBe('enemy')
    expect(result.heroes.some(hero => hero.stats.roulette > 0)).toBe(true)
  })

  it('grants the Director Adrenaline on Hot Boxes and honours Hard to Kill and Titan (pp. 139, 142-143)', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.gear.guns = [{ id: 'assault_rifle', name: 'Assault Rifle', range: { melee: '0', close: '+1', medium: '+1', long: '+1' }, mags: 2 }]
    const base = { grit: 9, hotBoxes: [3, 7], attack: { level: 'basic', count: 1 }, defense: { level: 'basic', count: 1 } }
    const bigHit = [6, 6, 6, 6, 6, 3, 2] // 7 dice: Impossible = 27 Basic successes
    const plain = simulateCombat(scripted([...bigHit, 5, 5, 5, 5, 5]), [hero], makeEnemy(base), { adrenaline: 'never', reroll: 'never', firstTurn: 'action' }, enemyFeats)
    expect(plain.winner).toBe('heroes')
    expect(plain.foe.stats.adrenalineGained).toBe(2)
    const hardToKill = simulateCombat(scripted([...bigHit, 5, 5, 5, 5, 5]), [hero], makeEnemy({ ...base, feats: [{ id: 'hard_to_kill' }] }), { adrenaline: 'never', reroll: 'never', tactics: 'ignore' }, enemyFeats)
    expect(hardToKill.log.map(line => line.text)).toContainEqual(expect.stringContaining('loses 3 Grit'))
    const titan = simulateCombat(scripted([...bigHit, 5, 5, 5, 5, 5]), [hero], makeEnemy({ ...base, feats: [{ id: 'titan' }] }), { adrenaline: 'never', reroll: 'never', tactics: 'ignore' }, enemyFeats)
    expect(titan.log.map(line => line.text)).toContainEqual(expect.stringContaining('loses 1 Grit'))
  })

  it('lets Mob and Medkit change the arithmetic (pp. 140, 142)', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.personal.name = 'Sam'
    const mob = makeEnemy({ grit: 30, attack: { level: 'critical', count: 1 }, defense: { level: 'extreme', count: 1 }, feats: [{ id: 'mob' }] })
    const result = simulateCombat(scripted([1, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6]), [hero], mob, { firstTurn: 'reaction', adrenaline: 'never', reroll: 'never' }, enemyFeats)
    expect(result.log.map(line => line.text)).toContainEqual('Sam loses 4 Grit (failed Reaction), 8 left.')
    const medkit = makeEnemy({ grit: 1, attack: { level: 'basic', count: 1 }, defense: { level: 'basic', count: 1 }, feats: [{ id: 'medkit' }] })
    const revived = simulateCombat(makeRng(4), [hero], medkit, { adrenaline: 'never' }, enemyFeats)
    expect(revived.foe.medkitUsed).toBe(true)
    expect(revived.winner).toBe('heroes')
  })

  it('empties a mag on a failed shot and closes distance when nothing reaches (pp. 124, 126)', () => {
    const hero = generateRandom(makeRng(3), gameData)
    hero.gear.guns = []
    hero.gear.items = []
    const result = simulateCombat(makeRng(1), [hero], makeEnemy({ grit: 3 }), { range: 'long', adrenaline: 'never', spotlight: 'save' }, enemyFeats)
    const text = result.log.map(line => line.text)
    expect(text).toContainEqual(expect.stringContaining('moves to medium range'))
    expect(text).toContainEqual(expect.stringContaining('moves to close range'))
    expect(text).toContainEqual(expect.stringContaining('attacks with Fists'))
    const shooter = generateRandom(makeRng(3), gameData)
    const shots = simulateCombat(scripted([1, 2, 3, 4, 6, 6, 6, 6, 6, 6]), [shooter], makeEnemy({ grit: 30 }), { adrenaline: 'never', reroll: 'never' }, enemyFeats)
    expect(shots.log.map(line => line.text)).toContainEqual(expect.stringContaining('empties a mag'))
  })

  it('uses Special Actions with the Director’s Adrenaline (pp. 144-147)', () => {
    const crew = crewOf(3, 21)
    const enemy = makeEnemy({ grit: 12, hotBoxes: [1, 2, 3, 4, 5, 6], attack: { level: 'critical', count: 1 }, defense: { level: 'critical', count: 1 }, specialActions: [{ id: 'pile_on' }, { id: 'weak_spot' }, { id: 'to_the_end' }] })
    let used = 0
    for (let seed = 0; seed < 20; seed += 1) {
      const result = simulateCombat(makeRng(seed), crew, enemy, {}, enemyFeats)
      used += Object.values(result.foe.stats.actionsUsed).reduce((sum, value) => sum + value, 0)
    }
    expect(used).toBeGreaterThan(0)
    const quiet = simulateCombat(makeRng(1), crew, enemy, { tactics: 'ignore' }, enemyFeats)
    expect(quiet.foe.stats.actionsUsed).toEqual({})
  })

  it('makes a Grenade a Dangerous Extreme Reaction and treats a Jackpot as a knockout', () => {
    const crew = crewOf(2, 3)
    const enemy = makeEnemy({ grit: 12, hotBoxes: [1, 2], attack: { level: 'basic', count: 1 }, defense: { level: 'critical', count: 1 }, specialActions: [{ id: 'grenade' }] })
    let grenades = 0
    for (let seed = 0; seed < 40; seed += 1) {
      const result = simulateCombat(makeRng(seed), crew, enemy, {}, enemyFeats)
      if (result.foe.stats.actionsUsed.grenade) grenades += 1
    }
    expect(grenades).toBeGreaterThan(0)
    const hero = generateRandom(makeRng(3), gameData)
    hero.gear.guns = [{ id: 'assault_rifle', name: 'Assault Rifle', range: { medium: '+1' }, mags: 2 }]
    const jackpot = simulateCombat(scripted([4, 4, 4, 4, 4, 4, 4]), [hero], makeEnemy({ grit: 12, defense: { level: 'extreme', count: 1 } }), { adrenaline: 'never', reroll: 'never' }, enemyFeats)
    expect(jackpot.winner).toBe('heroes')
    expect(jackpot.rounds).toBe(1)
  })
})

describe('runSimulations', () => {
  it('aggregates outcomes that account for every run and ranks Enemies sensibly', () => {
    const crew = crewOf(4, 11)
    const goons = generateEnemy(makeRng(1), gameData, { type: 'goons', template: 1, theme: 'street' })
    const boss = generateEnemy(makeRng(1), gameData, { type: 'boss', template: 5, theme: 'military' })
    const easy = runSimulations(makeRng(7), crew, goons, { runs: 200 }, enemyFeats)
    const hard = runSimulations(makeRng(7), crew, boss, { runs: 200 }, enemyFeats)
    expect(easy.outcomes.heroes + easy.outcomes.enemy + easy.outcomes.stalemate).toBe(200)
    expect(easy.heroWinRate).toBeGreaterThan(0.9)
    expect(hard.heroWinRate).toBeLessThan(easy.heroWinRate)
    expect(easy.heroes).toHaveLength(4)
    expect(easy.heroes.reduce((sum, hero) => sum + hero.damageShare, 0)).toBeCloseTo(1, 5)
    expect(easy.rounds.median).toBeGreaterThanOrEqual(easy.rounds.p10)
    expect(easy.rounds.p90).toBeGreaterThanOrEqual(easy.rounds.median)
    expect(easy.sample.log.length).toBeGreaterThan(0)
    expect(easy.verdict.label).toBe('Pushover')
  })

  it('caps runs and produces Markdown', () => {
    const crew = crewOf(2, 2)
    const enemy = generateEnemy(makeRng(2), gameData, { type: 'bad_guys', template: 2 })
    const report = runSimulations(makeRng(3), crew, enemy, { runs: 0 }, enemyFeats)
    expect(report.runs).toBe(1)
    const markdown = combatMarkdown(report, gameData)
    expect(markdown).toContain('## Combat Simulation')
    expect(markdown).toContain('| Hero |')
    expect(markdown).toContain(report.verdict.label)
  })

  it('labels verdicts by win rate and cites every rule assumption', () => {
    expect(verdictFor(0.95).label).toBe('Pushover')
    expect(verdictFor(0.75).label).toBe('Fair fight')
    expect(verdictFor(0.5).label).toBe('Deadly')
    expect(verdictFor(0.1).label).toBe('Overwhelming')
    expect(RULES.every(rule => rule.pageRef && rule.text)).toBe(true)
  })
})
