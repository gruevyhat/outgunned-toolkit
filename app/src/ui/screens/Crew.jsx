import React, { useState } from 'react'
import { generateCrew } from '../../engine/crew.js'
import { generateRandom } from '../../engine/hero.js'
import { makeRng } from '../../engine/dice.js'
import { drawHeroSheet } from '../../pdf/heroSheet.js'
import HeroSheet from './HeroSheet.jsx'

export default function Crew({ data, onBack, initial = [], onChange }) {
  const [size, setSize] = useState(Math.max(2, initial.length || 3))
  const [crew, setCrewState] = useState(initial)
  const setCrew = update => setCrewState(current => { const next = typeof update === 'function' ? update(current) : update; onChange?.(next); return next })
  const [open, setOpen] = useState(null)
  const build = () => setCrew(generateCrew(makeRng(Date.now()), data, size))
  const reroll = index => setCrew(current => current.map((hero, position) => position === index ? generateRandom(makeRng(Date.now()), data, { role: hero.role, mode: 'crew' }) : hero))
  const updateMember = hero => setCrew(current => current.map((member, index) => index === open ? hero : member))
  const exportAll = async () => {
    for (const hero of crew) {
      const bytes = await drawHeroSheet(hero, data)
      const link = document.createElement('a')
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      link.href = url
      link.download = `${hero.personal.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  if (open != null) return <HeroSheet hero={crew[open]} data={data} onHome={onBack} onWorkingChange={updateMember} onNew={() => reroll(open)} />

  return <main className="panel">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Team builder</p><h1>Assemble a Crew</h1></div>{crew.length > 0 && <button onClick={exportAll}>Export {crew.length} PDFs</button>}</div>
    <div className="crew-toolbar">
      <div><strong>Crew size</strong><div className="size-picker">{[2, 3, 4, 5].map(value => <button key={value} aria-pressed={size === value} className={size === value ? 'selected' : ''} onClick={() => setSize(value)}>{value}</button>)}</div></div>
      <button className="primary" onClick={build}>{crew.length ? 'Reassemble crew' : 'Assemble crew'}</button>
    </div>
    {crew.length ? <div className="card-grid">{crew.map((hero, index) => {
      const best = Object.entries(hero.attributes).filter(([, value]) => value === 3).map(([attribute]) => attribute).slice(0, 2)
      return <article className="hero-card" key={`${hero.role}-${index}`}>
        <span className="card-number">Hero {String(index + 1).padStart(2, '0')}</span>
        <h2>{hero.personal.name}</h2>
        <div className="hero-tags"><span>{data.roles.roles[hero.role].name}</span><span>{data.tropes.tropes[hero.trope].name}</span></div>
        <small>Best at {best.join(' + ') || 'making trouble'}</small>
        <div className="actions"><button className="primary" onClick={() => setOpen(index)}>Open sheet</button><button onClick={() => reroll(index)}>↻ Reroll</button></div>
      </article>
    })}</div> : <div className="empty-state"><h2>Your crew is waiting</h2><p>Choose a size and assemble a team with distinct Roles.</p></div>}
  </main>
}
