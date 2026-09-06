import { pick, shuffle } from './dice.js'
import { applyAge, applyFeats, applyFreeSkillPoints, applyRole, applyTrope, baseHero, finalize, freeSkillTargets, resolveGear, roleAttributeOptions, tropeAttributeOptions } from './build.js'

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
    const items=entries(gear.items), guns=entries(gear.guns)
    const weapons=[...guns,...items.filter(x=>x.kind==='melee')],all=[...items,...guns];const pools={any_gun:guns,any_weapon:weapons,any_item:all,any_1cash_item:all.filter(x=>x.cost===1),any_2cash_item:all.filter(x=>x.cost===2),any_precious_item:items.filter(x=>x.precious||x.cost>=3),precious_item:items.filter(x=>x.precious||x.cost>=3)}
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
  const trope= pins.trope ? {id:pins.trope,...data.tropes.tropes[pins.trope]} : pick(rng,entries(data.tropes.tropes))
  const roleAttribute=pins.roleAttribute||pick(rng,roleAttributeOptions(role));let hero=applyRole(baseHero(),role,role.id,roleAttribute)
  const attr=pins.tropeAttribute || pick(rng,tropeAttributeOptions(hero,trope)); hero=applyTrope(hero,trope,attr,trope.id)
  const ages=['Young',...Array(6).fill('Adult'),'Old']; hero=applyAge(hero,pins.age||pick(rng,ages))
  const pointPins=pins.freeSkillPoints; const preferred=role.skills.filter(s=>hero.skills[s]<3); const points=pointPins||[pick(rng,preferred.length?preferred:freeSkillTargets(hero))]; if(!pointPins){ const temp=applyFreeSkillPointsPreview(hero,points[0]); const next=role.skills.filter(s=>temp.skills[s]<3); points.push(pick(rng,next.length?next:freeSkillTargets(temp))) } hero=applyFreeSkillPoints(hero,points)
  const slots=hero.personal.age==='Young'?{role:1,trope:1,extra:0}:{role:2,trope:1,extra:hero.personal.age==='Old'?1:0}
  const tropeFeats=pins.tropeFeats||(pins.roleFeats?shuffle(rng,trope.feats.filter(x=>!pins.roleFeats.includes(x))).slice(0,slots.trope):shuffle(rng,trope.feats).slice(0,slots.trope))
  const roleFeats=pins.roleFeats||shuffle(rng,role.feats.filter(x=>!tropeFeats.includes(x))).slice(0,slots.role)
  const extraPool=[...new Set([...role.feats,...trope.feats])].filter(x=>![...roleFeats,...tropeFeats].includes(x))
  const extraFeats=pins.extraFeats || shuffle(rng,extraPool).slice(0,slots.extra)
  hero=applyFeats(hero,{role:roleFeats,trope:tropeFeats,extra:extraFeats},role,trope,data.feats.feats)
  const gearIds=pins.gearIds||resolveSpecs(rng,role.gear||[],data.gear,pins.gearChoices); hero=resolveGear(hero,gearIds,data.gear)
  const first=()=>pick(rng,data.names.first||data.names.firstNames||['Alex']), last=()=>pick(rng,data.names.last||data.names.surnames||['Reed'])
  const jobs=role.jobs||role.origins||[''];hero.personal={...hero.personal,name:pins.name||`${first()} ${last()}`,job:pins.job||pick(rng,jobs),catchphrase:pins.catchphrase||pick(rng,role.catchphrases||['']),flaw:pins.flaw||pick(rng,role.flaws||['']),portraitDataUrl:pins.portraitDataUrl||null}
  hero.meta={version:1,seed:pins.seed??null,mode:pins.mode||'random',createdAt:pins.createdAt||new Date(0).toISOString()}
  return finalize(hero,data)
}
function applyFreeSkillPointsPreview(hero,skill){ const h=structuredClone(hero); h.skills[skill]++; return h }
