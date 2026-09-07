import {isRangedWeapon,isWeapon} from './engine/gearCatalog.js'
import {roleBlurb} from './data/roleBlurbs.js'
import {tropeBlurb} from './data/tropeBlurbs.js'

const clone=value=>structuredClone(value)
const namespace=(packId,id)=>`${packId}__${id}`
const ATTRIBUTES=['brawn','nerves','smooth','focus','crime']

function mapGearSpec(spec,gearIds,packId){
  if(spec.item)return {...spec,item:gearIds.has(spec.item)?namespace(packId,spec.item):spec.item}
  if(Array.isArray(spec.choice))return {...spec,choice:spec.choice.map(id=>gearIds.has(id)?namespace(packId,id):id)}
  if(spec.either)return {...spec,either:spec.either.map(side=>side.map(item=>mapGearSpec(item,gearIds,packId)))}
  return clone(spec)
}

export function normalizePack(document){
  const packId=document._meta?.id||document.genre, packName=document._meta?.name||packId
  const featIds=new Set(Object.keys(document.feats||{})),gearIds=new Set(Object.keys(document.gear||{})),powerIds=new Set(Object.keys(document.superpowers||{}))
  const feats=Object.fromEntries(Object.entries(document.feats||{}).map(([id,value])=>[namespace(packId,id),{...value,packId,packName}]))
  const gear=Object.fromEntries(Object.entries(document.gear||{}).map(([id,value])=>[namespace(packId,id),{...value,packId,packName}]))
  const superpowers=Object.fromEntries(Object.entries(document.superpowers||{}).map(([id,value])=>[namespace(packId,id),{...value,packId,packName,superWeapons:(value.superWeapons||[]).map(x=>namespace(packId,x))}]))
  const tags=Object.fromEntries(Object.entries(document.tags||{}).map(([id,value])=>[namespace(packId,id),{...value,packId,packName,forcedFeat:value.forcedFeat&&(featIds.has(value.forcedFeat)?namespace(packId,value.forcedFeat):value.forcedFeat),feats:(value.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x)}]))
  const forms=Object.fromEntries(Object.entries(document.forms||{}).map(([id,value])=>[namespace(packId,id),{...value,packId,packName,feats:(value.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x)}]))
  const actsAsTrope=role=>role.actsAsTrope||role.specialRole&&role.specialRoleAppliesTo?.includes('trope')
  const isSupportedRole=role=>!role.special&&(Array.isArray(role.skills)&&role.skills.length===10||role.extraTrope||role.tropeCount===2||actsAsTrope(role)&&Array.isArray(role.skills)&&role.skills.length>=10)
  const roles=Object.fromEntries(Object.entries(document.roles||{}).filter(([,role])=>isSupportedRole(role)).map(([id,role])=>{const roleActsAsTrope=actsAsTrope(role),doubleTrope=role.tropeCount===2,listedAttributes=Array.isArray(role.attributes)?role.attributes.filter(value=>ATTRIBUTES.includes(value)):[],fixedAttributes=role.fixedAttributes||(roleActsAsTrope&&listedAttributes.length===2&&!role.attributes.some(value=>!ATTRIBUTES.includes(value))?listedAttributes:roleActsAsTrope&&listedAttributes.length?listedAttributes:undefined),attributePoints=role.attributePoints??(doubleTrope?0:roleActsAsTrope?2:1),attributeChoices=role.attributeChoices||(role.attributes==='2 of your choice'||role.attributes?.some?.(value=>!ATTRIBUTES.includes(value))?ATTRIBUTES:undefined);return [namespace(packId,id),{...role,blurb:role.blurb||role.tagline||roleBlurb(packId,id)||role.summary,actsAsTrope:roleActsAsTrope,doubleTrope,fixedAttributes,attributePoints,attributeChoices,freeSkillPointCount:role.freeSkillPointCount||role.freeSkillPoints,featCount:role.featCount||role.featSlots,packId,packName,feats:(role.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x),forcedFeats:(role.forcedFeats||[]).map(x=>featIds.has(x)?namespace(packId,x):x),gear:(role.gear||[]).map(x=>mapGearSpec(x,gearIds,packId)),superpower:role.superpower&&powerIds.has(role.superpower)?namespace(packId,role.superpower):role.superpower,jobs:role.specialRoleAppliesTo?.includes('job')?[role.name]:role.jobs||(role.origins||[]).map(origin=>document.origins?.[origin]?.name||origin)}]}))
  const tropes=Object.fromEntries(Object.entries(document.tropes||{}).filter(([,trope])=>Array.isArray(trope.attributes)&&trope.attributes.length===2&&Array.isArray(trope.skills)&&trope.skills.length===8&&Array.isArray(trope.feats)&&trope.feats.length>0).map(([id,trope])=>[namespace(packId,id),{...trope,packId,packName,blurb:trope.blurb||trope.prompt||tropeBlurb(packId,id)||trope.summary,feats:(trope.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x)}]))
  const excludedRoles=Object.values(document.roles||{}).filter(role=>!isSupportedRole(role)).map(role=>role.name)
  return {id:packId,name:packName,description:document._meta?.notes||'',roles,tropes,feats,gear,superpowers,tags,forms,excludedRoles}
}

export function mergePacks(base,packs,enabledIds){
  const enabled=packs.filter(pack=>enabledIds.includes(pack.id)),allGear={...base.gear.gear},roles={...base.roles.roles},tropes={...base.tropes.tropes},feats={...base.feats.feats},superpowers={},tags={},forms={}
  for(const pack of enabled){Object.assign(roles,pack.roles);Object.assign(tropes,pack.tropes);Object.assign(feats,pack.feats);Object.assign(allGear,pack.gear);Object.assign(superpowers,pack.superpowers);Object.assign(tags,pack.tags);Object.assign(forms,pack.forms)}
  const gear={...base.gear,gear:allGear,items:Object.fromEntries(Object.entries(allGear).filter(([,x])=>!isWeapon(x)&&x.kind!=='ride')),guns:Object.fromEntries(Object.entries(allGear).filter(([,x])=>isRangedWeapon(x))),weapons:Object.fromEntries(Object.entries(allGear).filter(([,x])=>isWeapon(x))),rides:Object.fromEntries(Object.entries(allGear).filter(([,x])=>x.kind==='ride'))}
  return {...base,roles:{...base.roles,roles},tropes:{...base.tropes,tropes},feats:{...base.feats,feats},gear,superpowers,tags,forms}
}
