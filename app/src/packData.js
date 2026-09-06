const clone=value=>structuredClone(value)
const namespace=(packId,id)=>`${packId}__${id}`

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
  const roles=Object.fromEntries(Object.entries(document.roles||{}).filter(([,role])=>!role.special&&!role.specialRole&&!role.incredible&&!role.nonRole&&Array.isArray(role.skills)&&role.skills.length===10).map(([id,role])=>[namespace(packId,id),{...role,packId,packName,feats:(role.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x),gear:(role.gear||[]).map(x=>mapGearSpec(x,gearIds,packId)),superpower:role.superpower&&powerIds.has(role.superpower)?namespace(packId,role.superpower):role.superpower,jobs:role.jobs||(role.origins||[]).map(origin=>document.origins?.[origin]?.name||origin)}]))
  const tropes=Object.fromEntries(Object.entries(document.tropes||{}).filter(([,trope])=>Array.isArray(trope.attributes)&&trope.attributes.length===2&&Array.isArray(trope.skills)&&trope.skills.length===8&&Array.isArray(trope.feats)&&trope.feats.length>0).map(([id,trope])=>[namespace(packId,id),{...trope,packId,packName,blurb:trope.blurb||trope.prompt||trope.summary,feats:(trope.feats||[]).map(x=>featIds.has(x)?namespace(packId,x):x)}]))
  const excludedRoles=Object.values(document.roles||{}).filter(role=>role.special||role.specialRole||role.incredible||role.nonRole||role.skills?.length!==10).map(role=>role.name)
  return {id:packId,name:packName,description:document._meta?.notes||'',roles,tropes,feats,gear,superpowers,excludedRoles}
}

export function mergePacks(base,packs,enabledIds){
  const enabled=packs.filter(pack=>enabledIds.includes(pack.id)),allGear={...base.gear.gear},roles={...base.roles.roles},tropes={...base.tropes.tropes},feats={...base.feats.feats},superpowers={}
  for(const pack of enabled){Object.assign(roles,pack.roles);Object.assign(tropes,pack.tropes);Object.assign(feats,pack.feats);Object.assign(allGear,pack.gear);Object.assign(superpowers,pack.superpowers)}
  const gear={...base.gear,gear:allGear,items:Object.fromEntries(Object.entries(allGear).filter(([,x])=>x.kind!=='gun'&&x.kind!=='ride'&&!x.range)),guns:Object.fromEntries(Object.entries(allGear).filter(([,x])=>x.kind==='gun'||x.range)),rides:Object.fromEntries(Object.entries(allGear).filter(([,x])=>x.kind==='ride'))}
  return {...base,roles:{...base.roles,roles},tropes:{...base.tropes,tropes},feats:{...base.feats,feats},gear,superpowers}
}
