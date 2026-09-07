import { describe, expect, it } from 'vitest'
import { gameData } from '../../src/data.js'
import { makeRng } from '../../src/engine/dice.js'
import { generateAlly, generateEnemy, npcMarkdown, validateEnemy } from '../../src/engine/npc.js'

describe('NPC generator', () => {
  it('generates valid themed enemies within their Feat budget', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const enemy = generateEnemy(makeRng(seed), gameData, { heat: seed % 13 })
      expect(validateEnemy(enemy, gameData), `seed ${seed}`).toEqual([])
      expect(enemy.feats.reduce((sum, feat) => sum + feat.cost, 0)).toBe(enemy.featBudget)
      expect(enemy.feats.every(feat => feat.themes.includes(enemy.theme) || feat.themes.includes('any'))).toBe(true)
    }
  })

  it('honors enemy controls and solo double-difficulty handling', () => {
    const enemy = generateEnemy(makeRng(2), gameData, { type: 'bad_guys', template: 4, theme: 'military', heat: 9, solo: true })
    expect(enemy).toMatchObject({ type: 'bad_guys', template: 4, theme: 'military', themeName: 'Military', featBudget: 4 })
    expect(enemy.attack.count).toBe(1)
    expect(enemy.hotBoxes).toEqual([4, 8])
  })

  it('supports every type, template, theme, and Heat combination', () => {
    const types = ['goons', 'bad_guys', 'boss']
    const themes = Object.keys(gameData.npc.themes)
    for (const type of types) for (let template = 1; template <= 5; template += 1) for (const theme of themes) for (const heat of [0, 12]) {
      const enemy = generateEnemy(makeRng(`${type}-${template}-${theme}-${heat}`), gameData, { type, template, theme, heat })
      expect(validateEnemy(enemy, gameData), `${type} ${template} ${theme} Heat ${heat}`).toEqual([])
      expect(enemy.feats.reduce((sum, feat) => sum + feat.cost, 0)).toBe(enemy.featBudget)
      expect(enemy.specialActions.every(action => action && action.cost <= enemy.hotBoxes.length)).toBe(true)
    }
  })

  it('keeps Cannon Fodder Feat-free even at high Heat', () => {
    const enemy = generateEnemy(makeRng(3), gameData, { cannonFodder: true, heat: 12 })
    expect(enemy).toMatchObject({ type: 'cannon_fodder', featBudget: 0, feats: [], specialActions: [] })
  })

  it('generates supporting characters inside their limits', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const ally = generateAlly(makeRng(seed), gameData)
      expect(ally.grit).toBe(3)
      expect(ally.extraPoints).toBeGreaterThanOrEqual(1)
      expect(ally.extraPoints).toBeLessThanOrEqual(6)
      expect(Object.values(ally.attributes).every(value => value >= 3 && value <= 5)).toBe(true)
      expect(Object.values(ally.attributes).reduce((sum, value) => sum + value, 0)).toBe(15 + ally.extraPoints)
    }
  })

  it('formats portable enemy and ally cards', () => {
    expect(npcMarkdown(generateEnemy(makeRng(4), gameData), gameData)).toContain('## Enemy')
    expect(npcMarkdown(generateAlly(makeRng(4), gameData), gameData)).toContain('## Supporting Character')
  })
})
