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

  it('keeps the clipped all-caps Role tagline style',()=>{
    expect(catalogDescription(gameData.roles.roles.commando)).toBe('STRONG. WELL TRAINED. UNSTOPPABLE.')
    const roles=contentPacks.flatMap(pack=>Object.values(pack.roles))
    for(const role of roles){const description=catalogDescription(role);expect(description,role.name).toBe(description.toUpperCase());expect(description.match(/\./g)?.length,role.name).toBeGreaterThanOrEqual(3)}
  })

  it('renders Trope descriptions as clipped all-caps taglines',()=>{
    expect(catalogDescription(gameData.tropes.tropes.bad_to_the_bone)).toBe('DANGEROUS. ARROGANT TROUBLEMAKER. MAY STILL CHOOSE TO DO THE RIGHT THING.')
    const catalogs=[gameData.tropes.tropes,...contentPacks.map(pack=>pack.tropes)]
    for(const trope of catalogs.flatMap(catalog=>Object.values(catalog))){const description=catalogDescription(trope);expect(description,trope.name).toBe(description.toUpperCase())}
  })

  it('uses curated clipped taglines for expansion Roles',()=>{
    const armored=contentPacks.find(pack=>pack.id==='superheroes').roles.superheroes__armored
    const starRaider=contentPacks.find(pack=>pack.id==='supplements').roles.supplements__star_raider
    expect(catalogDescription(armored)).toBe('ARMORED. HIGH-TECH. ALWAYS PREPARED.')
    expect(catalogDescription(starRaider)).toBe('DARING PILOT. FREEDOM SEEKER. AT HOME AMONG THE STARS.')
  })
})
