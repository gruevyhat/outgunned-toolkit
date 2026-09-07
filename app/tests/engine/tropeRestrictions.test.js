import {describe,expect,it} from 'vitest'
import {contentPacks,gameData} from '../../src/data.js'
import {generateRandom} from '../../src/engine/hero.js'
import {makeRng} from '../../src/engine/dice.js'
import {availableTropes} from '../../src/engine/tropes.js'
import {mergePacks} from '../../src/packData.js'

const data=mergePacks(gameData,contentPacks,['supplements'])
const commando=data.roles.roles.commando
const guardian=data.roles.roles.supplements__power_guardian
const red='supplements__red'

describe('Role-specific Tropes',()=>{
  it('hides Color Tropes from ordinary Roles and ordinary Trope slots',()=>{
    expect(availableTropes(data.tropes.tropes,commando)).not.toHaveProperty(red)
    expect(availableTropes(data.tropes.tropes,guardian)).not.toHaveProperty(red)
  })

  it('offers Color Tropes only in the Power Guardian Role slot',()=>{
    expect(availableTropes(data.tropes.tropes,guardian,'role')).toHaveProperty(red)
    expect(availableTropes(data.tropes.tropes,commando,'role')).not.toHaveProperty(red)
  })

  it('rejects a Color Trope on an ordinary Hero',()=>{
    expect(()=>generateRandom(makeRng(4),data,{role:'commando',trope:red})).toThrow('not available to this Role')
  })
})
