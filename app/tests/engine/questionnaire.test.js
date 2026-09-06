import { describe, expect, it } from 'vitest'
import { score } from '../../src/engine/questionnaire.js'

describe('questionnaire scoring', () => {
  it('scores enabled-book Tropes on the same universal profile as Corebook Tropes', () => {
    const profile = { attributes: ['focus', 'nerves'], skills: ['fix', 'shoot'] }
    const data = {
      roles: { roles: { core_role: { name: 'Core Role', attribute: 'focus', skills: ['fix'] }, pack_role: { name: 'Pack Role', attribute: 'focus', skills: ['fix'], packId: 'pack', packName: 'Extra Book' } } },
      tropes: { tropes: { core_trope: { name: 'Core Trope', ...profile }, pack_trope: { name: 'Pack Trope', ...profile, packId: 'pack', packName: 'Extra Book' } } },
    }
    const result = score([{ weights: { 'skill:fix': 2, 'attr:focus': 1, 'trope:core_trope': 5 } }], data)
    expect(result.tropes.find(value => value.id === 'core_trope').score).toBe(result.tropes.find(value => value.id === 'pack_trope').score)
    expect(result.roles.find(value => value.id === 'pack_role').source).toBe('Extra Book')
    expect(result.tropes.find(value => value.id === 'pack_trope').source).toBe('Extra Book')
  })
})
