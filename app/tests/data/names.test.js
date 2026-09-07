import {describe,expect,it} from 'vitest'
import {gameData} from '../../src/data.js'

describe('random name catalog',()=>{
  it('provides broad, clean first-name and surname pools',()=>{
    for(const names of [gameData.names.firstNames,gameData.names.surnames]){
      expect(names.length).toBeGreaterThanOrEqual(140)
      expect(new Set(names).size).toBe(names.length)
      expect(names.every(name=>typeof name==='string'&&name===name.trim()&&name.length>1)).toBe(true)
    }
  })
})
