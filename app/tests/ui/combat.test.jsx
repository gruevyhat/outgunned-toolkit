import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { gameData } from '../../src/data.js'
import { makeRng } from '../../src/engine/dice.js'
import { generateCrew } from '../../src/engine/crew.js'
import { generateEnemy } from '../../src/engine/npc.js'
import { runSimulations } from '../../src/engine/combat.js'
import Menu from '../../src/ui/screens/Menu.jsx'
import CombatSim, { CombatReport } from '../../src/ui/screens/CombatSim.jsx'

describe('Combat Simulator screen', () => {
  it('is available from the toolkit menu', () => expect(renderToString(<Menu onSelectMode={() => {}} />)).toContain('Combat Simulator'))

  it('invites the user to assemble a crew when none exists', () => {
    const html = renderToString(<CombatSim data={gameData} onBack={() => {}} />)
    expect(html).toContain('Combat Simulator')
    expect(html).toContain('No crew yet')
    expect(html).toContain('Enemy type')
    expect(html).toContain('Starting range')
    expect(html).toContain('Director tactics')
    expect(html).toContain('disabled=""')
    expect(html).toContain('How the simulator reads the rules')
  })

  it('summarises each crew member with their combat pools', () => {
    const crew = generateCrew(makeRng(4), gameData, 3)
    const html = renderToString(<CombatSim data={gameData} onBack={() => {}} crew={crew} />)
    for (const hero of crew) expect(html).toContain(hero.personal.name)
    expect(html).toContain('Shoot')
    expect(html).toContain('Fight')
    expect(html).toContain(`aria-label="Reroll ${crew[0].personal.name}"`)
    expect(html).not.toContain('No crew yet')
  })

  it('renders a full report with verdict, outcome bar, hero table and log teaser', () => {
    const crew = generateCrew(makeRng(4), gameData, 3)
    const enemy = generateEnemy(makeRng(2), gameData, { type: 'bad_guys', template: 3, theme: 'crime' })
    const report = { seed: 1, ...runSimulations(makeRng(1), crew, enemy, { runs: 50 }, gameData.npc.feats) }
    const html = renderToString(<CombatReport report={report} data={gameData} />)
    expect(html).toContain(report.verdict.label)
    expect(html).toContain('Crew win rate')
    expect(html).toContain('combat-bar-')
    expect(html).toContain('Hero by hero')
    for (const hero of crew) expect(html).toContain(hero.personal.name)
    expect(html).toContain('Roulette spins')
    expect(html).toContain('Show the log')
    expect(html).toMatch(/Seed(<!-- -->)? ?(<!-- -->)?1</)
  })
})
