import {describe,expect,it} from 'vitest'
import {contentPacks,gameData} from '../../src/data.js'
import {catalogDescription} from '../../src/ui/catalogDescription.js'

describe('guided catalog descriptions',()=>{
  it('provides a blurb for every Role and Trope',()=>{
    const catalogs=[gameData.roles.roles,gameData.tropes.tropes,...contentPacks.flatMap(pack=>[pack.roles,pack.tropes])]
    for(const catalog of catalogs)for(const [id,item] of Object.entries(catalog))expect(catalogDescription(item),id).toBeTruthy()
  })

  it('uses authored summaries and specific fallbacks',()=>{
    const armored=contentPacks.find(pack=>pack.id==='superheroes').roles.superheroes__armored
    const starRaider=contentPacks.find(pack=>pack.id==='supplements').roles.supplements__star_raider
    expect(catalogDescription(armored)).toBe(armored.summary)
    expect(catalogDescription(starRaider)).toContain('Star Raider driven by Nerves')
  })
})
