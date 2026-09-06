import React, { useEffect, useMemo, useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { generateRandom } from '../../engine/hero.js'
import { randomPersonalValue } from '../../engine/personal.js'
import { featSlots, roleAttributeOptions } from '../../engine/build.js'
import { validateHero } from '../../engine/validate.js'
import { Dots } from '../components/index.jsx'
import HeroSheet from './HeroSheet.jsx'

const STEPS = ['Role', 'Trope', 'Personal Data', 'Free Points', 'Feats', 'Gear', 'Review']
const byName = ([,a],[,b]) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })

export default function GuidedHero({ data, onBack, defaults = {}, onImportMarkdown }) {
  const firstRoleId = Object.entries(data.roles.roles).sort(byName)[0]?.[0]
  const [step, setStep] = useState(defaults.role ? 1 : 0)
  const [form, setForm] = useState({
    role: defaults.role || firstRoleId,
    roleTrope: defaults.roleTrope || Object.keys(data.tropes.tropes)[0],
    trope: defaults.trope || Object.keys(data.tropes.tropes)[0],
    roleAttribute: null,
    tropeAttribute: null,
    age: 'Adult',
    name: '',
    job: '',
    catchphrase: '',
    flaw: '',
    freeSkillPoints: [],
    roleFeats: [],
    tropeFeats: [],
    extraFeats: [],
    gearChoices: [],
    ...defaults,
  })

  const role = data.roles.roles[form.role]
  const needsRoleTrope=role.extraTrope||role.doubleTrope,roleTropeChoices=role.doubleTrope?Object.fromEntries(Object.entries(data.tropes.tropes).filter(([,value])=>value.colorTrope)):data.tropes.tropes
  const firstTropeId = needsRoleTrope && (form.roleTrope === form.trope || !roleTropeChoices[form.roleTrope]) ? Object.keys(roleTropeChoices).find(id => id !== form.trope) : form.roleTrope
  const roleTrope = needsRoleTrope ? data.tropes.tropes[firstTropeId] : null
  const trope = role.actsAsTrope ? null : data.tropes.tropes[form.trope]
  const roleAttrs = roleAttributeOptions(roleTrope || role)
  const roleAttr = roleAttrs.includes(form.roleAttribute) ? form.roleAttribute : roleAttrs[0]
  const legalTropeAttrs = (trope?.attributes || []).filter(attribute => attribute !== roleAttr)
  const tropeAttr = legalTropeAttrs.includes(form.tropeAttribute) ? form.tropeAttribute : legalTropeAttrs[0] || trope?.attributes?.[0]
  const slotPreview={personal:{age:form.age}},slots=featSlots(slotPreview,role),roleCap=slots.role,tropeCap=slots.trope,extraCap=slots.extra,freePointCount=role.freeSkillPointCount||2
  const pins = { ...form, roleTrope:firstTropeId, roleAttribute: roleAttr, tropeAttribute: tropeAttr }
  if (form.freeSkillPoints.length !== freePointCount) delete pins.freeSkillPoints
  if (form.roleFeats.length !== roleCap) delete pins.roleFeats
  if (form.tropeFeats.length !== tropeCap) delete pins.tropeFeats
  if (form.extraFeats.length !== extraCap) delete pins.extraFeats

  const hero = useMemo(() => {
    try { return generateRandom(makeRng(73), data, pins) } catch { return null }
  }, [data, JSON.stringify(pins)])
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const randomizePersonal = field => set(field,randomPersonalValue(field,{data,role,trope:role.actsAsTrope?role:trope,attributes:[roleAttr,tropeAttr].filter(Boolean),current:form[field]},makeRng(Date.now()+field.length)))
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  if (step === 6 && hero) return <GuidedReview initial={hero} data={data} onHome={onBack} onImportMarkdown={onImportMarkdown} />

  const canContinue = !(step === 3 && form.freeSkillPoints.length !== freePointCount)
    && !(step === 4 && (form.roleFeats.length !== roleCap || form.tropeFeats.length !== tropeCap || form.extraFeats.length !== extraCap))

  return <main className="panel wizard">
    <button className="link" onClick={step ? () => setStep(step - 1) : onBack}>{step ? '← Back' : '← Home'}</button>
    <div className="progress" aria-label={`Step ${step + 1} of 7`}><i style={{ width: `${(step + 1) / 7 * 100}%` }} /></div>
    <p className="eyebrow">Step {step + 1} / 7</p>
    <h1>{STEPS[step]}</h1>
    {step > 0 && <div className="wizard-summary"><span><strong>Role</strong> {needsRoleTrope?`${roleTrope.name} ${role.name.replace(/^The /,'')}`:role.name}</span><span><strong>Trope</strong> {role.actsAsTrope?role.name:trope.name}</span><span><strong>Age</strong> {form.age}</span></div>}

    {step === 0 && <>
      <ChoiceGrid label="Roles" values={data.roles.roles} selected={form.role} alphabetical onChange={value => setForm(current => ({ ...current, role: value, roleAttribute: null, roleFeats: [], tropeFeats:[], extraFeats:[], freeSkillPoints:[], gearChoices: [] }))} />
      {needsRoleTrope&&<><h2>{role.doubleTrope?'Color Trope':'Prodigy Role Trope'}</h2><p>{role.doubleTrope?'Every Power Guardian first chooses one of the six Color Tropes.':'This first Trope is written as your Role, followed by “Prodigy.”'}</p><ChoiceGrid label="Role Tropes" values={roleTropeChoices} selected={firstTropeId} onChange={value=>setForm(current=>({...current,roleTrope:value,roleAttribute:null,roleFeats:[],freeSkillPoints:[]}))}/></>}
      {role.fixedAttributes?.length?<p><strong>Raised Attributes:</strong> {role.fixedAttributes.join(' and ')}</p>:roleAttrs.length > 1 && <><h2>Role Attribute</h2><div className="choices">{roleAttrs.map(attribute => <button key={attribute} className={roleAttr === attribute ? 'selected' : ''} onClick={() => set('roleAttribute', attribute)}>{attribute}</button>)}</div></>}
    </>}

    {step === 1 && <>
      {role.actsAsTrope?<p>This Special Role also acts as your Trope, so no separate Trope is chosen.</p>:<><ChoiceGrid label="Tropes" values={needsRoleTrope?Object.fromEntries(Object.entries(data.tropes.tropes).filter(([id,value])=>id!==firstTropeId&&(!role.doubleTrope||!value.colorTrope))):data.tropes.tropes} selected={form.trope} onChange={value => setForm(current => ({ ...current, trope: value, tropeAttribute: null, tropeFeats: [], extraFeats: [] }))} /><h2>Raised Attribute</h2><div className="choices">{trope.attributes.map(attribute => <button disabled={attribute === roleAttr} className={tropeAttr === attribute ? 'selected' : ''} onClick={() => set('tropeAttribute', attribute)} key={attribute}>{attribute}{attribute === roleAttr ? ' · already raised' : ''}</button>)}</div></>}
    </>}

    {step === 2 && <div className="form-grid personal-data-grid">
      <RandomPersonalField label="Name" value={form.name} placeholder="Your hero's name" onChange={value=>set('name',value)} onRandomize={()=>randomizePersonal('name')} />
      <label>Age<select value={form.age} onChange={event => set('age', event.target.value)}><option>Young</option><option>Adult</option><option>Old</option></select></label>
      <RandomPersonalField label={role.origins?'Origin':'Job'} value={form.job} placeholder={(role.jobs||role.origins||[''])[0]} onChange={value=>set('job',value)} onRandomize={()=>randomizePersonal('job')} />
      <RandomPersonalField label="Catchphrase" value={form.catchphrase} placeholder={role.catchphrases?.[0]||trope?.quote||''} onChange={value=>set('catchphrase',value)} onRandomize={()=>randomizePersonal('catchphrase')} />
      <RandomPersonalField label="Flaw" value={form.flaw} placeholder={role.flaws?.[0]||''} onChange={value=>set('flaw',value)} onRandomize={()=>randomizePersonal('flaw')} />
    </div>}

    {step === 3 && <FreeSkills form={form} role={role.doubleTrope?{skills:[...role.skills,...roleTrope.skills]}:roleTrope||role} trope={trope} hero={hero} set={set} count={freePointCount} />}

    {step === 4 && <>
      <p>{role.actsAsTrope?'Choose three Special Role Feats; any listed automatic Feats are added for you.':role.extraTrope?'Choose one Feat from each Trope and two additional Feats for One of a Kind.':role.doubleTrope?'Choose two Power Guardian Feats from your Color Trope and one Feat from your second Trope. Transformation is automatic.':'Choose the Feats granted by your Role, Trope, and Age.'}</p>
      {roleCap>0&&<FeatPicker title={`Role Feats · ${form.roleFeats.length}/${roleCap}`} ids={(roleTrope||role).feats||[]} chosen={form.roleFeats} taken={[...form.tropeFeats,...form.extraFeats,...slots.forced]} cap={roleCap} data={data} onChange={value => set('roleFeats', value)} />}
      {tropeCap>0&&<FeatPicker title={`Trope Feat · ${form.tropeFeats.length}/${tropeCap}`} ids={trope.feats} chosen={form.tropeFeats} taken={[...form.roleFeats,...form.extraFeats,...slots.forced]} cap={tropeCap} data={data} onChange={value => set('tropeFeats', value)} />}
      {extraCap>0&&<FeatPicker title={`Additional Feats · ${form.extraFeats.length}/${extraCap}`} ids={(role.extraFeatPool==='all'?Object.keys(data.feats.feats):[...new Set([...(role.feats||[]),...(trope?.feats||[])])]).filter(id => data.feats.feats[id]?.repeatable || ![...form.roleFeats, ...form.tropeFeats].includes(id))} chosen={form.extraFeats} taken={[...form.roleFeats,...form.tropeFeats,...slots.forced]} cap={extraCap} data={data} onChange={value => set('extraFeats', value)} />}
    </>}

    {step === 5 && <>
      <p>Choose the offered starting gear. Every gun begins with two Mags.</p>
      <div className="gear-options">{(role.gear || []).map((spec, index) => <GearChoice key={index} index={index} spec={spec} data={data} value={form.gearChoices[index]} onChange={value => { const next = [...form.gearChoices]; next[index] = value; set('gearChoices', next) }} />)}</div>
      {hero && <><h2>Starting loadout</h2><ul className="gear-preview">{[...hero.gear.guns, ...hero.gear.items].map((item, index) => <li key={`${item.id}-${index}`}>{item.name}</li>)}</ul></>}
    </>}

    <button className="primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>{step === 5 ? 'Review hero' : 'Continue'}</button>
  </main>
}

