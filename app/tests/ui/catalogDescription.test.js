import {describe,expect,it} from 'vitest'
import {contentPacks,gameData} from '../../src/data.js'
import {catalogDescription} from '../../src/ui/catalogDescription.js'

describe('guided catalog descriptions',()=>{
  it('provides a blurb for every Role and Trope',()=>{
    const catalogs=[gameData.roles.roles,gameData.tropes.tropes,...contentPacks.flatMap(pack=>[pack.roles,pack.tropes])]
    for(const catalog of catalogs)for(const [id,item] of Object.entries(catalog))expect(catalogDescription(item),id).toBeTruthy()
  })

  it('gives every guided Role an authored description',()=>{
    const roles=[...Object.values(gameData.roles.roles),...contentPacks.flatMap(pack=>Object.values(pack.roles))]
    for(const role of roles)expect(role.tagline||role.blurb||role.summary,role.name).toBeTruthy()
  })

  it('normalizes all-caps taglines to sentence case',()=>{
    expect(catalogDescription(gameData.roles.roles.commando)).toBe('Strong. Well trained. Unstoppable.')
  })

  it('uses authored summaries and curated supplement blurbs',()=>{
    const armored=contentPacks.find(pack=>pack.id==='superheroes').roles.superheroes__armored
    const starRaider=contentPacks.find(pack=>pack.id==='supplements').roles.supplements__star_raider
    expect(catalogDescription(armored)).toBe(armored.summary)
    expect(catalogDescription(starRaider)).toBe('A daring space pilot, smuggler, or captain who lives for freedom among the stars.')
  })
})
