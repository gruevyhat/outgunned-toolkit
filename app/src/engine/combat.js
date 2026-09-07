/**
 * Combat simulator: plays the alternating Action / Reaction Turns of
 * Outgunned combat (Corebook pp. 116-119) between a crew of Heroes and one
 * Enemy until one side is defeated, then aggregates many runs.
 *
 * Pure module: every randomised function takes `rng` first and nothing here
 * touches the DOM.  Rule values cite their Corebook page in RULES so the UI can
 * show the assumptions the simulator makes where the book leaves a call to the
 * Director.
 */
import { coin, d6, pick } from './dice.js'
import { analyseActionRoll, conditionPenalty } from './actionRoll.js'
import { isMeleeWeapon } from './gearCatalog.js'

export const RANGES = ['melee', 'close', 'medium', 'long']
export const MAX_ROUNDS = 40
const MAX_GRIT = 12
const BAD_BOX = 8 // p. 85
const HOT_BOX = 12 // p. 85
const LEVELS = { basic: 2, critical: 3, extreme: 4, impossible: 5 }
const LEVEL_NAMES = ['', '', 'Basic', 'Critical', 'Extreme', 'Impossible']
const unitsFor = difficulty => 3 ** (difficulty - 2) // Basic 1, Critical 3, Extreme 9 (p. 69); also the Grit lost on a failed Dangerous Roll (p. 83)
const CONDITION_FOR = { brawn: 'Hurt', nerves: 'Nervous', smooth: 'Like a Fool', focus: 'Distracted', crime: 'Scared' }
const GUNSLINGER_GUNS = ['pistol', 'revolver', 'pistol_silenced', 'machine_pistol']
const MARKSMAN_GUNS = ['rifle', 'shotgun', 'sub_machine_gun', 'machine_gun', 'assault_rifle', 'precision_rifle']
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/** Reaction Roll examples the Director can pick from, Corebook p. 118. */
export const REACTION_ROLLS = [
  { id: 'fists', text: 'The enemies attack you with fists and metal bars', attribute: 'brawn', skill: 'fight' },
  { id: 'shoot', text: 'The enemies shoot at you', attribute: 'brawn', skill: 'stunt' },
  { id: 'crush', text: 'The enemies try to crush or choke you', attribute: 'brawn', skill: 'endure' },
  { id: 'push', text: 'The enemies try to push you to the ground', attribute: 'brawn', skill: 'force' },
  { id: 'throw', text: 'The enemies throw tables and chairs at you', attribute: 'nerves', skill: 'stealth' },
  { id: 'surround', text: 'The enemies try to surround you', attribute: 'nerves', skill: 'awareness' },
]

export const DEFAULT_OPTIONS = {
  runs: 500,
  range: 'medium', // p. 124: "when in doubt, Medium Range"
  firstTurn: 'action', // p. 119: 'action' | 'reaction' | 'coin'
  reaction: 'shoot', // REACTION_ROLLS id or 'random'
  cover: 'none', // 'none' | 'partial' (p. 125)
  badBoxCondition: 'Hurt', // the Director assigns a relevant Condition (p. 91)
  reroll: 'when_needed', // 'when_needed' | 'always' | 'never'
  allIn: 'never', // 'never' | 'desperate'
  adrenaline: 'reactions', // 'never' | 'reactions' | 'always'
  spotlight: 'finish', // 'never' | 'save' | 'finish'
  enemyFeats: true, // the Director may ignore Feats and Special Actions entirely (p. 138)
  tactics: 'spend', // 'spend' | 'hoard' | 'ignore'
}

/** What the simulator decides where the book leaves a call to the table. */
export const RULES = [
  { text: 'Combat alternates Action and Reaction Turns until one side is defeated; every Reaction Roll is a Dangerous Roll with difficulty equal to the Enemy Attack, and every attack needs successes equal to the Enemy Defense.', pageRef: '116-118' },
  { text: 'Each success at the Defense level costs the Enemy 1 Grit; three smaller successes combine into one greater success.', pageRef: '69, 117' },
  { text: 'A failed Dangerous Roll costs 1, 3 or 9 Grit by difficulty; smaller successes do Damage Control, 1 Grit per Basic and 3 per Critical.', pageRef: '83-84' },
  { text: 'Double-difficulty Attacks need two successes; each full success avoids one consequence and leftovers do Damage Control.', pageRef: '66, 123' },
  { text: 'Heroes Re-roll loose dice when short of the needed success, losing the smallest success if the Re-roll is no better. Free Re-rolls are always taken. All In is off unless enabled.', pageRef: '70-71' },
  { text: 'Extra Reaction successes first protect friends who failed, then counter for 1 Grit each.', pageRef: '119' },
  { text: 'Filling the Bad Box gives the chosen Condition; the Hot Box grants 2 Adrenaline; a fourth Condition is Broken.', pageRef: '85, 90' },
  { text: 'A Hero at 0 Grit who would lose more spins the Death Roulette; a friend with a Spotlight always saves them. With the finishing-blow policy a Hero also spends a Spotlight for an automatic Extreme Success when that ends a fight against an Enemy with at least Critical Attack.', pageRef: '77, 96-97' },
  { text: 'A failed shooting roll empties a mag; reloading uses the free Quick Action. Shooting past a friend in Melee is a Gamble at their expense.', pageRef: '126-127' },
  { text: 'Heroes choose the attack with the largest dice pool at their current range, closing one range step per turn when nothing reaches. Guns marked X cannot be used at that range.', pageRef: '105, 124' },
  { text: 'A Jackpot! is treated as taking the Enemy out of the fight.', pageRef: '68' },
  { text: 'Special-Action Reaction Rolls carry only the consequence printed for them, except Grenade, which is a Dangerous Extreme roll. Call for Backup is not simulated.', pageRef: '144-147' },
  { text: 'The Director uses the most expensive affordable Special Action at the start of each Reaction Turn (or hoards for the 3-cost one), and Counter, Parry, I Don’t Think So! and Infamy as they trigger.', pageRef: '139' },
  { text: 'Hero Feats in play: Gunslinger, Marksman, Archer, Knife Thrower, Martial Arts, Flying Kick, Counter, Outsmart, Combo, Hard to Kill, Punch Reload, Too Young to Die.', pageRef: '51-57' },
]

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

