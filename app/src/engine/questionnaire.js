import { shuffle } from './dice.js'
import { isTropeAvailableToRole } from './tropes.js'
export const drawQuestions=(rng,bank,n)=>shuffle(rng,bank.questions).slice(0,n)
export function score(answers,data){
  const weights={}; for(const answer of answers) for(const [key,value] of Object.entries(answer.weights||{})) weights[key]=(weights[key]||0)+value
  const roles=Object.entries(data.roles.roles).map(([id,r])=>({id,name:r.name,source:r.packName||'Corebook',score:(r.attributeChoices||r.attributes||[r.attribute]).reduce((n,a)=>n+(weights[`attr:${a}`]||0)*2,0)+r.skills.reduce((n,s)=>n+(weights[`skill:${s}`]||0),0)})).sort(byScore)
  // The original questions name a few Corebook Tropes directly. Once another
  // book is active, score every Trope from the universal Attribute/Skill
  // profile so supplement options are not penalized for lacking bespoke keys.
  const universal=Object.values(data.tropes.tropes).some(trope=>trope.packId)
  const tropes=Object.entries(data.tropes.tropes).filter(([,t])=>isTropeAvailableToRole(t,null,'trope')).map(([id,t])=>({id,name:t.name,source:t.packName||'Corebook',score:t.attributes.reduce((n,a)=>n+(weights[`attr:${a}`]||0),0)+t.skills.reduce((n,s)=>n+(weights[`skill:${s}`]||0),0)+(universal?0:(weights[`trope:${id}`]||0)*3)})).sort(byScore)
  return {roles,tropes}
}
const byScore=(a,b)=>b.score-a.score||a.name.localeCompare(b.name)
export function suggest(answers,data){ const result=score(answers,data); return {roles:result.roles.slice(0,3),tropes:result.tropes.slice(0,3)} }