export function GuidedReview({ initial, data, onHome, onImportMarkdown }) {
  const [hero, setHero] = useState(() => structuredClone(initial))
  const [editing, setEditing] = useState(false)
  const edit = (field, value) => {
    if (['role', 'trope', 'personal.age'].includes(field)) {
      const pins = { role: field === 'role' ? value : hero.role, trope: field === 'trope' ? value : hero.trope, age: field === 'personal.age' ? value : hero.personal.age, name: hero.personal.name, job: hero.personal.job, catchphrase: hero.personal.catchphrase, flaw: hero.personal.flaw }
      try { setHero(generateRandom(makeRng(Date.now()), data, pins)) } catch {}
      return
    }
    const next = structuredClone(hero), parts = field.split('.')
    let parent = next
    for (const part of parts.slice(0, -1)) parent = parent[part]
    parent[parts.at(-1)] = value
    if (!validateHero(next, data).length) setHero(next)
  }
  return <HeroSheet hero={hero} data={data} mode={editing ? 'edit' : 'play'} onHome={onHome} onEdit={edit} onWorkingChange={setHero} onToggleEdit={() => setEditing(value => !value)} onImportMarkdown={onImportMarkdown} />
}

function ChoiceGrid({ label, values, selected, onChange, alphabetical = false }) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('All books')
  const sources = ['All books', ...new Set(Object.values(values).map(value => value.packName || 'Corebook'))]
  const matches = Object.entries(values).filter(([, value]) => {
    const inSource = source === 'All books' || (value.packName || 'Corebook') === source
    const words = `${value.name} ${value.tagline || ''} ${value.blurb || ''}`.toLowerCase()
    return inSource && words.includes(query.toLowerCase())
  }).sort(alphabetical ? byName : () => 0)
  return <>
    <div className="choice-tools">
      <input className="choice-search" aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} />
      {sources.length > 2 && <div className="source-filter">{sources.map(name => <button key={name} className={source === name ? 'selected' : ''} onClick={() => setSource(name)}>{name}</button>)}</div>}
      <span className="choice-count">Showing {matches.length} of {Object.keys(values).length}</span>
    </div>
    <div className="card-grid">{matches.map(([id, value]) => <button key={id} className={`choice-card ${id === selected ? 'selected' : ''}`} onClick={() => onChange(id)}><strong>{value.name}</strong><small>{value.tagline || value.blurb}</small><small className="source">{value.packName || 'Corebook'}</small></button>)}</div>
  </>
}

