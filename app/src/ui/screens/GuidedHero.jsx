import React, { useEffect, useMemo, useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { generateRandom } from '../../engine/hero.js'
import { roleAttributeOptions } from '../../engine/build.js'
import { Dots } from '../components/index.jsx'
import HeroSheet from './HeroSheet.jsx'

const STEPS = ['Role', 'Personal Data', 'Trope', 'Free Points', 'Feats', 'Gear', 'Review']

export default function GuidedHero({ data, onBack, defaults = {} }) {
  const [step, setStep] = useState(defaults.role ? 1 : 0)
  const [form, setForm] = useState({
    role: defaults.role || Object.keys(data.roles.roles)[0],
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
  const trope = data.tropes.tropes[form.trope]
  const roleAttrs = roleAttributeOptions(role)
  const roleAttr = roleAttrs.includes(form.roleAttribute) ? form.roleAttribute : roleAttrs[0]
  const legalTropeAttrs = trope.attributes.filter(attribute => attribute !== roleAttr)
  const tropeAttr = legalTropeAttrs.includes(form.tropeAttribute) ? form.tropeAttribute : legalTropeAttrs[0] || trope.attributes[0]
  const roleCap = form.age === 'Young' ? 1 : 2
  const pins = { ...form, roleAttribute: roleAttr, tropeAttribute: tropeAttr }
  if (form.freeSkillPoints.length !== 2) delete pins.freeSkillPoints
  if (form.roleFeats.length !== roleCap) delete pins.roleFeats
  if (form.tropeFeats.length !== 1) delete pins.tropeFeats
  if (form.extraFeats.length !== (form.age === 'Old' ? 1 : 0)) delete pins.extraFeats

  const hero = useMemo(() => {
    try { return generateRandom(makeRng(73), data, pins) } catch { return null }
  }, [data, JSON.stringify(pins)])
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  if (step === 6 && hero) return <HeroSheet hero={hero} data={data} onHome={onBack} />

  const canContinue = !(step === 3 && form.freeSkillPoints.length !== 2)
    && !(step === 4 && (form.roleFeats.length !== roleCap || form.tropeFeats.length !== 1 || (form.age === 'Old' && form.extraFeats.length !== 1)))

  return <main className="panel wizard">
    <button className="link" onClick={step ? () => setStep(step - 1) : onBack}>{step ? '← Back' : '← Home'}</button>
    <div className="progress" aria-label={`Step ${step + 1} of 7`}><i style={{ width: `${(step + 1) / 7 * 100}%` }} /></div>
    <p className="eyebrow">Step {step + 1} / 7</p>
    <h1>{STEPS[step]}</h1>
    {step > 0 && <div className="wizard-summary"><span><strong>Role</strong> {role.name}</span><span><strong>Trope</strong> {trope.name}</span><span><strong>Age</strong> {form.age}</span></div>}

    {step === 0 && <>
      <ChoiceGrid label="Roles" values={data.roles.roles} selected={form.role} onChange={value => setForm(current => ({ ...current, role: value, roleAttribute: null, roleFeats: [], gearChoices: [] }))} />
      {roleAttrs.length > 1 && <><h2>Role Attribute</h2><div className="choices">{roleAttrs.map(attribute => <button key={attribute} className={roleAttr === attribute ? 'selected' : ''} onClick={() => set('roleAttribute', attribute)}>{attribute}</button>)}</div></>}
    </>}

    {step === 1 && <div className="form-grid">
      <label>Name<input value={form.name} placeholder="Your hero's name" onChange={event => set('name', event.target.value)} /></label>
      <label>Age<select value={form.age} onChange={event => set('age', event.target.value)}><option>Young</option><option>Adult</option><option>Old</option></select></label>
      <label>{role.origins ? 'Origin' : 'Job'}<input value={form.job} placeholder={(role.jobs || role.origins || [''])[0]} onChange={event => set('job', event.target.value)} /></label>
      <label>Catchphrase<input value={form.catchphrase} placeholder={role.catchphrases?.[0] || ''} onChange={event => set('catchphrase', event.target.value)} /></label>
      <label>Flaw<input value={form.flaw} placeholder={role.flaws?.[0] || ''} onChange={event => set('flaw', event.target.value)} /></label>
    </div>}

    {step === 2 && <>
      <ChoiceGrid label="Tropes" values={data.tropes.tropes} selected={form.trope} onChange={value => setForm(current => ({ ...current, trope: value, tropeAttribute: null, tropeFeats: [], extraFeats: [] }))} />
      <h2>Raised Attribute</h2>
      <div className="choices">{trope.attributes.map(attribute => <button disabled={attribute === roleAttr} className={tropeAttr === attribute ? 'selected' : ''} onClick={() => set('tropeAttribute', attribute)} key={attribute}>{attribute}{attribute === roleAttr ? ' · already raised' : ''}</button>)}</div>
    </>}

    {step === 3 && <FreeSkills form={form} role={role} trope={trope} hero={hero} set={set} />}

    {step === 4 && <>
      <p>{form.age === 'Young' ? 'Choose one Role Feat and one Trope Feat. Too Young to Die is automatic.' : form.age === 'Old' ? 'Choose two Role Feats, one Trope Feat, and one extra Feat.' : 'Choose two Role Feats and one Trope Feat.'}</p>
      <FeatPicker title={`Role Feats · ${form.roleFeats.length}/${roleCap}`} ids={role.feats} chosen={form.roleFeats} taken={[...form.tropeFeats,...form.extraFeats]} cap={roleCap} data={data} onChange={value => set('roleFeats', value)} />
      <FeatPicker title={`Trope Feat · ${form.tropeFeats.length}/1`} ids={trope.feats} chosen={form.tropeFeats} taken={[...form.roleFeats,...form.extraFeats]} cap={1} data={data} onChange={value => set('tropeFeats', value)} />
      {form.age === 'Old' && <FeatPicker title={`Extra Feat · ${form.extraFeats.length}/1`} ids={[...new Set([...role.feats, ...trope.feats])].filter(id => data.feats.feats[id]?.repeatable || ![...form.roleFeats, ...form.tropeFeats].includes(id))} chosen={form.extraFeats} taken={[...form.roleFeats,...form.tropeFeats]} cap={1} data={data} onChange={value => set('extraFeats', value)} />}
    </>}

    {step === 5 && <>
      <p>Choose the offered starting gear. Every gun begins with two Mags.</p>
      <div className="gear-options">{(role.gear || []).map((spec, index) => <GearChoice key={index} index={index} spec={spec} data={data} value={form.gearChoices[index]} onChange={value => { const next = [...form.gearChoices]; next[index] = value; set('gearChoices', next) }} />)}</div>
      {hero && <><h2>Starting loadout</h2><ul className="gear-preview">{[...hero.gear.guns, ...hero.gear.items].map((item, index) => <li key={`${item.id}-${index}`}>{item.name}</li>)}</ul></>}
    </>}

    <button className="primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>{step === 5 ? 'Review hero' : 'Continue'}</button>
  </main>
}

function ChoiceGrid({ label, values, selected, onChange }) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('All books')
  const sources = ['All books', ...new Set(Object.values(values).map(value => value.packName || 'Corebook'))]
  const matches = Object.entries(values).filter(([, value]) => {
    const inSource = source === 'All books' || (value.packName || 'Corebook') === source
    const words = `${value.name} ${value.tagline || ''} ${value.blurb || ''}`.toLowerCase()
    return inSource && words.includes(query.toLowerCase())
  })
  return <>
    <div className="choice-tools">
      <input className="choice-search" aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} />
      {sources.length > 2 && <div className="source-filter">{sources.map(name => <button key={name} className={source === name ? 'selected' : ''} onClick={() => setSource(name)}>{name}</button>)}</div>}
      <span className="choice-count">Showing {matches.length} of {Object.keys(values).length}</span>
    </div>
    <div className="card-grid">{matches.map(([id, value]) => <button key={id} className={`choice-card ${id === selected ? 'selected' : ''}`} onClick={() => onChange(id)}><strong>{value.name}</strong><small>{value.tagline || value.blurb}</small><small className="source">{value.packName || 'Corebook'}</small></button>)}</div>
  </>
}

function FreeSkills({ form, role, trope, hero, set }) {
  return <>
    <p>Choose exactly two points. A Skill cannot exceed 3.</p>
    <div className="skill-grid free-points-grid">{Object.keys(hero?.skills || {}).map(skill => {
      const picked = form.freeSkillPoints.filter(value => value === skill).length
      const base = 1 + (role.skills.includes(skill) ? 1 : 0) + (trope.skills.includes(skill) ? 1 : 0)
      const disabled = form.freeSkillPoints.length >= 2 || base + picked >= 3
      return <button key={skill} disabled={disabled && !picked} className={picked ? 'selected' : ''} onClick={() => set('freeSkillPoints', picked ? form.freeSkillPoints.filter((value, index) => value !== skill || index !== form.freeSkillPoints.lastIndexOf(skill)) : [...form.freeSkillPoints, skill])}><span>{skill}</span><Dots value={base + picked} max={3} label={skill} className="skill-dots" /></button>
    })}</div>
    <strong className="points-status">{2 - form.freeSkillPoints.length} points remaining</strong>
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
  const all = [...Object.entries(data.gear.items), ...Object.entries(data.gear.guns)]
  if (Array.isArray(spec.choice)) ids = spec.choice
  else if (spec.choice === 'any_gun') ids = Object.keys(data.gear.guns)
  else if (spec.choice === 'any_weapon') ids = [...Object.keys(data.gear.guns), ...Object.entries(data.gear.items).filter(([, item]) => item.kind === 'melee').map(([id]) => id)]
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
