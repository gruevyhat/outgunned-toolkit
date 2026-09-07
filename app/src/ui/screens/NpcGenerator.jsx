import React, { useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { generateAlly, generateEnemy, npcMarkdown } from '../../engine/npc.js'

const TYPES = [
  ['goons', 'Goons'],
  ['bad_guys', 'Bad Guys'],
  ['boss', 'Boss'],
  ['cannon_fodder', 'Cannon Fodder'],
]
const PHASES = [
  ['establishing', 'Establishing'],
  ['shot', 'Shot'],
  ['turning_point', 'Turning Point'],
  ['showdown', 'Showdown'],
]
const ATTRIBUTES = ['brawn', 'nerves', 'smooth', 'focus', 'crime']
const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const score = value => `${value.count > 1 ? `${value.count} ` : ''}${title(value.level)}`

export default function NpcGenerator({ data, onBack }) {
  const [tab, setTab] = useState('enemy')
  const [copied, setCopied] = useState(false)
  const [enemyConfig, setEnemyConfig] = useState({ type: 'bad_guys', template: 2, theme: 'military', phase: 'shot', heat: 0, solo: false })
  const [enemy, setEnemy] = useState(() => generateEnemy(makeRng(Date.now()), data, enemyConfig))
  const helpOptions = data.missionTables.tables.help.rows.map(row => row.help)
  const flawOptions = data.missionTables.tables.flaw.rows.map(row => row.flaw)
  const [allyConfig, setAllyConfig] = useState({ help: helpOptions[0], flaw: flawOptions[0], extraPoints: 3 })
  const [ally, setAlly] = useState(() => generateAlly(makeRng(Date.now() + 1), data, allyConfig))

  const updateEnemy = change => {
    const next = { ...enemyConfig, ...change }
    setEnemyConfig(next)
    setEnemy(generateEnemy(makeRng(Date.now()), data, next))
  }
  const updateAlly = change => {
    const next = { ...allyConfig, ...change }
    setAllyConfig(next)
    setAlly(generateAlly(makeRng(Date.now()), data, next))
  }
  const rollEnemy = () => {
    const nextEnemy = generateEnemy(makeRng(Date.now()), data, { phase: enemyConfig.phase, heat: enemyConfig.heat, solo: enemyConfig.solo })
    setEnemyConfig(current => ({ ...current, type: nextEnemy.type, template: nextEnemy.template, theme: nextEnemy.theme }))
    setEnemy(nextEnemy)
  }
  const rollAlly = () => {
    const nextAlly = generateAlly(makeRng(Date.now()), data)
    setAllyConfig({ help: nextAlly.help, flaw: nextAlly.flaw, extraPoints: nextAlly.extraPoints })
    setAlly(nextAlly)
  }
  const rollCannonFodder = () => {
    const next = { ...enemyConfig, type: 'cannon_fodder' }
    setEnemyConfig(next)
    setEnemy(generateEnemy(makeRng(Date.now()), data, next))
  }
  const copy = async npc => {
    await navigator.clipboard.writeText(npcMarkdown(npc, data))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  const rerollEnemyName = () => {
    const fresh = generateEnemy(makeRng(Date.now()), data, enemyConfig)
    setEnemy(current => ({ ...current, name: fresh.name, descriptor: fresh.descriptor }))
  }
  const rerollAllyName = () => {
    const fresh = generateAlly(makeRng(Date.now()), data, allyConfig)
    setAlly(current => ({ ...current, name: fresh.name }))
  }

  return <main className="panel npc-page">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Cast the opposition</p><h1>NPC Generator</h1><p className="npc-intro">Build a themed Enemy or a Supporting Character ready for the next scene.</p></div></div>

    <div className="npc-tabs" role="tablist" aria-label="NPC type">
      <button type="button" role="tab" aria-selected={tab === 'enemy'} className={tab === 'enemy' ? 'selected' : ''} onClick={() => setTab('enemy')}>Enemy</button>
      <button type="button" role="tab" aria-selected={tab === 'ally'} className={tab === 'ally' ? 'selected' : ''} onClick={() => setTab('ally')}>Supporting Character</button>
    </div>

    {tab === 'enemy' ? <>
      <section className="npc-controls" aria-label="Enemy controls">
        <label>Enemy type<select value={enemyConfig.type} onChange={event => updateEnemy({ type: event.target.value })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Template<select value={enemyConfig.type === 'cannon_fodder' ? '' : enemyConfig.template} disabled={enemyConfig.type === 'cannon_fodder'} onChange={event => updateEnemy({ template: Number(event.target.value) })}>{enemyConfig.type === 'cannon_fodder' ? <option value="">Not used</option> : [1, 2, 3, 4, 5].map(value => <option key={value} value={value}>Template {value}</option>)}</select></label>
        <label>Theme<select value={enemyConfig.theme} onChange={event => updateEnemy({ theme: event.target.value })}>{Object.entries(data.npc.themes).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}</select></label>
        <label>Campaign phase<select value={enemyConfig.phase} onChange={event => updateEnemy({ phase: event.target.value })}>{PHASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Heat<select value={enemyConfig.heat} onChange={event => updateEnemy({ heat: Number(event.target.value) })}>{Array.from({ length: 13 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="npc-check"><input type="checkbox" checked={enemyConfig.solo} onChange={event => updateEnemy({ solo: event.target.checked })} /><span>Solo rules</span></label>
      </section>
      <div className="npc-actions"><button className="primary" onClick={rollEnemy}>↻ Roll everything</button><button onClick={rollCannonFodder}>Cannon Fodder</button><button onClick={() => copy(enemy)}>{copied ? 'Copied!' : 'Copy Markdown'}</button></div>
      <EnemyCard enemy={enemy} onRerollName={rerollEnemyName} />
    </> : <>
      <section className="npc-controls npc-ally-controls" aria-label="Supporting Character controls">
        <label>Help<select value={allyConfig.help} onChange={event => updateAlly({ help: event.target.value })}>{helpOptions.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Flaw<select value={allyConfig.flaw} onChange={event => updateAlly({ flaw: event.target.value })}>{flawOptions.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Extra Attribute points<select value={allyConfig.extraPoints} onChange={event => updateAlly({ extraPoints: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value}>{value}</option>)}</select></label>
      </section>
      <div className="npc-actions"><button className="primary" onClick={rollAlly}>↻ Roll everything</button><button onClick={() => copy(ally)}>{copied ? 'Copied!' : 'Copy Markdown'}</button></div>
      <AllyCard ally={ally} onRerollName={rerollAllyName} />
    </>}
  </main>
}

function EnemyCard({ enemy, onRerollName }) {
  return <article className="npc-card enemy-card">
    <header><div><small>{title(enemy.type)} · {enemy.template ? `Template ${enemy.template}` : 'Fast opposition'} · {enemy.themeName || title(enemy.theme)}</small><h2>{enemy.name}</h2><p>{enemy.descriptor}.</p></div><button className="roll-button" aria-label="Reroll enemy name and description" title="Reroll name and description" onClick={onRerollName}>↻</button></header>
    <div className="enemy-stat-row"><Stat label="Attack" value={score(enemy.attack)} /><Stat label="Defense" value={score(enemy.defense)} /><Stat label="Feat budget" value={`${enemy.feats.reduce((sum, feat) => sum + feat.cost, 0)} / ${enemy.featBudget}`} /></div>
    <section><h3>Grit · {enemy.grit}</h3><div className="enemy-grit" aria-label={`${enemy.grit} Grit; Hot Boxes ${enemy.hotBoxes.join(', ') || 'none'}`}>{Array.from({ length: enemy.grit }, (_, index) => <span key={index} className={enemy.hotBoxes.includes(index + 1) ? 'is-hot' : ''}>{enemy.hotBoxes.includes(index + 1) ? '◆' : ''}</span>)}</div><small className="npc-rule-note">Hot Boxes: {enemy.hotBoxes.join(', ') || 'none'}</small></section>
    <NpcList title="Enemy Feats" items={enemy.feats} empty="No Feats — fast and disposable." />
    <NpcList title="Special Actions" items={enemy.specialActions} empty="No Special Actions." />
  </article>
}

function AllyCard({ ally, onRerollName }) {
  return <article className="npc-card ally-card">
    <header><div><small>Supporting Character · 3 Grit</small><h2>{ally.name}</h2></div><button className="roll-button" aria-label="Reroll Supporting Character name" title="Reroll name" onClick={onRerollName}>↻</button></header>
    <div className="ally-hooks"><p><strong>Help</strong>{ally.help}</p><p><strong>Flaw</strong>{ally.flaw}</p></div>
    <section><h3>Attributes · {ally.extraPoints} extra {ally.extraPoints === 1 ? 'point' : 'points'}</h3><div className="ally-attributes">{ATTRIBUTES.map(attribute => <div key={attribute}><span>{title(attribute)}</span><strong>{ally.attributes[attribute]}</strong></div>)}</div></section>
  </article>
}

function Stat({ label, value }) { return <div><small>{label}</small><strong>{value}</strong></div> }
function NpcList({ title: heading, items, empty }) { return <section><h3>{heading}</h3>{items.length ? <div className="npc-list">{items.map(item => <article key={item.id}><div><strong>{item.name}</strong><b>{item.cost}</b></div><p>{item.summary}</p></article>)}</div> : <p className="npc-empty">{empty}</p>}</section> }
