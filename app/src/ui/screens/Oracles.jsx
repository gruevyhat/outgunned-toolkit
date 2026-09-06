import React, { useMemo, useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { rollTable } from '../../engine/mission.js'

const CATEGORY_RULES = [
  ['Story', /thematic|general_clues|mission_generator|scene_drama|yes_no|scene_prompts|turning_point/],
  ['People', /villain_generator|help|flaw|unisex_names/],
  ['Places', /locations|store|skyscraper|world_region|desert_jungle/],
  ['Danger', /hurdle|climax|strong_spots|weak_spots/],
  ['Campaign', /campaign_phases|macguffin/],
]
const title = id => id.replaceAll('_', ' ')
export const formatOracleValue = value => {
  if (Array.isArray(value)) return value.map((item, index) => {
    if (item && typeof item === 'object') return `${index + 1}. ${item.name || `Phase ${index + 1}`} — ${[item.shots, item.purpose].filter(Boolean).join(': ')}`
    return String(item)
  }).join('\n')
  if (value && typeof value === 'object') return Object.values(value).map(formatOracleValue).join(' / ')
  return String(value ?? '—')
}

export default function Oracles({ data, onBack }) {
  const [log, setLog] = useState([])
  const [query, setQuery] = useState('')
  const ids = Object.keys(data.missionTables.tables)
  const groups = useMemo(() => CATEGORY_RULES.map(([name, pattern]) => [name, ids.filter(id => pattern.test(id) && title(id).includes(query.toLowerCase()))]).filter(([, values]) => values.length), [data, query])
  const run = id => {
    const result = rollTable(makeRng(Date.now()), data.missionTables, id)
    const value = Object.entries(result.row).filter(([key]) => key !== 'roll').map(([, item]) => formatOracleValue(item)).join(' / ')
    setLog(current => [{ id, roll: Array.isArray(result.roll) ? result.roll.join(', ') : result.roll, value }, ...current].slice(0, 30))
  }
  const current = log[0]

  return <main className="panel">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Instant inspiration</p><h1>Oracles</h1></div></div>
    <input className="oracle-search" aria-label="Search oracles" placeholder="Find an oracle…" value={query} onChange={event => setQuery(event.target.value.toLowerCase())} />

    {current && <section className="oracle-current"><small>{title(current.id)} · roll {current.roll}</small><strong>{current.value}</strong></section>}

    {groups.map(([name, values]) => <section className="oracle-section" key={name}><h2>{name}</h2><div className="oracle-grid">{values.map(id => <button key={id} onClick={() => run(id)}>↻ {title(id)}</button>)}</div></section>)}

    {log.length > 1 && <section className="log"><div className="log-header"><h2>Recent rolls</h2><button className="link" onClick={() => setLog(current ? [current] : [])}>Clear history</button></div>{log.slice(1).map((item, index) => <p key={`${item.id}-${index}`}><strong>{title(item.id)} [{item.roll}]</strong><br />{item.value}</p>)}</section>}
  </main>
}
