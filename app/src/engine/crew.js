import { generateRandom } from './hero.js'
import { shuffle } from './dice.js'
export function generateCrew(rng,data,size){ if(!Number.isInteger(size)||size<2||size>5) throw new Error('Crew size must be 2–5'); const roles=shuffle(rng,Object.keys(data.roles.roles)).slice(0,size); return roles.map(role=>generateRandom(rng,data,{role,mode:'crew'})) }
