import React, { useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { generateCrew } from '../../engine/crew.js'
import { generateRandom } from '../../engine/hero.js'
import { generateEnemy } from '../../engine/npc.js'
import { combatMarkdown, DEFAULT_OPTIONS, RANGES, REACTION_ROLLS, RULES, runSimulations } from '../../engine/combat.js'
import { EnemyCard } from './NpcGenerator.jsx'

const TYPES = [['goons', 'Goons'], ['bad_guys', 'Bad Guys'], ['boss', 'Boss'], ['cannon_fodder', 'Cannon Fodder']]
const RUNS = [100, 500, 2000]
const title = value => String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const pct = value => `${Math.round(value * 100)}%`
const fixed = value => (Math.round(value * 10) / 10).toString()
const CONTROLS = {
  range: ['Starting range', RANGES.map(range => [range, title(range)])],
  firstTurn: ['Opening turn', [['action', 'Heroes act first'], ['reaction', 'Enemy acts first'], ['coin', 'Flip a coin']]],
  reaction: ['Reaction Roll', [...REACTION_ROLLS.map(item => [item.id, `${title(item.attribute)}+${title(item.skill)} · ${item.text}`]), ['random', 'Random each turn']]],
  cover: ['Cover', [['none', 'No cover'], ['partial', 'Partial cover (+1 React, −1 Act)']]],
  badBoxCondition: ['Bad Box Condition', [['Hurt', 'Hurt (−1 Brawn)'], ['Tired', 'Tired (no penalty)'], ['Nervous', 'Nervous (−1 Nerves)'], ['Scared', 'Scared (−1 Crime)']]],
  runs: ['Fights to simulate', RUNS.map(value => [value, String(value)])],
  reroll: ['Re-roll habit', [['when_needed', 'Re-roll when short'], ['always', 'Always re-roll'], ['never', 'Never re-roll']]],
  allIn: ['All In', [['never', 'Never'], ['desperate', 'When still short after a Re-roll']]],
  adrenaline: ['Adrenaline', [['reactions', '+1 die on Reactions'], ['always', '+1 die on every roll'], ['never', 'Save it']]],
  spotlight: ['Spotlight', [['finish', 'Save friends and land finishing blows'], ['save', 'Only save friends'], ['never', 'Never spend']]],
  tactics: ['Director tactics', [['spend', 'Spend Adrenaline as it comes'], ['hoard', 'Hoard for the big move'], ['ignore', 'No Special Actions']]],
}

export default function CombatSim({ data, onBack, crew = [], onCrewChange }) {
  const [size, setSize] = useState(Math.max(2, crew.length || 3))
  const [enemyConfig, setEnemyConfig] = useState({ type: 'bad_guys', template: 2, theme: 'military', heat: 0, solo: false })
  const [enemy, setEnemy] = useState(() => generateEnemy(makeRng(Date.now()), data, { type: 'bad_guys', template: 2, theme: 'military' }))
  const [options, setOptions] = useState({ ...DEFAULT_OPTIONS })
  const [report, setReport] = useState(null)
  const [copied, setCopied] = useState(false)

  const setCrew = next => onCrewChange?.(next)
  const assemble = () => { setCrew(generateCrew(makeRng(Date.now()), data, size)); setReport(null) }
  const rerollMember = index => { setCrew(crew.map((hero, position) => position === index ? generateRandom(makeRng(Date.now()), data, { role: hero.role, mode: 'crew' }) : hero)); setReport(null) }
  const removeMember = index => { setCrew(crew.filter((_, position) => position !== index)); setReport(null) }
  const updateEnemy = change => { const next = { ...enemyConfig, ...change }; setEnemyConfig(next); setEnemy(generateEnemy(makeRng(Date.now()), data, next)); setReport(null) }
  const rollEnemy = () => { const next = generateEnemy(makeRng(Date.now()), data, { phase: 'shot', heat: enemyConfig.heat, solo: enemyConfig.solo }); setEnemyConfig(current => ({ ...current, type: next.type, template: next.template, theme: next.theme })); setEnemy(next); setReport(null) }
  const rerollEnemyName = () => { const fresh = generateEnemy(makeRng(Date.now()), data, enemyConfig); setEnemy(current => ({ ...current, name: fresh.name, descriptor: fresh.descriptor })) }
  const setOption = (key, value) => { setOptions(current => ({ ...current, [key]: value })); setReport(null) }
  const run = () => { if (!crew.length) return; const seed = Date.now(); setReport({ seed, ...runSimulations(makeRng(seed), crew, enemy, options, data.npc.feats) }) }
  const copy = async () => { if (!report || !globalThis.navigator?.clipboard) return; await navigator.clipboard.writeText(combatMarkdown(report, data)); setCopied(true); window.setTimeout(() => setCopied(false), 1400) }

  return <main className="panel combat-page">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Run the numbers</p><h1>Combat Simulator</h1><p className="npc-intro">Pit a crew against an Enemy, play the fight out hundreds of times by the Corebook rules, and see who is left standing.</p></div></div>

    <div className="combat-grid">
      <section className="combat-side" aria-labelledby="combat-crew-title">
        <div className="combat-side-header"><h2 id="combat-crew-title">The crew</h2><div className="size-picker" aria-label="Crew size">{[2, 3, 4, 5].map(value => <button key={value} type="button" aria-pressed={size === value} className={size === value ? 'selected' : ''} onClick={() => setSize(value)}>{value}</button>)}</div><button className="primary" type="button" onClick={assemble}>{crew.length ? '↻ New random crew' : 'Assemble random crew'}</button></div>
        {crew.length ? <div className="combat-crew">{crew.map((hero, index) => <HeroSummary key={`${hero.role}-${index}`} hero={hero} data={data} onReroll={() => rerollMember(index)} onRemove={() => removeMember(index)} />)}</div> : <div className="empty-state"><h2>No crew yet</h2><p>Assemble a random crew here, or build one under Assemble a Crew and add heroes from their sheets.</p></div>}
      </section>

      <section className="combat-side" aria-labelledby="combat-enemy-title">
        <div className="combat-side-header"><h2 id="combat-enemy-title">The Enemy</h2><button className="primary" type="button" onClick={rollEnemy}>↻ Roll enemy</button></div>
        <div className="npc-controls combat-enemy-controls" aria-label="Enemy controls">
          <label>Enemy type<select value={enemyConfig.type} onChange={event => updateEnemy({ type: event.target.value })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Template<select value={enemyConfig.type === 'cannon_fodder' ? '' : enemyConfig.template} disabled={enemyConfig.type === 'cannon_fodder'} onChange={event => updateEnemy({ template: Number(event.target.value) })}>{enemyConfig.type === 'cannon_fodder' ? <option value="">Not used</option> : [1, 2, 3, 4, 5].map(value => <option key={value} value={value}>Template {value}</option>)}</select></label>
          <label>Theme<select value={enemyConfig.theme} onChange={event => updateEnemy({ theme: event.target.value })}>{Object.entries(data.npc.themes).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}</select></label>
          <label>Heat<select value={enemyConfig.heat} onChange={event => updateEnemy({ heat: Number(event.target.value) })}>{Array.from({ length: 13 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="npc-check"><input type="checkbox" checked={enemyConfig.solo} onChange={event => updateEnemy({ solo: event.target.checked })} /><span>Solo rules</span></label>
          <label className="npc-check"><input type="checkbox" checked={options.enemyFeats} onChange={event => setOption('enemyFeats', event.target.checked)} /><span>Use Feats &amp; Special Actions</span></label>
        </div>
        <EnemyCard enemy={enemy} onRerollName={rerollEnemyName} />
      </section>
    </div>

    <section className="combat-scenario" aria-labelledby="combat-scenario-title">
      <h2 id="combat-scenario-title">The scene</h2>
      <div className="combat-options">
        {['range', 'firstTurn', 'reaction', 'cover', 'badBoxCondition', 'runs'].map(key => <OptionSelect key={key} id={key} value={options[key]} onChange={setOption} />)}
      </div>
      <h3>How the table plays</h3>
      <div className="combat-options">
        {['reroll', 'allIn', 'adrenaline', 'spotlight', 'tactics'].map(key => <OptionSelect key={key} id={key} value={options[key]} onChange={setOption} />)}
      </div>
      <div className="npc-actions"><button className="primary combat-run" type="button" onClick={run} disabled={!crew.length}>▶ Run {options.runs} fights</button>{report && <button type="button" onClick={copy}>{copied ? 'Copied!' : 'Copy Markdown'}</button>}</div>
    </section>

    {report ? <CombatReport report={report} data={data} /> : null}

    <details className="combat-assumptions"><summary>How the simulator reads the rules</summary><ul>{RULES.map(rule => <li key={rule.pageRef + rule.text.slice(0, 12)}>{rule.text} <small>Corebook p. {rule.pageRef}</small></li>)}</ul></details>
  </main>
}

function OptionSelect({ id, value, onChange }) {
  const [label, choices] = CONTROLS[id]
  return <label>{label}<select value={value} onChange={event => onChange(id, typeof choices[0][0] === 'number' ? Number(event.target.value) : event.target.value)}>{choices.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}

function HeroSummary({ hero, data, onReroll, onRemove }) {
  const { attributes: a, skills: s } = hero
  const guns = hero.gear?.guns || []
  const used = Number(hero.resources?.gritUsed || 0)
  return <article className="hero-card combat-hero">
    <div className="combat-hero-head"><div><h3>{hero.personal.name}</h3><small>{data.roles.roles[hero.role]?.name || title(hero.role)} · {data.tropes.tropes[hero.trope]?.name || title(hero.trope)}</small></div><div className="actions"><button type="button" className="roll-button" aria-label={`Reroll ${hero.personal.name}`} title="Reroll this hero" onClick={onReroll}>↻</button><button type="button" className="roll-button" aria-label={`Remove ${hero.personal.name}`} title="Remove from crew" onClick={onRemove}>×</button></div></div>
    <div className="combat-hero-pools"><span><b>{a.nerves + s.shoot}</b> Shoot</span><span><b>{a.brawn + s.fight}</b> Fight</span><span><b>{a.brawn + s.stunt}</b> Stunt</span><span><b>{12 - used}</b> Grit</span><span><b>{hero.resources?.adrenaline ?? 1}</b> Adr.</span><span><b>{hero.resources?.spotlight ?? 1}</b> Spot.</span></div>
    <small className="combat-hero-gear">{guns.length ? guns.map(gun => `${gun.name}${gun.mags != null ? ` (${gun.mags} mags)` : ''}`).join(' · ') : 'No guns'}{(hero.conditions || []).length ? ` · ${hero.conditions.join(', ')}` : ''}</small>
  </article>
}

export function CombatReport({ report, data }) {
  const [showLog, setShowLog] = useState(false)
  const outcomes = [['heroes', 'Crew wins', report.outcomes.heroes], ['enemy', 'Enemy wins', report.outcomes.enemy], ['stalemate', 'No result', report.outcomes.stalemate]].filter(([, , count]) => count > 0)
  return <section className="combat-report" aria-labelledby="combat-report-title">
    <div className={`combat-verdict combat-verdict-${report.verdict.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <small>Verdict after {report.runs} fights</small>
      <h2 id="combat-report-title">{report.verdict.label}</h2>
      <p>{report.verdict.text}</p>
    </div>
    <div className="combat-bar" role="img" aria-label={outcomes.map(([, label, count]) => `${label} ${pct(count / report.runs)}`).join(', ')}>{outcomes.map(([key, label, count]) => <span key={key} className={`combat-bar-${key}`} style={{ flexGrow: count }}>{label} {pct(count / report.runs)}</span>)}</div>
    <div className="combat-stat-row">
      <Stat label="Crew win rate" value={pct(report.heroWinRate)} />
      <Stat label="Rounds (median)" value={String(report.rounds.median)} note={`${report.rounds.p10}–${report.rounds.p90} in 80% of fights`} />
      <Stat label="Director Adrenaline" value={fixed(report.enemy.adrenalineGained)} note="per fight" />
      <Stat label="Enemy Grit left on a loss" value={report.outcomes.enemy ? fixed(report.enemy.gritLeftOnWin) : '—'} note={report.outcomes.enemy ? `of ${report.sample.foe.maxGrit}` : 'the Enemy never won'} />
    </div>

    <h3>Hero by hero</h3>
    <div className="table-wrap"><table className="combat-table">
      <thead><tr><th>Hero</th><th>Grit lost</th><th>Grit dealt</th><th>Reached 0 Grit</th><th>Roulette spins</th><th>Left for Dead</th><th>Conditions</th><th>Adrenaline spent</th><th>Spotlights spent</th><th>Mags emptied</th><th>Favourite attack</th></tr></thead>
      <tbody>{report.heroes.map(hero => <tr key={hero.name}>
        <th scope="row">{hero.name}<small>{data.roles.roles[hero.role]?.name || title(hero.role)}</small></th>
        <td>{fixed(hero.gritLost)}</td>
        <td>{fixed(hero.damage)} <small>{pct(hero.damageShare)}</small></td>
        <td>{pct(hero.hitZeroRate)}</td>
        <td>{fixed(hero.rouletteSpins)}</td>
        <td className={hero.leftForDeadRate >= 0.1 ? 'is-danger' : ''}>{pct(hero.leftForDeadRate)}</td>
        <td>{fixed(hero.conditions)}{hero.brokenRate >= 0.05 ? <small>Broken {pct(hero.brokenRate)}</small> : null}</td>
        <td>{fixed(hero.adrenalineSpent)}</td>
        <td>{fixed(hero.spotlightSpent)}</td>
        <td>{fixed(hero.magsEmptied)}</td>
        <td>{hero.attacks[0] ? `${hero.attacks[0].name} ${pct(hero.attacks[0].share)}` : '—'}</td>
      </tr>)}</tbody>
    </table></div>

    {report.enemy.actionsUsed.length ? <><h3>Special Actions the Director used</h3><ul className="combat-actions">{report.enemy.actionsUsed.map(action => <li key={action.id}><strong>{data.npc.actions[action.id]?.name || title(action.id)}</strong> {fixed(action.perRun)} per fight</li>)}</ul></> : null}

    <div className="combat-log-header"><h3>One fight, blow by blow</h3><button type="button" className="link" aria-expanded={showLog} onClick={() => setShowLog(current => !current)}>{showLog ? 'Hide the log' : 'Show the log'}</button></div>
    {showLog ? <ol className="combat-log">{report.sample.log.map((line, index) => <li key={index} className={`combat-log-${line.turn}`}><span>R{line.round} {line.turn === 'action' ? 'Action' : 'Reaction'}</span>{line.text}</li>)}</ol> : <p className="combat-log-teaser">{report.sample.log.at(-1).text} <small>Seed {report.seed}</small></p>}
  </section>
}

function Stat({ label, value, note }) { return <div className="combat-stat"><small>{label}</small><strong>{value}</strong>{note ? <span>{note}</span> : null}</div> }
