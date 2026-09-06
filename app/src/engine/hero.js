import { pick, shuffle } from './dice.js'
import { applyAge, applyFeats, applyFreeSkillPoints, applyProdigyRole, applyRole, applyTrope, baseHero, featSlots, finalize, freeSkillTargets, resolveGear, roleAttributeOptions, tropeAttributeOptions } from './build.js'

const entries = object => Object.entries(object || {}).map(([id,value])=>({id,...value}))
function chooseCashBudget(rng,all,budget) {
  const candidates=shuffle(rng,all.filter(item=>Number.isInteger(item.cost)&&item.cost>0&&item.cost<=budget))
  const search=(remaining,start,picked)=>{
    if(remaining===0)return picked
    for(let i=start;i<candidates.length;i++)if(candidates[i].cost<=remaining){const result=search(remaining-candidates[i].cost,i+1,[...picked,candidates[i].id]);if(result)return result}
    return null
  }
  return search(budget,0,[])||[]
}
function resolveSpec(rng,spec,gear,pinned) {
  if(spec.item) return [spec.item]
  if(spec.choice) {
    if(Array.isArray(spec.choice)) return [pinned && spec.choice.includes(pinned) ? pinned : pick(rng,spec.choice)]
    const items=entries(gear.items), guns=entries(gear.guns),weapons=entries(gear.weapons||gear.guns)
    const all=[...items,...weapons];const pools={any_gun:guns,any_weapon:weapons,any_item:all,any_1cash_item:all.filter(x=>x.cost===1),any_2cash_item:all.filter(x=>x.cost===2),any_precious_item:items.filter(x=>x.precious||x.cost>=3),precious_item:items.filter(x=>x.precious||x.cost>=3)}
    const cashBudget=spec.choice.match(/^any_(\d+)cash_items$/);if(cashBudget){const result=chooseCashBudget(rng,all,Number(cashBudget[1]));if(!result.length)throw new Error(`No gear matches ${spec.choice}`);return result}
    const gearCount=spec.choice.match(/^any_(\d+)_gear$/);if(gearCount){const result=shuffle(rng,all).slice(0,Number(gearCount[1])).map(x=>x.id);if(result.length<Number(gearCount[1]))throw new Error(`No gear matches ${spec.choice}`);return result}
    const pool=pools[spec.choice]||[]; if(!pool.length) throw new Error(`No gear matches ${spec.choice}`); return [pinned&&pool.some(x=>x.id===pinned)?pinned:pick(rng,pool).id]
  }
  if(spec.either) return resolveSpecs(rng,pick(rng,spec.either),gear,[])
  if(spec.ride) { const rides=entries(gear.rides).filter(r=>r.speed===spec.ride.speed); return rides.length?[pinned&&rides.some(x=>x.id===pinned)?pinned:pick(rng,rides).id]:[] }
  return []
}
function resolveSpecs(rng,specs=[],gear,pins=[]) { return specs.flatMap((spec,i)=>resolveSpec(rng,spec,gear,pins[i])) }
export function generateRandom(rng,data,pins={}) {
  const role= pins.role ? {id:pins.role,...data.roles.roles[pins.role]} : pick(rng,entries(data.roles.roles))
  if(!role?.name)throw new Error('Unknown role')
  const tropePool=entries(data.tropes.tropes),needsRoleTrope=role.extraTrope||role.doubleTrope,roleTropePool=role.doubleTrope?tropePool.filter(item=>item.colorTrope):tropePool,roleTrope=needsRoleTrope?(pins.roleTrope?{id:pins.roleTrope,...data.tropes.tropes[pins.roleTrope]}:pick(rng,roleTropePool)):null
  if(needsRoleTrope&&!roleTrope?.name)throw new Error('Unknown additional Role Trope')
  if(role.doubleTrope&&!roleTrope.colorTrope)throw new Error('Power Guardian requires a Color Trope')
  const availableTropes=needsRoleTrope?tropePool.filter(item=>item.id!==roleTrope.id&&(!role.doubleTrope||!item.colorTrope)):tropePool
  const trope=role.actsAsTrope?null:(pins.trope?{id:pins.trope,...data.tropes.tropes[pins.trope]}:pick(rng,availableTropes))
  if(!role.actsAsTrope&&!trope?.name)throw new Error('Unknown trope')
  const roleSource=roleTrope||role,roleOptions=roleAttributeOptions(roleSource),rolePoints=needsRoleTrope?1:role.attributePoints??1,fixed=needsRoleTrope?[]:role.fixedAttributes||[],pinnedRoleAttributes=pins.roleAttributes||(pins.roleAttribute?[pins.roleAttribute]:[]),roleAttributes=[...new Set([...fixed,...pinnedRoleAttributes])];while(roleAttributes.length<rolePoints){const option=pick(rng,roleOptions.filter(value=>!roleAttributes.includes(value)));if(!option)throw new Error('Not enough Role attribute choices');roleAttributes.push(option)}const roleAttribute=roleAttributes.length>1?roleAttributes:roleAttributes[0];let hero;if(role.doubleTrope){hero=applyRole(baseHero(),role,role.id,[]);hero=applyProdigyRole(hero,roleTrope,role,role.id,roleAttribute)}else hero=role.extraTrope?applyProdigyRole(baseHero(),roleTrope,role,role.id,roleAttribute):applyRole(baseHero(),role,role.id,roleAttribute)
  if(trope){const attr=pins.tropeAttribute || pick(rng,tropeAttributeOptions(hero,trope)); hero=applyTrope(hero,trope,attr,trope.id)}
  const ages=['Young',...Array(6).fill('Adult'),'Old']; hero=applyAge(hero,pins.age||pick(rng,ages))
  const pointCount=role.freeSkillPointCount||2,pointPins=pins.freeSkillPoints;const points=pointPins?[...pointPins]:[],preview=structuredClone(hero),preferred=roleSource.skills||[]
  while(points.length<pointCount){const favored=preferred.filter(skill=>preview.skills[skill]<3),target=pick(rng,favored.length?favored:freeSkillTargets(preview));points.push(target);preview.skills[target]++}
  hero=applyFreeSkillPoints(hero,points,pointCount)
  const slots=featSlots(hero,role),roleRules=needsRoleTrope?{...role,feats:roleTrope.feats}:role
  const tropeFeats=pins.tropeFeats||shuffle(rng,(trope?.feats||[]).filter(x=>!pins.roleFeats?.includes(x)&&!slots.forced.includes(x))).slice(0,slots.trope)
  const roleFeats=pins.roleFeats||shuffle(rng,(roleRules.feats||[]).filter(x=>!tropeFeats.includes(x)&&!slots.forced.includes(x))).slice(0,slots.role)
  const extraSource=role.extraFeatPool==='all'?Object.keys(data.feats.feats):[...(roleRules.feats||[]),...(trope?.feats||[])]
  const extraPool=[...new Set(extraSource)].filter(x=>![...roleFeats,...tropeFeats,...slots.forced].includes(x))
  const extraFeats=pins.extraFeats || shuffle(rng,extraPool).slice(0,slots.extra)
  hero=applyFeats(hero,{role:roleFeats,trope:tropeFeats,extra:extraFeats},roleRules,trope,data.feats.feats)
  const gearIds=pins.gearIds||resolveSpecs(rng,role.gear||[],data.gear,pins.gearChoices); hero=resolveGear(hero,gearIds,data.gear)
  const first=()=>pick(rng,data.names.first||data.names.firstNames||['Alex']), last=()=>pick(rng,data.names.last||data.names.surnames||['Reed'])
  const jobs=(role.jobs||role.origins||[]).filter(Boolean),catchphrases=(role.catchphrases||[]).filter(Boolean),flaws=(role.flaws||[]).filter(Boolean);hero.personal={...hero.personal,name:pins.name||`${first()} ${last()}`,job:pins.job||pick(rng,jobs.length?jobs:[role.name||'Hero']),catchphrase:pins.catchphrase||pick(rng,catchphrases.length?catchphrases:['']),flaw:pins.flaw||pick(rng,flaws.length?flaws:['']),portraitDataUrl:pins.portraitDataUrl||null}
  hero.meta={version:1,seed:pins.seed??null,mode:pins.mode||'random',createdAt:pins.createdAt||new Date(0).toISOString()}
  return finalize(hero,data)
}