function RandomPersonalField({label,value,placeholder,onChange,onRandomize}){
  return <label className="random-personal-field">{label}<div><input value={value} placeholder={placeholder} onChange={event=>onChange(event.target.value)}/><button type="button" aria-label={`Randomize ${label}`} title={`Randomize ${label}`} onClick={onRandomize}>↻ <span>Randomize</span></button></div></label>
}

function FreeSkills({ form, role, trope, hero, set, count=2 }) {
  return <>
    <p>Choose exactly {count} points. A Skill cannot exceed 3.</p>
    <div className="skill-grid free-points-grid">{Object.keys(hero?.skills || {}).map(skill => {
      const picked = form.freeSkillPoints.filter(value => value === skill).length
      const base = 1 + ((role.skills||[]).includes(skill) ? 1 : 0) + ((trope?.skills||[]).includes(skill) ? 1 : 0)
      const disabled = form.freeSkillPoints.length >= count || base + picked >= 3
      return <button key={skill} disabled={disabled && !picked} className={picked ? 'selected' : ''} onClick={() => set('freeSkillPoints', picked ? form.freeSkillPoints.filter((value, index) => value !== skill || index !== form.freeSkillPoints.lastIndexOf(skill)) : [...form.freeSkillPoints, skill])}><span>{skill}</span><Dots value={base + picked} max={3} label={skill} className="skill-dots" /></button>
    })}</div>
    <strong className="points-status">{count - form.freeSkillPoints.length} points remaining</strong>
  </>
}

