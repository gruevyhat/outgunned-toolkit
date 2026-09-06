import {describe,expect,it} from 'vitest'
import {analyseActionRoll,rollAction} from '../../src/engine/actionRoll.js'

describe('action rolls',()=>{
  it('limits pools to the rules range',()=>{expect(rollAction({attribute:0,skill:0,modifier:-3},()=>0).pool).toBe(2);expect(rollAction({attribute:6,skill:6,modifier:3},()=>0).pool).toBe(9)})
  it('recognizes success levels and difficulty',()=>{expect(analyseActionRoll([1,1,2,3],2)).toMatchObject({passed:true,summary:'Basic Success'});expect(analyseActionRoll([4,4,4,2],3)).toMatchObject({passed:true,summary:'Critical Success'});expect(analyseActionRoll([6,6,6,6,6,6],5)).toMatchObject({passed:true,summary:'Jackpot!'})})
  it('combines three smaller successes into the next level',()=>{expect(analyseActionRoll([1,1,2,2,3,3],3).passed).toBe(true);expect(analyseActionRoll([1,2,3,4],2)).toMatchObject({passed:false,summary:'No Success'})})
})