const unitsOf = combinations => combinations.reduce((total, item) => total + (item.count >= 6 ? Infinity : unitsFor(item.count)), 0)
const looseDice = dice => { const counts = tally(dice); return dice.filter(die => counts[die] < 2) }
const keptDice = dice => { const counts = tally(dice); return dice.filter(die => counts[die] >= 2) }
const tally = dice => dice.reduce((all, die) => ({ ...all, [die]: (all[die] || 0) + 1 }), {})
const rollDice = (rng, size) => Array.from({ length: size }, () => d6(rng))
const smallestSuccess = combinations => Math.min(...combinations.map(item => item.count >= 6 ? Infinity : unitsFor(item.count)))

/**
 * Roll a pool against a difficulty, applying the Re-roll, Free Re-roll and
 * All In rules (pp. 70-71).  `units` counts successes in Basic units.
 */
export function resolveRoll(rng, { pool, difficulty = 3, count = 1, freeReroll = false, policy = DEFAULT_OPTIONS }) {
  const size = clamp(Math.floor(pool), 2, 9)
  const need = unitsFor(difficulty) * count
  let dice = rollDice(rng, size)
  let analysis = analyseActionRoll(dice, difficulty)
  let units = unitsOf(analysis.combinations)
  const steps = []
  const rerollPolicy = policy.reroll || 'when_needed'
  const canReroll = (freeReroll || units >= 1) && Number.isFinite(units) && looseDice(dice).length > 0
  const wantsReroll = rerollPolicy !== 'never' && (freeReroll || rerollPolicy === 'always' || units < need)
  let better = false
  if (canReroll && wantsReroll) {
    const before = units
    const lost = analysis.combinations.length ? smallestSuccess(analysis.combinations) : 0
    const kept = keptDice(dice)
    dice = [...kept, ...rollDice(rng, dice.length - kept.length)]
    analysis = analyseActionRoll(dice, difficulty)
    units = unitsOf(analysis.combinations)
    if (units > before) { better = true; steps.push(freeReroll ? 'free re-roll improved' : 're-roll improved') }
    else if (freeReroll) { units = before; steps.push('free re-roll, no gain') }
    else { units = before - lost; steps.push('re-roll failed, lost a success') }
    if (better && units < need && policy.allIn === 'desperate' && Number.isFinite(units) && looseDice(dice).length > 0) {
      const beforeAllIn = units
      const keep = keptDice(dice)
      dice = [...keep, ...rollDice(rng, dice.length - keep.length)]
      analysis = analyseActionRoll(dice, difficulty)
      units = unitsOf(analysis.combinations)
      if (units > beforeAllIn) steps.push('all in paid off')
      else { units = 0; steps.push('all in lost everything') }
    }
  }
  const snakeEyes = dice.filter(die => die === 1).length
  return { dice: [...dice].sort((a, b) => a - b), units, need, passed: units >= need, steps, snakeEyes, summary: analysis.summary }
}

// ---------------------------------------------------------------------------
// Fighters
// ---------------------------------------------------------------------------

const coreId = id => String(id).split('__').at(-1)

export function createFighter(hero, options = DEFAULT_OPTIONS) {
  const feats = (hero.feats || []).map(coreId)
  const guns = (hero.gear?.guns || []).map(gun => ({ id: coreId(gun.id), name: gun.name, range: gun.range || {}, mags: gun.mags ?? null }))
  const meleeWeapon = (hero.gear?.items || []).find(item => isMeleeWeapon(item))
  const gritUsed = clamp(Number(hero.resources?.gritUsed || 0), 0, MAX_GRIT)
  return {
    name: hero.personal?.name || 'Hero', role: hero.role, trope: hero.trope,
    attributes: { ...hero.attributes }, skills: { ...hero.skills }, feats, guns, meleeWeapon: meleeWeapon?.name || null,
    grit: MAX_GRIT - gritUsed, conditions: [...(hero.conditions || [])],
    adrenaline: Number(hero.resources?.adrenaline ?? 1), spotlight: Number(hero.resources?.spotlight ?? 1), lethalBullets: Number(hero.resources?.lethalBullets ?? 1),
    range: RANGES.includes(options.range) ? options.range : 'medium', alive: true,
    nextRoll: 0, nextReaction: 0, prone: false, skipAction: false, trapped: false, punchReloadUsed: false, disarmed: [],
    stats: { gritLost: 0, damage: 0, counters: 0, roulette: 0, leftForDead: false, conditions: 0, adrenalineSpent: 0, adrenalineGained: 0, spotlightSpent: 0, magsEmptied: 0, rerolls: 0, attacks: {}, hitZero: false },
  }
}

export function createOpponent(enemy, options = DEFAULT_OPTIONS) {
  const useFeats = options.enemyFeats !== false
  const feats = new Set(useFeats ? (enemy.feats || []).map(feat => feat.id) : [])
  const actions = new Set(useFeats && options.tactics !== 'ignore' ? (enemy.specialActions || []).map(action => action.id) : [])
  return {
    name: enemy.name, type: enemy.type, template: enemy.template, grit: enemy.grit, maxGrit: enemy.grit, hotBoxes: [...enemy.hotBoxes],
    attack: { difficulty: LEVELS[enemy.attack.level] || 3, count: enemy.attack.count || 1 },
    defense: { difficulty: LEVELS[enemy.defense.level] || 3, count: enemy.defense.count || 1 },
    feats, actions, adrenaline: feats.has('rage') ? 1 : 0, gainsAdrenaline: true, medkitUsed: false, used: new Set(), chaos: false, surrounded: false,
    stats: { adrenalineGained: 0, actionsUsed: {}, featsGained: [] },
  }
}

const active = heroes => heroes.filter(hero => hero.alive)
const describeLevel = ({ difficulty, count }) => `${count > 1 ? `${count} ` : ''}${LEVEL_NAMES[difficulty]}`
const heroesDefeated = heroes => active(heroes).every(hero => hero.grit <= 0) // p. 129

// ---------------------------------------------------------------------------
// Grit, Conditions and the Death Roulette
// ---------------------------------------------------------------------------

function addCondition(hero, condition, log) {
  if (hero.conditions.includes('Broken')) return null
  if (hero.conditions.includes(condition)) return null
  const gained = hero.conditions.length >= 3 ? 'Broken' : condition // p. 90
  hero.conditions.push(gained)
  hero.stats.conditions += 1
  log(`${hero.name} looks ${gained}.`)
  return gained
}

