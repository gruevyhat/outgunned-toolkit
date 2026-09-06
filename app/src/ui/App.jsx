import React,{useEffect,useMemo,useState} from 'react'
import Menu from './screens/Menu.jsx'
import RandomHero from './screens/RandomHero.jsx'
import GuidedHero from './screens/GuidedHero.jsx'
import Questionnaire from './screens/Questionnaire.jsx'
import Crew from './screens/Crew.jsx'
import Mission from './screens/Mission.jsx'
import Oracles from './screens/Oracles.jsx'
import {contentPacks,gameData as coreData} from '../data.js'
import {mergePacks} from '../packData.js'
import {decodeHash} from '../engine/share.js'
import {validateHero} from '../engine/validate.js'

export default function App(){
  const [mode,setMode]=useState('menu'),[shared,setShared]=useState(null),[guidedDefaults,setGuidedDefaults]=useState({}),[crew,setCrew]=useState([]),[enabledPacks,setEnabledPacks]=useState([])
  const data=useMemo(()=>mergePacks(coreData,contentPacks,enabledPacks),[enabledPacks])
  useEffect(()=>{
    window.scrollTo(0,0)
  },[mode])
  useEffect(()=>{const raw=decodeHash(location.hash);if(raw?.type==='hero'){const packId=raw.value.role?.split('__')[0];if(contentPacks.some(pack=>pack.id===packId)&&!enabledPacks.includes(packId)){setEnabledPacks(current=>[...current,packId]);return}}const decoded=decodeHash(location.hash,validateHero,data);if(decoded?.type==='hero'){setShared(decoded.value);setMode('random')}else if(decoded?.type==='campaign'){setShared(decoded.value);setMode('mission')}},[data,enabledPacks])
  const home=()=>{history.replaceState(null,'',location.pathname+location.search);setShared(null);setMode('menu')}
  const togglePack=id=>{setEnabledPacks(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);setCrew([]);setGuidedDefaults({})}
  const addToCrew=hero=>{setCrew(current=>current.some(x=>x.role===hero.role)?current:[...current,hero].slice(0,5));setMode('crew')}
  if(mode==='menu')return <Menu onSelectMode={setMode} packs={contentPacks} enabledPacks={enabledPacks} onTogglePack={togglePack}/>
  if(mode==='random')return <RandomHero data={data} onBack={home} initial={shared} onAddToCrew={addToCrew}/>
  if(mode==='guided')return <GuidedHero data={data} onBack={home} defaults={guidedDefaults}/>
  if(mode==='quiz')return <Questionnaire data={data} onBack={home} onRoll={()=>setMode('random')} onAccept={result=>{setGuidedDefaults({role:result.roles[0].id,trope:result.tropes[0].id});setMode('guided')}}/>
  if(mode==='crew')return <Crew data={data} onBack={home} initial={crew}/>
  if(mode==='mission')return <Mission data={data} onBack={home} initial={shared}/>
  return <Oracles data={data} onBack={home}/>
}
