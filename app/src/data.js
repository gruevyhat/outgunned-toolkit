import roles from '../data/roles.json'
import tropes from '../data/tropes.json'
import feats from '../data/feats.json'
import gearDocument from '../data/gear.json'
import names from '../data/names.json'
import questionnaire from '../data/questionnaire.json'
import missionTables from '../data/mission_tables.json'
import adventureDocument from '../data/packs/adventure.json'
import superheroesDocument from '../data/packs/superheroes.json'
import supplementsDocument from '../data/packs/supplements.json'
import {normalizePack} from './packData.js'
const allGear=gearDocument.gear||{}
const isRangedWeapon=item=>item.kind==='gun'||!!item.range
const isMeleeWeapon=item=>item.kind==='melee'||item.kind==='weapon'
const gear={...gearDocument,
  items:Object.fromEntries(Object.entries(allGear).filter(([,x])=>!isRangedWeapon(x)&&!isMeleeWeapon(x)&&x.kind!=='ride')),
  guns:Object.fromEntries(Object.entries(allGear).filter(([,x])=>isRangedWeapon(x))),
  weapons:Object.fromEntries(Object.entries(allGear).filter(([,x])=>isRangedWeapon(x)||isMeleeWeapon(x))),
  rides:Object.fromEntries(Object.entries(allGear).filter(([,x])=>x.kind==='ride'))
}
export const gameData={roles,tropes,feats,gear,names,questionnaire,missionTables,superpowers:{}}
const supplementsPack={...supplementsDocument,_meta:{...supplementsDocument._meta,id:'supplements',name:'Action Flicks & World of Killers',notes:'Character options from Action Flicks Volumes 1–3 and World of Killers. Project Medusa adds pregenerated heroes but no new creation options.'}}
export const contentPacks=[normalizePack(adventureDocument),normalizePack(superheroesDocument),normalizePack(supplementsPack)]
