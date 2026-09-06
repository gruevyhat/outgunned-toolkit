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
import {parseHeroMarkdown} from '../engine/heroMarkdown.js'
import {validateHero} from '../engine/validate.js'

const PACK_STORAGE_KEY='outgunned-enabled-packs'
const allPackIds=()=>contentPacks.map(pack=>pack.id)
export function initialEnabledPacks(storage=typeof window!=='undefined'?window.localStorage:null){
  if(!storage)return allPackIds()
  try{
    const saved=JSON.parse(storage.getItem(PACK_STORAGE_KEY))
    return Array.isArray(saved)?saved.filter(id=>allPackIds().includes(id)):allPackIds()
  }catch{return allPackIds()}
}

export default function App(){
  const [mode,setMode]=useState('menu'),[shared,setShared]=useState(null),[guidedDefaults,setGuidedDefaults]=useState({}),[crew,setCrew]=useState([]),[enabledPacks,setEnabledPacks]=useState(initialEnabledPacks)
  const data=useMemo(()=>mergePacks(coreData,contentPacks,enabledPacks),[enabledPacks])
  useEffect(()=>{
    window.scrollTo(0,0)
  },[mode])
  useEffect(()=>{try{window.localStorage.setItem(PACK_STORAGE_KEY,JSON.stringify(enabledPacks))}catch{}},[enabledPacks])
  useEffect(()=>{const raw=decodeHash(location.hash);if(raw?.type==='hero'){const packId=raw.value.role?.split('__')[0];if(contentPacks.some(pack=>pack.id===packId)&&!enabledPacks.includes(packId)){setEnabledPacks(current=>[...current,packId]);return}}const decoded=decodeHash(location.hash,validateHero,data);if(decoded?.type==='hero'){setShared(decoded.value);setMode('random')}else if(decoded?.type==='campaign'){setShared(decoded.value);setMode('mission')}},[data,enabledPacks])
  const home=()=>{history.replaceState(null,'',location.pathname+location.search);setShared(null);setMode('menu')}
  const togglePack=id=>{setEnabledPacks(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);setCrew([]);setGuidedDefaults({})}
  const addToCrew=hero=>{setCrew(current=>current.some(x=>x.role===hero.role)?current:[...current,hero].slice(0,5));setMode('crew')}
  const importMarkdown=async file=>{try{const hero=parseHeroMarkdown(await file.text()),required=contentPacks.filter(pack=>JSON.stringify(hero).includes(`${pack.id}__`)).map(pack=>pack.id),nextEnabled=[...new Set([...enabledPacks,...required])],nextData=mergePacks(coreData,contentPacks,nextEnabled),errors=validateHero(hero,nextData);if(errors.length)throw new Error(errors.join(' · '));setEnabledPacks(nextEnabled);setShared(hero);setMode('random')}catch(error){if(typeof window!=='undefined')window.alert(error.message);else throw error}}
  if(mode==='menu')return <Menu onSelectMode={setMode} packs={contentPacks} enabledPacks={enabledPacks} onTogglePack={togglePack} onImportMarkdown={importMarkdown}/>
  if(mode==='random')return <RandomHero data={data} onBack={home} initial={shared} onAddToCrew={addToCrew} onImportMarkdown={importMarkdown}/>
  if(mode==='guided')return <GuidedHero data={data} onBack={home} defaults={guidedDefaults} onImportMarkdown={importMarkdown}/>
  if(mode==='quiz')return <Questionnaire data={data} onBack={home} onRoll={()=>setMode('random')} onAccept={result=>{setGuidedDefaults({role:result.roles[0].id,trope:result.tropes[0].id});setMode('guided')}}/>
  if(mode==='crew')return <Crew data={data} onBack={home} initial={crew}/>
  if(mode==='mission')return <Mission data={data} onBack={home} initial={shared}/>
  return <Oracles data={data} onBack={home}/>
}
