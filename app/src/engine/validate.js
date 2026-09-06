import { ATTRIBUTES, SKILLS, featSlots, roleAttributeOptions } from './build.js'
import {usesMags} from './gearCatalog.js'
export function validateHero(hero,data){
  const errors=[]
  if(!hero||typeof hero!=='object') return ['Hero is required']
  const role=data.roles.roles[hero.role], trope=data.tropes.tropes[hero.trope],roleTrope=data.tropes.tropes[hero.roleTrope]
  if(!role) errors.push('Unknown role'); if(!trope&&!role?.actsAsTrope) errors.push('Unknown trope');if((role?.extraTrope||role?.doubleTrope)&&!roleTrope)errors.push('Unknown additional Role Trope');if((role?.extraTrope||role?.doubleTrope)&&hero.roleTrope===hero.trope)errors.push('Special Role requires two different Tropes');if(role?.doubleTrope&&roleTrope&&!roleTrope.colorTrope)errors.push('Power Guardian requires a Color Trope')
  const roleAttribute=hero.roleAttribute||role?.attribute
  const roleSource=role?.extraTrope||role?.doubleTrope?roleTrope:role
  const roleAttributes=hero.roleAttributes||[roleAttribute]
  if(roleSource&&!role?.fixedAttributes&&!roleAttributes.every(attribute=>roleAttributeOptions(roleSource).includes(attribute)))errors.push('Invalid Role attribute')
  for(const a of ATTRIBUTES) if(!Number.isInteger(hero.attributes?.[a])||hero.attributes[a]<2||hero.attributes[a]>3) errors.push(`${a} must be 2–3`)
  for(const s of SKILLS) if(!Number.isInteger(hero.skills?.[s])||hero.skills[s]<1||hero.skills[s]>3) errors.push(`${s} must be 1–3`)
  const freePointCount=role?.freeSkillPointCount||2
  if(hero.freeSkillPoints?.length!==freePointCount) errors.push(`Exactly ${freePointCount} free Skill points required`)
  if(trope&&!trope.attributes.includes(hero.tropeAttribute)) errors.push('Invalid trope attribute')
  if(role&&trope&&!role.fixedAttributes&&roleAttribute===hero.tropeAttribute) errors.push('Trope must raise its other Attribute')
  if(role&&(trope||role.actsAsTrope)){
    for(const a of ATTRIBUTES){const roleIncrease=roleAttributes.includes(a)?1:0,expected=2+roleIncrease+(hero.tropeAttribute===a?1:0);if(hero.attributes?.[a]!==expected)errors.push(`${a} does not match Role and Trope allocations`)}
    const freeCounts=Object.fromEntries(SKILLS.map(s=>[s,(hero.freeSkillPoints||[]).filter(x=>x===s).length]));
    for(const s of SKILLS){const before=1+((roleSource?.skills||[]).includes(s)?1:0)+((role?.doubleTrope&&role.skills||[]).includes(s)?1:0)+((trope?.skills||[]).includes(s)?1:0), expected=before+freeCounts[s];if(hero.skills?.[s]!==expected)errors.push(`${s} does not match allocated Skill points`);if(freeCounts[s]&&before>=3)errors.push(`Free point cannot raise maxed Skill: ${s}`);if(freeCounts[s]>1&&before!==1)errors.push(`Two free points cannot both raise ${s}`)}
  }
  if(role){ const allowed=role.extraFeatPool==='all'?new Set(Object.keys(data.feats.feats)):new Set([...(roleSource?.feats||[]),...(trope?.feats||[]),...(role.forcedFeats||[]),'too_young_to_die']); for(const f of hero.feats||[]) if(!allowed.has(f)) errors.push(`Feat not permitted: ${f}`) }
  const slots=featSlots(hero,role),expected=slots.role+slots.trope+slots.extra+slots.forced.length;if(hero.feats?.length!==expected)errors.push(`Role requires ${expected} feats`)
  if(!role?.actsAsTrope&&!role?.extraTrope&&!role?.doubleTrope&&hero.personal?.age==='Young'&&!hero.feats.includes('too_young_to_die')) errors.push('Young heroes require Too Young to Die')
  if(hero.personal?.age==='Young'&&hero.resources?.adrenaline!==2) errors.push('Young heroes start with 2 Adrenaline')
  if(hero.personal?.age==='Old'&&hero.resources?.lethalBullets!==2) errors.push('Old heroes start with 2 Lethal Bullets')
  const featCounts=Object.fromEntries((hero.feats||[]).map(id=>[id,(hero.feats||[]).filter(value=>value===id).length]));for(const [id,count] of Object.entries(featCounts)){const feat=data.feats.feats[id]||{},limit=feat.repeatable?(feat.maxRanks||Infinity):1;if(count>limit)errors.push(`Feat cannot be taken ${count} times: ${id}`)}
  if((hero.gear?.guns||[]).some(g=>usesMags(g)&&(!Number.isInteger(g.mags)||g.mags<0||g.mags>3))) errors.push('Gun Mags must be 0–3')
  for(const [key,max] of Object.entries({adrenaline:6,spotlight:3,cash:5,lethalBullets:6,gritUsed:12,...(hero.superpower?{power:6}:{})})){const value=hero.resources?.[key]??0;if(!Number.isInteger(value)||value<0||value>max)errors.push(`${key} must be 0–${max}`)}
  return [...new Set(errors)]
}
