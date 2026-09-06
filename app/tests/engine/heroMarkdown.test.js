import {describe,expect,it} from 'vitest'
import {gameData} from '../../src/data.js'
import {makeRng} from '../../src/engine/dice.js'
import {generateRandom} from '../../src/engine/hero.js'
import {heroMarkdown,parseHeroMarkdown} from '../../src/engine/heroMarkdown.js'

describe('character Markdown',()=>{
  it('is readable and round-trips the complete working character',()=>{
    const hero=generateRandom(makeRng(41),gameData)
    hero.mission='Stop the runaway train'
    hero.experiences=['The Vienna Job']
    hero.resources.gritUsed=4
    const markdown=heroMarkdown(hero,gameData)
    expect(markdown).toContain(`# ${hero.personal.name}`)
    expect(markdown).toContain('## Attributes')
    expect(markdown).toContain('**Death Roulette:**')
    expect(parseHeroMarkdown(markdown)).toEqual(hero)
  })

  it('rejects ordinary Markdown without an embedded character',()=>{
    expect(()=>parseHeroMarkdown('# Just some notes')).toThrow(/does not contain an Outgunned character/)
  })
})
