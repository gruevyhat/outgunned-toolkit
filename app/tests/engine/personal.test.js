import {describe,expect,it} from 'vitest'
import {gameData,contentPacks} from '../../src/data.js'
import {makeRng} from '../../src/engine/dice.js'
import {personalOptions,randomPersonalValue} from '../../src/engine/personal.js'
import {mergePacks} from '../../src/packData.js'

describe('guided personal-data randomizers',()=>{
  it('uses authored Role options and the selected Trope quote',()=>{
    const role=gameData.roles.roles.commando,trope=gameData.tropes.tropes.bad_to_the_bone
    expect(personalOptions('job',{role,trope})).toEqual(expect.arrayContaining(role.jobs))
    expect(personalOptions('catchphrase',{role,trope})).toEqual(expect.arrayContaining([...role.catchphrases,trope.quote]))
    expect(personalOptions('flaw',{role,trope})).toEqual(role.flaws)
  })
  it('provides contextual fallbacks when a supplement has no personal tables',()=>{
    const data=mergePacks(gameData,contentPacks,['supplements']),role=data.roles.roles.supplements__samurai,trope=data.tropes.tropes.supplements__great_hero
    expect(randomPersonalValue('catchphrase',{data,role,trope,attributes:['brawn','nerves']},makeRng(3))).not.toBe('')
    expect(randomPersonalValue('flaw',{data,role,trope,attributes:['brawn','nerves']},makeRng(3))).not.toBe('')
  })
  it('generates a complete name and avoids an identical option when possible',()=>{
    const first=randomPersonalValue('name',{data:gameData},makeRng(8))
    expect(first).toMatch(/^\S+\s+\S+$/)
    expect(randomPersonalValue('name',{data:gameData,current:first},makeRng(8))).not.toBe(first)
  })
})
