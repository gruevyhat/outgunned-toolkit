import { shuffle } from './dice.js'
export const drawQuestions=(rng,bank,n)=>shuffle(rng,bank.questions).slice(0,n)
export function score(answers,data){
  const weights={}; for(const answer of answers) for(const [key,value] of Object.entries(answer.weights||{})) weights[key]=(weights[key]||0)+value
  const roles=Object.entries(data.roles.roles).map(([id,r])=>({id,name:r.name,score:(r.attributeChoices||r.attributes||[r.attribute]).reduce((n,a)=>n+(weights[`attr:${a}`]||0)*2,0)+r.skills.reduce((n,s)=>n+(weights[`skill:${s}`]||0),0)})).sort(byScore)
  const tropes=Object.entries(data.tropes.tropes).map(([id,t])=>({id,name:t.name,score:t.attributes.reduce((n,a)=>n+(weights[`attr:${a}`]||0),0)+t.skills.reduce((n,s)=>n+(weights[`skill:${s}`]||0),0)+(weights[`trope:${id}`]||0)*3})).sort(byScore)
  return {roles,tropes}
}
const byScore=(a,b)=>b.score-a.score||a.name.localeCompare(b.name)
export function suggest(answers,data){ const result=score(answers,data); return {roles:result.roles.slice(0,3),tropes:result.tropes.slice(0,3)} }
