import { d6, pick, shuffle } from './dice.js'

const ATTRIBUTES = ['brawn', 'nerves', 'smooth', 'focus', 'crime']
const PHASE_TYPES = {
  establishing: ['goons', 'goons', 'goons', 'bad_guys'],
  shot: ['goons', 'bad_guys', 'bad_guys'],
  turning_point: ['bad_guys', 'bad_guys', 'boss'],
  showdown: ['boss', 'boss', 'bad_guys'],
}

const HELP_WEIGHTS = {
  Bouncer: ['brawn', 'nerves'], Boxer: ['brawn', 'nerves'], 'Martial Arts Teacher': ['brawn', 'focus'], 'Military Vet': ['nerves', 'brawn'],
  Hacker: ['focus', 'crime'], Detective: ['focus', 'crime'], Nurse: ['focus', 'smooth'], Professor: ['focus', 'smooth'], Reporter: ['focus', 'smooth'],
  Patron: ['smooth', 'focus'], Salesperson: ['smooth', 'crime'], Socialite: ['smooth', 'nerves'], 'Public Servant': ['smooth', 'focus'],
  Pilot: ['nerves', 'focus'], 'Taxi Driver': ['nerves', 'crime'], Thief: ['crime', 'nerves'], 'Ex-Con': ['crime', 'brawn'], Cop: ['nerves', 'crime'],
}

const titled = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const matchesTheme = (item, theme) => item.themes.includes(theme) || item.themes.includes('any')
const withIds = records => Object.entries(records).map(([id, value]) => ({ id, ...value }))

function spendBudget(rng, records, budget, theme) {
  const candidates = shuffle(rng, withIds(records).filter(item => matchesTheme(item, theme)))
  const search = (remaining, start) => {
    if (remaining === 0) return []
    for (let index = start; index < candidates.length; index += 1) {
      const item = candidates[index]
      if (item.cost > remaining) continue
      const rest = search(remaining - item.cost, index + 1)
      if (rest) return [item, ...rest]
    }
    return null
  }
  return search(budget, 0) || []
}

function themedActions(rng, data, theme, hotBoxes) {
  const maximumCost = Math.min(3, hotBoxes.length)
  const actions = withIds(data.npc.actions).filter(item => matchesTheme(item, theme))
  return Array.from({ length: maximumCost }, (_, index) => pick(rng, actions.filter(item => item.cost === index + 1)))
}

export function generateEnemy(rng, data, options = {}) {
  const themes = Object.keys(data.npc.themes)
  const theme = options.theme || pick(rng, themes)
  const phase = options.phase || 'shot'
  const type = options.cannonFodder ? 'cannon_fodder' : options.type || pick(rng, PHASE_TYPES[phase] || PHASE_TYPES.shot)
  const template = type === 'cannon_fodder' ? 0 : Number(options.template || Math.floor(rng() * 5) + 1)
  const templateId = type === 'cannon_fodder' ? 'cannon_fodder' : `${type}_${template}`
  const base = data.npc.templates[templateId]
  if (!base) throw new Error(`Unknown enemy template: ${templateId}`)
  const themeData = data.npc.themes[theme]
  const featBudget = base.featPoints + (type !== 'cannon_fodder' && Number(options.heat || 0) >= 9 ? 1 : 0)
  const feats = spendBudget(rng, data.npc.feats, featBudget, theme)
  const specialActions = type === 'goons' || type === 'cannon_fodder' ? [] : themedActions(rng, data, theme, base.hotBoxes)
  const attack = { ...base.attack, count: options.solo ? 1 : base.attack.count }
  const defense = { ...base.defense, count: options.solo ? 1 : base.defense.count }
  return {
    kind: 'enemy',
    name: options.name || `${pick(rng, themeData.adjectives)} ${pick(rng, themeData.nouns)}`,
    descriptor: options.descriptor || pick(rng, themeData.descriptors),
    type, template, templateId, theme, themeName: themeData.name, phase, heat: Number(options.heat || 0), solo: Boolean(options.solo),
    grit: base.grit, hotBoxes: [...base.hotBoxes], attack, defense, featBudget, feats, specialActions,
  }
}

export function validateEnemy(enemy, data) {
  const errors = []
  const template = data.npc.templates[enemy.templateId]
  if (!template) errors.push('Unknown template')
  if (!data.npc.themes[enemy.theme]) errors.push('Unknown theme')
  const spent = enemy.feats.reduce((sum, feat) => sum + feat.cost, 0)
  if (spent > enemy.featBudget) errors.push('Feat budget exceeded')
  if (enemy.feats.some(feat => !data.npc.feats[feat.id])) errors.push('Unknown Feat')
  if (enemy.specialActions.some(action => !data.npc.actions[action.id])) errors.push('Unknown Special Action')
  if ((enemy.type === 'goons' || enemy.type === 'cannon_fodder') && enemy.specialActions.length) errors.push('Goons cannot have Special Actions')
  if (enemy.hotBoxes.some(box => box < 1 || box > enemy.grit)) errors.push('Invalid Hot Box')
  return errors
}

export function generateAlly(rng, data, options = {}) {
  const helpRows = data.missionTables.tables.help.rows
  const flawRows = data.missionTables.tables.flaw.rows
  const help = options.help || pick(rng, helpRows).help
  const flaw = options.flaw || pick(rng, flawRows).flaw
  const extraPoints = Math.max(1, Math.min(6, Number(options.extraPoints || d6(rng))))
  const attributes = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, 3]))
  const preferred = HELP_WEIGHTS[help] || ATTRIBUTES
  for (let point = 0; point < extraPoints; point += 1) {
    const available = preferred.filter(attribute => attributes[attribute] < 5)
    const fallback = ATTRIBUTES.filter(attribute => attributes[attribute] < 5)
    attributes[pick(rng, available.length ? available : fallback)] += 1
  }
  return {
    kind: 'ally',
    name: options.name || `${pick(rng, data.names.firstNames)} ${pick(rng, data.names.surnames)}`,
    help, flaw, grit: 3, attributes, extraPoints,
  }
}

const score = value => `${value.count > 1 ? `${value.count} ` : ''}${titled(value.level)}`

export function npcMarkdown(npc) {
  if (npc.kind === 'ally') return `## Supporting Character: ${npc.name}\n\n**Help:** ${npc.help}  \n**Flaw:** ${npc.flaw}  \n**Grit:** ${npc.grit}  \n**Attributes:** ${ATTRIBUTES.map(attribute => `${titled(attribute)} ${npc.attributes[attribute]}`).join(' · ')}`
  const feats = npc.feats.length ? npc.feats.map(feat => `- ${feat.name} (${feat.cost}): ${feat.summary}`).join('\n') : '- None'
  const actions = npc.specialActions.length ? npc.specialActions.map(action => `- ${action.name} (${action.cost}): ${action.summary}`).join('\n') : '- None'
  return `## Enemy: ${npc.name}\n\n${npc.descriptor}.  \n**Type:** ${titled(npc.type)} · Template ${npc.template || 'Cannon Fodder'} · Theme ${npc.themeName || titled(npc.theme)}  \n**Grit:** ${npc.grit} · Hot Boxes ${npc.hotBoxes.join(', ') || 'none'}  \n**Attack:** ${score(npc.attack)} · **Defense:** ${score(npc.defense)}\n\n### Feats\n${feats}\n\n### Special Actions\n${actions}`
}
