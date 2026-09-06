import {describe,expect,it} from 'vitest'
import {PDFDocument} from 'pdf-lib'
import {gameData} from '../../src/data.js'
import {makeRng} from '../../src/engine/dice.js'
import {generateRandom} from '../../src/engine/hero.js'
import {drawHeroSheet,SHEET_LAYOUT} from '../../src/pdf/heroSheet.js'
import johnny from '../fixtures/johnny-reed.json'

describe('hero PDF',()=>{
  it('renders seeded heroes to one landscape Letter page',async()=>{for(let seed=0;seed<50;seed++){const bytes=await drawHeroSheet(generateRandom(makeRng(seed),gameData),gameData);expect(bytes).toBeInstanceOf(Uint8Array);const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(1);expect(pdf.getPage(0).getSize()).toEqual(SHEET_LAYOUT.page)}})
  it('renders the cited Johnny Reed fixture with the active-play story strip',async()=>{const hero=generateRandom(makeRng(19),gameData,johnny.pins);hero.mission='Recover the prototype';hero.experiences=['The Jakarta Extraction'];hero.conditions=['Hurt'];expect(hero.personal.name).toBe('Johnny Reed');expect(hero.feats).toEqual(['gunslinger','hard_to_kill','selfless']);expect(SHEET_LAYOUT.story.h).toBeGreaterThan(0);const bytes=await drawHeroSheet(hero,gameData);expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)})
})
