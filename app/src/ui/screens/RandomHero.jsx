import React,{useState} from 'react'
import { makeRng } from '../../engine/dice.js'
import { generateRandom } from '../../engine/hero.js'
import HeroSheet from './HeroSheet.jsx'
import { validateHero } from '../../engine/validate.js'

export default function RandomHero({data,onBack,initial,onAddToCrew}){
  const [hero,setHero]=useState(()=>initial||generateRandom(makeRng(Date.now()),data)),[editing,setEditing]=useState(false)
  const reroll=field=>{ const key=field.replace('personal.',''); const pins={role:hero.role,roleAttribute:hero.roleAttribute,trope:hero.trope,tropeAttribute:hero.tropeAttribute,age:hero.personal.age,name:hero.personal.name,job:hero.personal.job,catchphrase:hero.personal.catchphrase,flaw:hero.personal.flaw}; if(key==='role'){delete pins.role;delete pins.roleAttribute;delete pins.tropeAttribute} if(key==='trope'){delete pins.trope;delete pins.tropeAttribute} delete pins[key]; setHero(generateRandom(makeRng(Date.now()),data,pins)) }
  const edit=(field,value)=>{
    if(['role','trope','personal.age'].includes(field)){
      const pins={role:field==='role'?value:hero.role,trope:field==='trope'?value:hero.trope,age:field==='personal.age'?value:hero.personal.age,name:hero.personal.name,job:hero.personal.job,catchphrase:hero.personal.catchphrase,flaw:hero.personal.flaw}
      try{setHero(generateRandom(makeRng(Date.now()),data,pins))}catch{}
      return
    }
    const next=structuredClone(hero),parts=field.split('.');let parent=next;for(const p of parts.slice(0,-1))parent=parent[p];parent[parts.at(-1)]=value;if(!validateHero(next,data).length)setHero(next)
  }
  return <HeroSheet hero={hero} data={data} mode={editing?'edit':'play'} onHome={onBack} onReroll={reroll} onEdit={edit} onWorkingChange={setHero} onToggleEdit={()=>setEditing(x=>!x)} onNew={()=>setHero(generateRandom(makeRng(Date.now()),data))} onAddToCrew={()=>onAddToCrew?.(hero)}/>
}
