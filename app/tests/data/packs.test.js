import {describe,expect,it} from 'vitest'
import {contentPacks,gameData} from '../../src/data.js'
import {mergePacks} from '../../src/packData.js'
import {generateRandom} from '../../src/engine/hero.js'
import {makeRng} from '../../src/engine/dice.js'
import {validateHero} from '../../src/engine/validate.js'

describe('content packs',()=>{
  it('exposes verified genre catalogs without id collisions',()=>{for(const pack of contentPacks){expect(Object.keys(pack.roles).length,pack.id).toBeGreaterThan(0);expect(Object.keys(pack.tropes).length,pack.id).toBeGreaterThan(0);for(const role of Object.values(pack.roles))for(const feat of role.feats)expect(pack.feats[feat]||gameData.feats.feats[feat],`${pack.id}: ${feat}`).toBeTruthy()}})
  it('generates valid heroes from every enabled genre',()=>{for(const pack of contentPacks){const data=mergePacks(gameData,contentPacks,[pack.id]),roleIds=Object.keys(pack.roles);for(let seed=0;seed<Math.max(100,roleIds.length*10);seed++){const role=roleIds[seed%roleIds.length];let hero;try{hero=generateRandom(makeRng(seed),data,{role})}catch(error){throw new Error(`${pack.id}/${role}/${seed}: ${error.message}`)}expect(validateHero(hero,data),`${pack.id}/${role}/${seed}`).toEqual([])}}})
  it('combines every enabled pack',()=>{const data=mergePacks(gameData,contentPacks,contentPacks.map(pack=>pack.id));expect(Object.keys(data.roles.roles).length).toBe(10+contentPacks.reduce((n,p)=>n+Object.keys(p.roles).length,0));expect(Object.keys(data.tropes.tropes).length).toBe(18+contentPacks.reduce((n,p)=>n+Object.keys(p.tropes).length,0))})
  it('preserves repeatable Feat rules',()=>{const data=mergePacks(gameData,contentPacks,['superheroes']);expect(data.feats.feats.superheroes__energy_manipulation).toMatchObject({repeatable:true,maxRanks:2});expect(data.feats.feats.superheroes__gadget.repeatable).toBe(true);expect(data.feats.feats.superheroes__sonic_boom.maxRanks).toBe(2)})
  it('includes complete special-role and Action Flick catalogs',()=>{const superheroes=contentPacks.find(pack=>pack.id==='superheroes'),supplements=contentPacks.find(pack=>pack.id==='supplements');expect(Object.keys(superheroes.roles)).toHaveLength(17);expect(superheroes.roles).toHaveProperty('superheroes__marvel');expect(superheroes.roles).toHaveProperty('superheroes__prodigy');expect(supplements.roles).toHaveProperty('supplements__time_traveler');expect(supplements.roles).toHaveProperty('supplements__power_guardian');expect(supplements.roles).toHaveProperty('supplements__the_one');expect(supplements.tropes).toHaveProperty('supplements__great_hero');expect(supplements.tropes).toHaveProperty('supplements__final_girl');expect(Object.keys(supplements.tags)).toHaveLength(17)})
})
