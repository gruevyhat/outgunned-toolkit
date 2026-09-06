import { ATTRIBUTES, SKILLS, roleAttributeOptions } from './build.js'
export function validateHero(hero,data){
  const errors=[]
  if(!hero||typeof hero!=='object') return ['Hero is required']
  const role=data.roles.roles[hero.role], trope=data.tropes.tropes[hero.trope]
  if(!role) errors.push('Unknown role'); if(!trope) errors.push('Unknown trope')
  const roleAttribute=hero.roleAttribute||role?.attribute
  if(role&&!roleAttributeOptions(role).includes(roleAttribute))errors.push('Invalid Role attribute')
  for(const a of ATTRIBUTES) if(!Number.isInteger(hero.attributes?.[a])||hero.attributes[a]<2||hero.attributes[a]>3) errors.push(`${a} must be 2–3`)
  for(const s of SKILLS) if(!Number.isInteger(hero.skills?.[s])||hero.skills[s]<1||hero.skills[s]>3) errors.push(`${s} must be 1–3`)
  if(hero.freeSkillPoints?.length!==2) errors.push('Exactly two free Skill points required')
  if(trope&&!trope.attributes.includes(hero.tropeAttribute)) errors.push('Invalid trope attribute')
  if(role&&trope&&roleAttribute===hero.tropeAttribute) errors.push('Trope must raise its other Attribute')
  if(role&&trope){
    for(const a of ATTRIBUTES){const expected=2+(roleAttribute===a?1:0)+(hero.tropeAttribute===a?1:0);if(hero.attributes?.[a]!==expected)errors.push(`${a} does not match Role and Trope allocations`)}
    const freeCounts=Object.fromEntries(SKILLS.map(s=>[s,(hero.freeSkillPoints||[]).filter(x=>x===s).length]));
    for(const s of SKILLS){const before=1+(role.skills.includes(s)?1:0)+(trope.skills.includes(s)?1:0), expected=before+freeCounts[s];if(hero.skills?.[s]!==expected)errors.push(`${s} does not match allocated Skill points`);if(freeCounts[s]&&before>=3)errors.push(`Free point cannot raise maxed Skill: ${s}`);if(freeCounts[s]>1&&before!==1)errors.push(`Two free points cannot both raise ${s}`)}
  }
  if(role&&trope){ const allowed=new Set([...role.feats,...trope.feats,'too_young_to_die']); for(const f of hero.feats||[]) if(!allowed.has(f)) errors.push(`Feat not permitted: ${f}`) }
  const expected=hero.personal?.age==='Old'?4:3; if(hero.feats?.length!==expected) errors.push(`Age requires ${expected} feats`)
  if(hero.personal?.age==='Young'&&!hero.feats.includes('too_young_to_die')) errors.push('Young heroes require Too Young to Die')
  if(hero.personal?.age==='Young'&&hero.resources?.adrenaline!==2) errors.push('Young heroes start with 2 Adrenaline')
  if(hero.personal?.age==='Old'&&hero.resources?.lethalBullets!==2) errors.push('Old heroes start with 2 Lethal Bullets')
  if(new Set(hero.feats||[]).size!==(hero.feats||[]).length) errors.push('Duplicate feats')
  if((hero.gear?.guns||[]).some(g=>!Number.isInteger(g.mags)||g.mags<0||g.mags>3)) errors.push('Gun Mags must be 0–3')
  for(const [key,max] of Object.entries({adrenaline:6,spotlight:3,cash:5,lethalBullets:6,gritUsed:12,...(hero.superpower?{power:6}:{})})){const value=hero.resources?.[key]??0;if(!Number.isInteger(value)||value<0||value>max)errors.push(`${key} must be 0–${max}`)}
  return [...new Set(errors)]
}