function FeatPicker({ title, ids, chosen, taken = [], cap, data, onChange }) {
  return <section><h2>{title}</h2><div className="feat-grid">{ids.map(id => {
    const feat = data.feats.feats[id] || {}, count = chosen.filter(value => value === id).length, otherCount = taken.filter(value => value === id).length, limit = feat.repeatable ? (feat.maxRanks || cap + taken.length) : 1
    if (feat.repeatable) return <article key={id} className={`feat-card repeatable-feat ${count ? 'selected' : ''}`}><strong>{feat.name || id}</strong><small>{feat.summary || 'No summary available.'}</small><div><button type="button" aria-label={`Remove ${feat.name || id}`} disabled={!count} onClick={() => { const index = chosen.lastIndexOf(id); onChange(chosen.filter((_, chosenIndex) => chosenIndex !== index)) }}>−</button><b>{count}× <span>Repeatable</span></b><button type="button" aria-label={`Add ${feat.name || id}`} disabled={chosen.length >= cap || count + otherCount >= limit} onClick={() => onChange([...chosen, id])}>+</button></div></article>
    return <button key={id} disabled={!count && (chosen.length >= cap || otherCount > 0)} className={`feat-card ${count ? 'selected' : ''}`} onClick={() => onChange(count ? chosen.filter(value => value !== id) : [...chosen, id])}><strong>{feat.name || id}</strong><small>{feat.summary || 'No summary available.'}</small></button>
  })}</div></section>
}

function GearChoice({ index, spec, data, value, onChange }) {
  let ids = []
  const all = [...Object.entries(data.gear.items), ...Object.entries(data.gear.weapons || data.gear.guns)]
  if (Array.isArray(spec.choice)) ids = spec.choice
  else if (spec.choice === 'any_gun') ids = Object.keys(data.gear.guns)
  else if (spec.choice === 'any_weapon') ids = Object.keys(data.gear.weapons || data.gear.guns)
  else if (spec.choice === 'any_1cash_item') ids = all.filter(([, item]) => item.cost === 1).map(([id]) => id)
  else if (spec.choice === 'any_2cash_item') ids = all.filter(([, item]) => item.cost === 2).map(([id]) => id)
  else if (spec.choice === 'any_precious_item' || spec.choice === 'precious_item') ids = Object.entries(data.gear.items).filter(([, item]) => item.precious || item.cost >= 3).map(([id]) => id)
  else if (spec.choice === 'any_item') ids = all.map(([id]) => id)
  else if (spec.ride) ids = Object.entries(data.gear.rides).filter(([, ride]) => ride.speed === spec.ride.speed).map(([id]) => id)
  if (!ids.length) {
    const budget = typeof spec.choice === 'string' && spec.choice.match(/^any_(\d+)cash_items$/)
    return budget ? <div className="gear-choice">Choice {index + 1}<small> {budget[1]} Cash worth of items will be selected automatically.</small></div> : null
  }
  return <label className="gear-choice">Choice {index + 1}<select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">Random legal choice</option>{ids.map(id => <option key={id} value={id}>{data.gear.gear[id]?.name || id}</option>)}</select></label>
}