function gainAdrenaline(hero, amount, log, why) {
  const gained = Math.min(6, hero.adrenaline + amount) - hero.adrenaline
  hero.adrenaline += gained
  hero.stats.adrenalineGained += gained
  if (gained) log(`${hero.name} gains ${gained} Adrenaline (${why}).`)
}

function spendResource(hero, foe, resource, log, why) {
  hero[resource] -= 1
  hero.stats[resource === 'adrenaline' ? 'adrenalineSpent' : 'spotlightSpent'] += 1
  if (foe.actions.has('infamy') && foe.adrenaline >= 3) { // p. 147
    foe.adrenaline -= 3
    useAction(foe, 'infamy', log, `${foe.name} plays dirty: ${hero.name}'s ${resource === 'adrenaline' ? 'Adrenaline' : 'Spotlight'} is wasted.`)
    return false
  }
  log(`${hero.name} spends 1 ${resource === 'adrenaline' ? 'Adrenaline' : 'Spotlight'} (${why}).`)
  return true
}

function useAction(foe, id, log, text) {
  foe.stats.actionsUsed[id] = (foe.stats.actionsUsed[id] || 0) + 1
  log(text)
}

/** Fill Grit boxes on a Hero (pp. 83-85, 96). Returns the Grit actually lost. */
function loseGrit(rng, hero, amount, context, why) {
  const { foe, options, log } = context
  if (amount <= 0 || !hero.alive) return 0
  if (foe.feats.has('mob')) amount += 1 // p. 140
  if (hero.grit <= 0) { deathRoulette(rng, hero, context, why); return 0 }
  const lost = Math.min(amount, hero.grit)
  const before = MAX_GRIT - hero.grit
  hero.grit -= lost
  hero.stats.gritLost += lost
  const after = MAX_GRIT - hero.grit
  log(`${hero.name} loses ${lost} Grit (${why}), ${hero.grit} left.`)
  if (before < BAD_BOX && after >= BAD_BOX) {
    if (hero.feats.includes('too_young_to_die')) log(`${hero.name} shrugs off the Bad Box (Too Young to Die).`)
    else addCondition(hero, options.badBoxCondition || 'Hurt', log)
    if (hero.feats.includes('hard_to_kill')) { gainAdrenaline(hero, 1, log, 'Hard to Kill'); hero.nextRoll += 1 }
  }
  if (after >= HOT_BOX) { gainAdrenaline(hero, 2, log, 'Hot Box'); hero.stats.hitZero = true }
  return lost
}

function deathRoulette(rng, hero, context, why) {
  const { heroes, foe, options, log } = context
  hero.stats.roulette += 1
  const roll = d6(rng)
  if (roll > hero.lethalBullets) { // p. 96
    hero.lethalBullets = Math.min(6, hero.lethalBullets + 1)
    log(`${hero.name} spins the Death Roulette (${why}): rolls ${roll} against ${hero.lethalBullets - 1} Lethal Bullets and cheats death. Now ${hero.lethalBullets} Lethal Bullets.`)
    return
  }
  const saviour = options.spotlight === 'never' ? null : active(heroes).find(friend => friend !== hero && friend.spotlight > 0)
  if (saviour && spendResource(saviour, foe, 'spotlight', log, `saving ${hero.name}`)) { // p. 97
    hero.lethalBullets = Math.min(6, hero.lethalBullets + 1)
    if (coin(rng) === 0) { hero.spotlight = Math.min(3, hero.spotlight + 1); log(`Tails: ${hero.name} gains a Spotlight.`) }
    log(`${hero.name} rolled ${roll} on the Death Roulette but ${saviour.name} saves them at the last second.`)
    return
  }
  if (saviour) {
    const backup = active(heroes).find(friend => friend !== hero && friend !== saviour && friend.spotlight > 0)
    if (backup && spendResource(backup, foe, 'spotlight', log, `saving ${hero.name}`)) { hero.lethalBullets = Math.min(6, hero.lethalBullets + 1); log(`${backup.name} steps in and saves ${hero.name}.`); return }
  }
  hero.alive = false
  hero.stats.leftForDead = true
  log(`${hero.name} rolls ${roll} on the Death Roulette and is Left for Dead.`)
}

// ---------------------------------------------------------------------------
// Enemy Grit and Special Actions
// ---------------------------------------------------------------------------

function damageEnemy(foe, amount, log, why) {
  if (foe.feats.has('titan')) amount = Math.min(amount, 1) // p. 143
  let dealt = 0
  while (dealt < amount && foe.grit > 0) {
    foe.grit -= 1
    dealt += 1
    const box = foe.maxGrit - foe.grit
    if (foe.hotBoxes.includes(box)) {
      if (foe.gainsAdrenaline) { foe.adrenaline += 1; foe.stats.adrenalineGained += 1; log(`${foe.name} fills a Hot Box and the Director gains 1 Adrenaline.`) }
      if (foe.feats.has('hard_to_kill')) { log(`${foe.name} is Hard to Kill: the blow stops at the Hot Box.`); break }
    }
  }
  if (dealt) log(`${foe.name} loses ${dealt} Grit (${why}), ${foe.grit} left.`)
  if (foe.grit <= 0 && foe.feats.has('medkit') && !foe.medkitUsed) { foe.medkitUsed = true; foe.grit = 1; log(`${foe.name} uses a Medkit and gets back into the fray with 1 Grit.`) }
  return dealt
}

const ACTION_COSTS = { counter: 1, disarm: 1, flashbang: 1, foul_play: 1, grab_and_throw: 1, not_so_fast: 1, pile_on: 1, tackle: 1, call_for_backup: 2, chaos: 2, clamp_down: 2, grenade: 2, parry: 2, surround: 2, threats: 2, weak_spot: 2, final_move: 3, infamy: 3, secret_weapon: 3, to_the_end: 3 }
const PROACTIVE = ['pile_on', 'tackle', 'flashbang', 'foul_play', 'disarm', 'chaos', 'clamp_down', 'grenade', 'surround', 'threats', 'weak_spot', 'final_move', 'secret_weapon', 'to_the_end']
const ONCE = new Set(['chaos', 'surround', 'to_the_end'])

