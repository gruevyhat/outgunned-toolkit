import {describe,expect,it} from 'vitest'
import {isMeleeWeapon,isRangedWeapon,isWeapon,usesMags,weaponModifier} from '../../src/engine/gearCatalog.js'

describe('gear catalog classification',()=>{
  it('recognizes weapon types used by every book line',()=>{
    expect(isRangedWeapon({kind:'firearm'})).toBe(true)
    expect(isRangedWeapon({kind:'gadget_energy_weapon'})).toBe(true)
    expect(isMeleeWeapon({kind:'gadget_melee_weapon'})).toBe(true)
    expect(isRangedWeapon({kind:'weapon',features:['single_shot']})).toBe(true)
    expect(isMeleeWeapon({kind:'weapon',features:['sharp']})).toBe(true)
    expect(isWeapon({kind:'tool'})).toBe(false)
  })

  it('handles ammo and abstract weapon modifiers',()=>{
    expect(usesMags({kind:'firearm'})).toBe(true)
    expect(usesMags({kind:'gun',features:['single_shot']})).toBe(false)
    expect(usesMags({kind:'energy_weapon'})).toBe(false)
    expect(weaponModifier({kind:'ranged_weapon',modifier:1})).toBe(1)
    expect(weaponModifier({kind:'firearm',features:['shoot_plus_1']})).toBe(1)
  })
})
