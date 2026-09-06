import { encodeHero } from './share.js'

const title = value => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const dots = (value, max = 3) => `${'●'.repeat(Math.max(0, Number(value) || 0))}${'○'.repeat(Math.max(0, max - (Number(value) || 0)))}`
const nameOf = (catalog, id) => catalog?.[id]?.name || title(id || '—')

export function heroMarkdown(hero, data = {}) {
  const attributes = Object.entries(hero.attributes || {}).map(([id, value]) => `- **${title(id)}:** ${dots(value)} (${value})`).join('\n')
  const skills = Object.entries(hero.skills || {}).map(([id, value]) => `- **${title(id)}:** ${dots(value)} (${value})`).join('\n')
  const feats = (hero.feats || []).map(id => `- ${nameOf(data.feats?.feats, id)}`).join('\n') || '- —'
  const guns = (hero.gear?.guns || []).map(item => `- ${item.name || nameOf(data.gear?.gear, item.id)} — ${item.mags ?? 0} Mags`).join('\n') || '- —'
  const gear = (hero.gear?.items || []).map(item => `- ${item.name || nameOf(data.gear?.gear, item.id)}${item.bag ? ' (in bag)' : ''}`).join('\n') || '- —'
  const experiences = (hero.experiences || []).map(value => `- ${value}`).join('\n') || '- —'
  const resources = hero.resources || {}
  return `# ${hero.personal?.name || 'Unnamed Hero'}

> Outgunned character · portable sheet format v1

**Role:** ${nameOf(data.roles?.roles, hero.role)}  
**Trope:** ${nameOf(data.tropes?.tropes, hero.trope || hero.roleTrope)}  
**Job:** ${hero.personal?.job || '—'}  
**Age:** ${hero.personal?.age || '—'}  
**Catchphrase:** ${hero.personal?.catchphrase || '—'}  
**Flaw:** ${hero.personal?.flaw || '—'}

## Attributes

${attributes}

## Skills

${skills}

## Feats

${feats}

## Resources

- **Grit used:** ${resources.gritUsed || 0} / 12
- **Adrenaline:** ${resources.adrenaline || 0} / 6
- **Spotlight:** ${resources.spotlight || 0} / 3
- **Cash:** ${resources.cash || 0} / 5
- **Death Roulette:** ${resources.lethalBullets || 0} / 6

## Guns

${guns}

## Gear

${gear}

## Ride

${hero.gear?.ride?.name || '—'}

## Current Mission

${hero.mission || '—'}

## Conditions

${(hero.conditions || []).join(', ') || '—'}

## Experiences

${experiences}

<!-- OUTGUNNED_CHARACTER_V1:${encodeHero(hero).slice(3)} -->
`
}

export function parseHeroMarkdown(markdown) {
  const match = /<!--\s*OUTGUNNED_CHARACTER_V1:([A-Za-z0-9_-]+)\s*-->/.exec(String(markdown || ''))
  if (!match) throw new Error('This Markdown file does not contain an Outgunned character payload.')
  try {
    const encoded = match[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(match[1].length / 4) * 4, '=')
    const hero = JSON.parse(decodeURIComponent(escape(atob(encoded))))
    if (!hero || typeof hero !== 'object' || !hero.personal || !hero.attributes || !hero.skills) throw new Error('Incomplete character')
    return hero
  } catch (error) {
    throw new Error(`Could not read the embedded Outgunned character: ${error.message}`)
  }
}