function affordableProactive(foe, heroes) {
  return PROACTIVE.filter(id => foe.actions.has(id) && ACTION_COSTS[id] <= foe.adrenaline && !(ONCE.has(id) && foe.used.has(id)))
    .filter(id => id !== 'disarm' || active(heroes).some(hero => hero.guns.length || hero.meleeWeapon))
    .filter(id => id !== 'to_the_end' || foe.grit < foe.maxGrit)
    .filter(id => id !== 'clamp_down' || active(heroes).some(hero => !hero.trapped))
    .filter(id => foe.grit > 0 || ['pile_on', 'grenade', 'final_move', 'flashbang', 'threats', 'disarm'].includes(id))
    .sort((a, b) => ACTION_COSTS[b] - ACTION_COSTS[a])
}

function checkRoll(rng, hero, foe, attribute, skill, difficulty, options) {
  const pool = hero.attributes[attribute] + skillFor(hero, skill) + conditionPenalty(hero.conditions, attribute) + hero.nextRoll + (hero.prone ? -1 : 0)
  hero.nextRoll = 0
  return resolveRoll(rng, { pool, difficulty, policy: options })
}

/** Director spends Adrenaline at the start of a Reaction Turn (p. 139). Returns 'grenade' when the Enemy throws one instead of attacking. */
function directorSpecialAction(rng, context) {
  const { heroes, foe, options, log } = context
  if (options.tactics === 'ignore' || !foe.actions.size) return null
  const choices = affordableProactive(foe, heroes)
  if (!choices.length) return null
  const bestOwned = Math.max(...[...foe.actions].filter(id => PROACTIVE.includes(id)).map(id => ACTION_COSTS[id]))
  if (options.tactics === 'hoard' && foe.adrenaline < bestOwned && !(foe.grit <= 2)) return null
  const id = choices[0]
  foe.adrenaline -= ACTION_COSTS[id]
  foe.used.add(id)
  const crew = active(heroes)
  const target = pick(rng, crew)
  switch (id) {
    case 'pile_on': { // p. 145
      const weakest = [...crew].sort((a, b) => a.grit - b.grit)[0]
      useAction(foe, id, log, `${foe.name} piles on ${weakest.name}.`)
      if (weakest.grit > 0) loseGrit(rng, weakest, 2, context, 'Pile On')
      else addCondition(weakest, !weakest.conditions.includes('Tired') ? 'Tired' : !weakest.conditions.includes('Hurt') ? 'Hurt' : 'Broken', log)
      return null
    }
    case 'tackle': { useAction(foe, id, log, `${foe.name} tackles ${target.name}.`); const roll = checkRoll(rng, target, foe, 'brawn', 'force', 3, options); if (!roll.passed) { target.nextRoll -= 1; log(`${target.name} loses their footing: −1 to their next roll.`) } return null }
    case 'flashbang': { useAction(foe, id, log, `${foe.name} tosses a Flashbang!`); for (const hero of crew) { const roll = checkRoll(rng, hero, foe, 'nerves', 'awareness', 3, options); if (!roll.passed) { addCondition(hero, 'Distracted', log); hero.nextRoll -= 1 } } return null }
    case 'foul_play': { useAction(foe, id, log, `${foe.name} resorts to Foul Play against ${target.name}.`); const roll = checkRoll(rng, target, foe, 'crime', 'awareness', 3, options); if (!roll.passed) { target.skipAction = true; log(`${target.name} loses their next Action Turn.`) } return null }
    case 'disarm': {
      const armed = crew.filter(hero => hero.guns.length || hero.meleeWeapon)
      const victim = pick(rng, armed)
      useAction(foe, id, log, `${foe.name} tries to disarm ${victim.name}.`)
      const roll = checkRoll(rng, victim, foe, 'brawn', 'dexterity', 3, options)
      if (!roll.passed) { const weapon = victim.guns.length ? victim.guns.shift() : { name: victim.meleeWeapon }; if (!victim.guns.length && weapon.name === victim.meleeWeapon) victim.meleeWeapon = null; victim.disarmed.push(weapon.name); log(`${victim.name} loses their ${weapon.name}.`) }
      return null
    }
    case 'chaos': foe.chaos = true; useAction(foe, id, log, `${foe.name} sows Chaos: Heroes can no longer spend Adrenaline for +1.`); return null
    case 'clamp_down': { useAction(foe, id, log, `${foe.name} clamps down on the Heroes.`); for (const hero of crew.filter(h => !h.trapped)) { const roll = checkRoll(rng, hero, foe, 'brawn', 'stealth', 2, options); if (!roll.passed) { hero.trapped = true; log(`${hero.name} is trapped.`) } } return null }
    case 'grenade': useAction(foe, id, log, `${foe.name} throws a Grenade!`); return 'grenade'
    case 'surround': foe.surrounded = true; useAction(foe, id, log, `${foe.name} surrounds the Heroes: Quick Actions now cost 1 Grit.`); return null
    case 'threats': { useAction(foe, id, log, `${foe.name} makes Threats.`); for (const hero of crew) { const roll = checkRoll(rng, hero, foe, 'nerves', 'cool', 3, options); if (!roll.passed) { if (hero.adrenaline > 0) { hero.adrenaline -= 1; log(`${hero.name} loses 1 Adrenaline.`) } else addCondition(hero, 'Scared', log) } } return null }
    case 'weak_spot': target.nextReaction -= 2; useAction(foe, id, log, `${foe.name} exploits ${target.name}'s weak spot: −2 to their next Reaction Roll.`); return null
    case 'final_move': { useAction(foe, id, log, `${foe.name} unleashes a Final Move on ${target.name}.`); const roll = checkRoll(rng, target, foe, 'brawn', 'fight', 4, options); if (!roll.passed) { if (!target.conditions.includes('Broken')) { target.conditions.push('Broken'); target.stats.conditions += 1 } log(`${target.name} is Broken.`) } return null }
    case 'secret_weapon': { const pool = Object.keys(context.enemyFeats || {}).filter(feat => !foe.feats.has(feat)); if (pool.length) { const gained = pick(rng, pool); foe.feats.add(gained); foe.stats.featsGained.push(gained); if (gained === 'rage') foe.adrenaline += 1; useAction(foe, id, log, `${foe.name} reveals a Secret Weapon: ${context.enemyFeats[gained].name}.`) } return null }
    case 'to_the_end': foe.grit = Math.min(foe.maxGrit, foe.grit + 2); foe.gainsAdrenaline = false; useAction(foe, id, log, `${foe.name} fights To the End: recovers 2 Grit (${foe.grit}) and stops gaining Adrenaline.`); return null
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Hero turns
// ---------------------------------------------------------------------------

const skillFor = (hero, skill) => hero.feats.includes('outsmart') ? Math.max(hero.skills[skill] || 0, hero.skills.know || 0) : hero.skills[skill] || 0
const rangeIndex = range => RANGES.indexOf(range)
const enemyHitPenalty = (hero, foe, ranged) => {
  let penalty = 0
  if (foe.feats.has('armored')) penalty -= 1
  if (ranged && foe.feats.has('bulletproof_vests')) penalty -= 1
  if (!ranged && foe.feats.has('fighters')) penalty -= 1
  if (foe.feats.has('martial_arts') && rangeIndex(hero.range) <= 1 && !hero.feats.includes('martial_arts')) penalty -= 1
  return penalty
}
const gunModifier = (gun, range) => { const raw = String(gun.range?.[range] ?? '0'); if (raw.toUpperCase() === 'X') return null; return { value: Number.parseInt(raw, 10) || 0, gamble: raw.toUpperCase().includes('G') } }

function attackOptions(hero, foe, options) {
  const list = []
  const shared = hero.nextRoll + (hero.prone ? -1 : 0) + (options.cover === 'partial' ? -1 : 0)
  for (const gun of hero.guns) {
    if (gun.mags !== null && gun.mags <= 0) continue
    const modifier = gunModifier(gun, hero.range)
    if (!modifier) continue
    const freeReroll = (hero.feats.includes('gunslinger') && GUNSLINGER_GUNS.includes(gun.id)) || (hero.feats.includes('marksman') && MARKSMAN_GUNS.includes(gun.id)) || (hero.feats.includes('archer') && gun.id === 'bow')
    const bonus = hero.feats.includes('knife_thrower') && gun.id === 'throwing_knives' ? 1 : 0
    const pool = hero.attributes.nerves + skillFor(hero, 'shoot') + conditionPenalty(hero.conditions, 'nerves') + shared + modifier.value + bonus + enemyHitPenalty(hero, foe, true)
    list.push({ kind: 'gun', gun, name: gun.name, pool, freeReroll, gamble: modifier.gamble, ranged: true })
  }
  const flying = hero.feats.includes('flying_kick') && ['close', 'medium'].includes(hero.range)
  if (rangeIndex(hero.range) <= 1 || flying) {
    const freeReroll = hero.feats.includes('martial_arts') && !hero.meleeWeapon
    const pool = hero.attributes.brawn + skillFor(hero, 'fight') + conditionPenalty(hero.conditions, 'brawn') + shared + (flying && hero.range !== 'melee' ? 1 : 0) + enemyHitPenalty(hero, foe, false)
    list.push({ kind: 'melee', name: flying && hero.range !== 'melee' ? 'Flying Kick' : hero.meleeWeapon || 'Fists', pool, freeReroll, gamble: false, ranged: false, closes: hero.range === 'close' })
  }
  return list.sort((a, b) => b.pool - a.pool || Number(b.freeReroll) - Number(a.freeReroll) || (a.kind === 'melee' ? -1 : 1))
}

function quickAction(rng, hero, context, what) { // p. 117, Surround p. 146
  const { foe, log } = context
  if (foe.surrounded) {
    if (hero.grit <= 0) { log(`${hero.name} is surrounded and cannot afford a Quick Action to ${what}.`); return false }
    hero.grit -= 1; hero.stats.gritLost += 1; log(`${hero.name} sacrifices 1 Grit for a Quick Action (surrounded).`)
  }
  return true
}

function heroActionTurn(rng, hero, context) {
  const { heroes, foe, options, log } = context
  if (hero.skipAction) { hero.skipAction = false; log(`${hero.name} loses this Action Turn.`); return }
  if (hero.trapped) { // Clamp Down p. 146
    const roll = checkRoll(rng, hero, foe, 'brawn', 'force', 3, options)
    if (roll.passed) { hero.trapped = false; log(`${hero.name} breaks free.`) } else log(`${hero.name} struggles and stays trapped.`)
    return
  }
  let quickUsed = false
  if (hero.prone && quickAction(rng, hero, context, 'stand up')) { hero.prone = false; quickUsed = true; log(`${hero.name} gets back up.`) }
  let choice = attackOptions(hero, foe, options)[0]
  if (!choice) { // nothing reaches: close the distance (p. 124)
    if (hero.range === 'melee') { log(`${hero.name} has no way to attack.`); return }
    hero.range = RANGES[rangeIndex(hero.range) - 1]
    log(`${hero.name} moves to ${hero.range} range.`)
    return
  }
  if (choice.kind === 'melee' && choice.closes) {
    if (quickUsed || !quickAction(rng, hero, context, 'close in')) { log(`${hero.name} cannot close to Melee this turn.`); return }
    if (foe.feats.has('tactics') && coin(rng) === 1) { log(`${hero.name} tries to close in but ${foe.name} anticipates the move (Tactics); the action is lost.`); return } // p. 141
    hero.range = 'melee'; quickUsed = true
  }
  let units
  let spotlit = false
  const defenseUnits = unitsFor(foe.defense.difficulty) * foe.defense.count
  if (options.spotlight === 'finish' && hero.spotlight > 0 && foe.attack.difficulty >= 3 && Math.min(Math.floor(unitsFor(4) / defenseUnits), foe.feats.has('titan') ? 1 : Infinity) >= foe.grit && spendResource(hero, foe, 'spotlight', log, 'automatic Extreme Success')) { // p. 77
    units = unitsFor(4); spotlit = true
    if (coin(rng) === 0) { hero.spotlight = Math.min(3, hero.spotlight + 1); log(`Tails: ${hero.name} keeps the Spotlight.`) }
  }
  let roll = null
  if (!spotlit) {
    let pool = choice.pool
    if (options.adrenaline === 'always' && hero.adrenaline > 0 && !foe.chaos && spendResource(hero, foe, 'adrenaline', log, '+1 die')) pool += 1
    hero.nextRoll = 0
    roll = resolveRoll(rng, { pool, difficulty: foe.defense.difficulty, count: foe.defense.count, freeReroll: choice.freeReroll, policy: options })
    if (roll.steps.length) hero.stats.rerolls += 1
    units = roll.units
    hero.stats.attacks[choice.name] = (hero.stats.attacks[choice.name] || 0) + 1
    log(`${hero.name} attacks with ${choice.name} (${clamp(pool, 2, 9)} dice vs ${describeLevel(foe.defense)} Defense): ${roll.summary}${roll.steps.length ? ` — ${roll.steps.join(', ')}` : ''}.`)
  } else log(`${hero.name} spends a Spotlight for an automatic Extreme Success with ${choice.name}.`)
  const hits = Number.isFinite(units) ? Math.floor(units / defenseUnits) : foe.grit
  if (!Number.isFinite(units)) log(`Jackpot! ${hero.name} takes ${foe.name} out of the fight.`)
  if (hits > 0) {
    if (foe.actions.has('parry') && foe.adrenaline >= 2 && (hits >= 2 || hits >= foe.grit)) { foe.adrenaline -= 2; useAction(foe, 'parry', log, `${foe.name} parries ${hero.name}'s blow and ignores the Grit loss.`) }
    else {
      const dealt = damageEnemy(foe, hits, log, `${hero.name}'s ${choice.name}`)
      hero.stats.damage += dealt
      if (dealt > 0 && foe.grit > 0 && hero.feats.includes('combo') && hero.adrenaline > 0 && options.adrenaline !== 'never') { // p. 51
        if (foe.actions.has('not_so_fast') && foe.adrenaline >= 1) { foe.adrenaline -= 1; useAction(foe, 'not_so_fast', log, `${foe.name}: "I don't think so!" ${hero.name}'s Combo is stopped.`) }
        else if (spendResource(hero, foe, 'adrenaline', log, 'Combo')) hero.stats.damage += damageEnemy(foe, 1, log, `${hero.name}'s Combo`)
      }
      if (dealt > 0 && foe.grit > 0 && foe.actions.has('counter') && foe.adrenaline >= 1 && (dealt >= 2 || foe.adrenaline >= 2)) { foe.adrenaline -= 1; useAction(foe, 'counter', log, `${foe.name} counters ${hero.name}.`); loseGrit(rng, hero, dealt, context, 'Counter') }
      if (dealt > 0 && foe.grit > 0 && foe.actions.has('grab_and_throw') && foe.adrenaline >= 1 && hero.range === 'melee') { foe.adrenaline -= 1; useAction(foe, 'grab_and_throw', log, `${foe.name} grabs and throws ${hero.name}.`); const check = checkRoll(rng, hero, foe, 'brawn', 'endure', 3, options); if (!check.passed) { hero.prone = true; log(`${hero.name} hits the ground: −1 until they stand up.`) } }
    }
  }
  if (roll && !roll.passed) {
    if (choice.kind === 'gun' && choice.gun.mags !== null) { choice.gun.mags -= 1; hero.stats.magsEmptied += 1; log(`${hero.name} empties a mag${choice.gun.mags > 0 ? ' and will reload' : `; the ${choice.gun.name} is out of mags`}.`) }
    if (foe.feats.has('walking_hazard')) loseGrit(rng, hero, roll.need - roll.units, context, 'Walking Hazard') // p. 141
  }
  if (roll && choice.ranged) { // p. 127
    const bystanders = active(heroes).filter(friend => friend !== hero && friend.range === 'melee')
    if (choice.gamble && roll.snakeEyes) loseGrit(rng, hero, roll.snakeEyes, context, 'explosive Gamble')
    if (roll.snakeEyes) for (const friend of bystanders) loseGrit(rng, friend, roll.snakeEyes, context, `${hero.name}'s stray bullets`)
  }
}

function reactionTurn(rng, context, grenade = false) {
  const { heroes, foe, options, log } = context
  const crew = active(heroes)
  const reaction = grenade ? { text: 'A grenade lands among you', attribute: 'brawn', skill: 'stunt' } : options.reaction === 'random' ? pick(rng, REACTION_ROLLS) : REACTION_ROLLS.find(item => item.id === options.reaction) || REACTION_ROLLS[1]
  const difficulty = grenade ? 4 : foe.attack.difficulty
  const count = grenade ? 1 : foe.attack.count
  const chunk = unitsFor(difficulty)
  const need = chunk * count
  log(`${reaction.text}: react with ${reaction.attribute}+${reaction.skill}, ${count > 1 ? `${count} ` : ''}${LEVEL_NAMES[difficulty]} difficulty.`)
  const results = crew.map(hero => {
    if (hero.trapped) { log(`${hero.name} is trapped and cannot react.`); return { hero, units: 0, roll: null } }
    const usesFight = hero.feats.includes('counter') && !grenade // p. 51
    const attribute = usesFight ? 'brawn' : reaction.attribute
    const skill = usesFight ? 'fight' : reaction.skill
    let pool = hero.attributes[attribute] + skillFor(hero, skill) + conditionPenalty(hero.conditions, attribute) + hero.nextRoll + hero.nextReaction + (hero.prone ? -1 : 0)
    if (options.cover === 'partial' && !foe.feats.has('piercing_bullets')) pool += 1 // p. 125, 143
    if (!usesFight) {
      if (foe.feats.has('martial_arts') && rangeIndex(hero.range) <= 1 && !hero.feats.includes('martial_arts')) pool -= 1
      if (foe.feats.has('shotguns') && hero.range === 'melee') pool -= 1 // p. 143
    }
    hero.nextRoll = 0; hero.nextReaction = 0
    if (options.adrenaline !== 'never' && hero.adrenaline > 0 && !foe.chaos && spendResource(hero, foe, 'adrenaline', log, '+1 die')) pool += 1
    const freeReroll = hero.feats.includes('martial_arts') && skill === 'fight' && !hero.meleeWeapon
    const roll = resolveRoll(rng, { pool, difficulty, count, freeReroll, policy: options })
    if (roll.steps.length) hero.stats.rerolls += 1
    log(`${hero.name} reacts with ${clamp(pool, 2, 9)} dice: ${roll.summary}${roll.steps.length ? ` — ${roll.steps.join(', ')}` : ''}.`)
    return { hero, units: roll.units, roll }
  })
  // Extra successes protect friends, then counter (p. 119)
  const defenseUnits = unitsFor(foe.defense.difficulty) * foe.defense.count
  for (const result of results) {
    if (!Number.isFinite(result.units)) { result.extra = Infinity; continue }
    result.extra = Math.max(0, result.units - need)
  }
  for (const result of results.filter(item => item.extra >= chunk)) {
    for (const friend of results.filter(item => item !== result && item.units < need).sort((a, b) => a.hero.grit - b.hero.grit)) {
      while (result.extra >= chunk && friend.units < need) { result.extra -= chunk; friend.units += chunk; friend.protectedBy = result.hero.name; log(`${result.hero.name} protects ${friend.hero.name} with a spare success.`) }
    }
  }
  if (grenade && results.some(item => item.units >= unitsFor(5))) { // p. 146
    const bouncer = results.find(item => item.units >= unitsFor(5)).hero
    log(`${bouncer.name} bounces the grenade back: ${foe.name} is defeated!`)
    foe.grit = 0
    return
  }
  for (const result of results) {
    if (!grenade && result.extra >= defenseUnits && foe.grit > 0) {
      const counters = Number.isFinite(result.extra) ? Math.floor(result.extra / defenseUnits) : foe.grit
      let dealt = 0
      for (let index = 0; index < counters && foe.grit > 0; index += 1) dealt += damageEnemy(foe, 1, log, `${result.hero.name}'s counter`)
      result.hero.stats.damage += dealt; result.hero.stats.counters += dealt
    }
  }
  for (const result of results) {
    const { hero, units, roll } = result
    if (units >= need) continue
    const loss = difficulty >= 5 ? MAX_GRIT : need - units // Impossible: no Damage Control (p. 84)
    if (roll && !hero.punchReloadUsed && hero.feats.includes('punch_reload')) { hero.punchReloadUsed = true; gainAdrenaline(hero, 1, log, 'Punch Reload') } // p. 55
    loseGrit(rng, hero, loss, context, grenade ? 'grenade' : 'failed Reaction')
    if (!hero.alive || grenade) continue
    if (units < 1 && !hero.conditions.includes('Broken')) { // p. 140
      for (const [feat, condition] of [['automatic_weapons', 'Nervous'], ['heavy_handed', 'Tired'], ['sharp_blades', 'Hurt']]) {
        if (!foe.feats.has(feat)) continue
        if (feat === 'sharp_blades' && hero.meleeWeapon) continue
        if (hero.conditions.includes(condition)) loseGrit(rng, hero, 1, context, feat.replaceAll('_', ' '))
        else addCondition(hero, condition, log)
      }
    }
    if (foe.feats.has('flamethrower') && units < unitsFor(3) && hero.alive) { hero.skipAction = true; log(`${hero.name} is caught by the Flamethrower and will skip the next Action Turn.`) } // p. 143
  }
  if (!grenade && foe.feats.has('explosive_weapons')) for (const result of results) if (result.roll?.snakeEyes && result.hero.alive) loseGrit(rng, result.hero, result.roll.snakeEyes, context, 'explosive Gamble') // p. 143
}

// ---------------------------------------------------------------------------
// One combat
// ---------------------------------------------------------------------------

export function simulateCombat(rng, crew, enemy, options = {}, enemyFeats = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const heroes = crew.map(hero => createFighter(hero, settings))
  const foe = createOpponent(enemy, settings)
  const log = []
  let round = 1
  let turn = 'action'
  const note = text => log.push({ round, turn, text })
  const context = { heroes, foe, options: settings, log: note, enemyFeats }
  let phase = settings.firstTurn === 'coin' ? (coin(rng) ? 'action' : 'reaction') : settings.firstTurn === 'reaction' ? 'reaction' : 'action'
  let winner = null
  note(`${heroes.map(hero => hero.name).join(', ')} face ${foe.name} (${describeLevel(foe.attack)} Attack, ${describeLevel(foe.defense)} Defense, ${foe.grit} Grit) at ${settings.range} range. Combat opens with ${phase === 'action' ? 'an Action' : 'a Reaction'} Turn.`)
  let turns = 0
  while (!winner && turns < MAX_ROUNDS * 2) {
    turn = phase
    if (phase === 'action') {
      for (const hero of active(heroes)) { if (foe.grit > 0) heroActionTurn(rng, hero, context) }
    } else {
      const grenade = directorSpecialAction(rng, context) === 'grenade'
      reactionTurn(rng, context, grenade)
    }
    if (foe.grit <= 0) winner = 'heroes'
    else if (heroesDefeated(heroes)) winner = 'enemy'
    turns += 1
    if (!winner) { phase = phase === 'action' ? 'reaction' : 'action'; if (phase === 'action') round += 1 }
  }
  if (winner === 'heroes' && foe.adrenaline > 0 && foe.hotBoxes.includes(foe.maxGrit) && settings.tactics !== 'ignore') { // Final Blow p. 139
    note(`${foe.name} goes down but their last box was a Hot Box: one final parting gift.`)
    const parting = directorSpecialAction(rng, context)
    if (parting === 'grenade') reactionTurn(rng, context, true)
  }
  if (!winner) winner = 'stalemate'
  note(winner === 'heroes' ? `${foe.name} is defeated after ${round} round${round === 1 ? '' : 's'}.` : winner === 'enemy' ? `The crew is defeated after ${round} round${round === 1 ? '' : 's'}.` : `Combat drags on past ${MAX_ROUNDS} rounds with no result.`)
  return { winner, rounds: round, heroes, foe, log }
}

// ---------------------------------------------------------------------------
// Many combats
// ---------------------------------------------------------------------------

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const percentile = (sorted, fraction) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] : 0

export function verdictFor(rate) {
  if (rate >= 0.9) return { label: 'Pushover', text: 'The crew should walk through this.' }
  if (rate >= 0.7) return { label: 'Fair fight', text: 'A real scrap, but the crew comes out on top most nights.' }
  if (rate >= 0.4) return { label: 'Deadly', text: 'A coin toss with Grit on the line. Expect the Death Roulette.' }
  return { label: 'Overwhelming', text: 'The Enemy wins most of the time. Bring Spotlights or a plan.' }
}

export function runSimulations(rng, crew, enemy, options = {}, enemyFeats = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const runs = clamp(Math.floor(settings.runs), 1, 5000)
  const outcomes = { heroes: 0, enemy: 0, stalemate: 0 }
  const rounds = []
  const heroTotals = crew.map(() => ({ gritLost: [], damage: [], counters: 0, roulette: 0, leftForDead: 0, hitZero: 0, conditions: 0, broken: 0, adrenalineSpent: 0, spotlightSpent: 0, magsEmptied: 0, rerolls: 0, attacks: {} }))
  const enemyTotals = { gritLeftOnWin: [], adrenalineGained: 0, actionsUsed: {}, medkit: 0 }
  let sample = null
  for (let index = 0; index < runs; index += 1) {
    const result = simulateCombat(rng, crew, enemy, settings, enemyFeats)
    if (!sample) sample = result
    outcomes[result.winner] += 1
    rounds.push(result.rounds)
    result.heroes.forEach((hero, position) => {
      const totals = heroTotals[position]
      totals.gritLost.push(hero.stats.gritLost)
      totals.damage.push(hero.stats.damage)
      totals.counters += hero.stats.counters
      totals.roulette += hero.stats.roulette
      totals.leftForDead += hero.stats.leftForDead ? 1 : 0
      totals.hitZero += hero.grit <= 0 || hero.stats.hitZero ? 1 : 0
      totals.conditions += hero.stats.conditions
      totals.broken += hero.conditions.includes('Broken') ? 1 : 0
      totals.adrenalineSpent += hero.stats.adrenalineSpent
      totals.spotlightSpent += hero.stats.spotlightSpent
      totals.magsEmptied += hero.stats.magsEmptied
      totals.rerolls += hero.stats.rerolls
      for (const [name, count] of Object.entries(hero.stats.attacks)) totals.attacks[name] = (totals.attacks[name] || 0) + count
    })
    if (result.winner === 'enemy') enemyTotals.gritLeftOnWin.push(result.foe.grit)
    enemyTotals.adrenalineGained += result.foe.stats.adrenalineGained
    enemyTotals.medkit += result.foe.medkitUsed ? 1 : 0
    for (const [id, count] of Object.entries(result.foe.stats.actionsUsed)) enemyTotals.actionsUsed[id] = (enemyTotals.actionsUsed[id] || 0) + count
  }
  const sortedRounds = [...rounds].sort((a, b) => a - b)
  const totalDamage = heroTotals.reduce((sum, totals) => sum + mean(totals.damage), 0)
  const heroWinRate = outcomes.heroes / runs
  return {
    runs, options: settings, outcomes, heroWinRate, verdict: verdictFor(heroWinRate),
    rounds: { mean: mean(rounds), median: percentile(sortedRounds, 0.5), p10: percentile(sortedRounds, 0.1), p90: percentile(sortedRounds, 0.9), min: sortedRounds[0] || 0, max: sortedRounds.at(-1) || 0 },
    heroes: crew.map((hero, position) => {
      const totals = heroTotals[position]
      const damage = mean(totals.damage)
      return {
        name: hero.personal?.name || 'Hero', role: hero.role, trope: hero.trope,
        gritLost: mean(totals.gritLost), damage, damageShare: totalDamage ? damage / totalDamage : 0, counters: totals.counters / runs,
        hitZeroRate: totals.hitZero / runs, rouletteSpins: totals.roulette / runs, leftForDeadRate: totals.leftForDead / runs,
        conditions: totals.conditions / runs, brokenRate: totals.broken / runs, adrenalineSpent: totals.adrenalineSpent / runs, spotlightSpent: totals.spotlightSpent / runs,
        magsEmptied: totals.magsEmptied / runs, rerolls: totals.rerolls / runs,
        attacks: Object.entries(totals.attacks).map(([name, count]) => ({ name, share: count / Object.values(totals.attacks).reduce((sum, value) => sum + value, 0) })).sort((a, b) => b.share - a.share),
      }
    }),
    enemy: { name: enemy.name, gritLeftOnWin: mean(enemyTotals.gritLeftOnWin), adrenalineGained: enemyTotals.adrenalineGained / runs, medkitRate: enemyTotals.medkit / runs, actionsUsed: Object.entries(enemyTotals.actionsUsed).map(([id, count]) => ({ id, perRun: count / runs })).sort((a, b) => b.perRun - a.perRun) },
    sample,
  }
}

const pct = value => `${Math.round(value * 100)}%`
const fixed = value => (Math.round(value * 10) / 10).toString()
const titled = value => String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export function combatMarkdown(report, data) {
  const heroRows = report.heroes.map(hero => `| ${hero.name} | ${fixed(hero.gritLost)} | ${fixed(hero.damage)} (${pct(hero.damageShare)}) | ${pct(hero.hitZeroRate)} | ${fixed(hero.rouletteSpins)} | ${pct(hero.leftForDeadRate)} |`).join('\n')
  const actions = report.enemy.actionsUsed.map(action => `- ${data?.npc?.actions?.[action.id]?.name || titled(action.id)}: ${fixed(action.perRun)} per fight`).join('\n') || '- None'
  return `## Combat Simulation: ${report.heroes.map(hero => hero.name).join(', ')} vs ${report.enemy.name}\n\n**Verdict:** ${report.verdict.label} — ${report.verdict.text}  \n**Crew wins:** ${pct(report.heroWinRate)} of ${report.runs} fights · **Enemy wins:** ${pct(report.outcomes.enemy / report.runs)}${report.outcomes.stalemate ? ` · **Stalemate:** ${pct(report.outcomes.stalemate / report.runs)}` : ''}  \n**Rounds:** median ${report.rounds.median} (${report.rounds.p10}–${report.rounds.p90} in 80% of fights)\n\n| Hero | Grit lost | Grit dealt | Reached 0 Grit | Roulette spins | Left for Dead |\n| --- | --- | --- | --- | --- | --- |\n${heroRows}\n\n### Enemy\n- Grit left when the Enemy wins: ${fixed(report.enemy.gritLeftOnWin)}\n- Director Adrenaline per fight: ${fixed(report.enemy.adrenalineGained)}\n\n### Special Actions used\n${actions}`
}
