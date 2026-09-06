import React, { useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { campaignMarkdown, generateCampaign, rerollField } from '../../engine/mission.js'
import { encodeCampaign } from '../../engine/share.js'

const show = value => typeof value === 'string' ? value : Object.values(value || {}).join(' / ')

export default function Mission({ data, onBack, initial }) {
  const [campaign, setCampaign] = useState(() => initial || generateCampaign(makeRng(Date.now()), data.missionTables))
  const edit = (key, value) => setCampaign(current => ({ ...current, [key]: value }))
  const reroll = path => setCampaign(current => {
    const next = rerollField(makeRng(Date.now()), current, path, data.missionTables)
    if (path === 'villain') next.villain = { ...current.villain, ...next.villain }
    return next
  })
  const rollEverything = () => setCampaign(generateCampaign(makeRng(Date.now()), data.missionTables))
  const copyMarkdown = () => navigator.clipboard.writeText(campaignMarkdown(campaign))
  const copyLink = () => navigator.clipboard.writeText(`${location.href.split('#')[0]}${encodeCampaign(campaign)}`)

  return <main className="panel mission">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Mission workspace</p><h1>Assistant Director</h1></div></div>
    <div className="mission-actions"><button className="primary" onClick={rollEverything}>↻ Roll everything</button><button onClick={copyMarkdown}>Copy Markdown</button><button onClick={copyLink}>Copy link</button></div>

    <section className="mission-group">
      <div className="form-grid"><label>Campaign name<input value={campaign.name} placeholder="Give this campaign a title" onChange={event => edit('name', event.target.value)} /></label><label>Setting<input value={campaign.setting} placeholder="Where and when does it happen?" onChange={event => edit('setting', event.target.value)} /></label></div>
    </section>

    <section className="mission-group"><h2>The Villain</h2><div className="mission-grid">
      <Section title="Nature, Desire & Problem" value={show(campaign.villain.value)} onRoll={() => reroll('villain')} />
      <Section title="Strong Spots" value={campaign.villain.strongSpots.map(item => show(item.value)).join(' · ')} />
      <Section title="Weak Spots" value={campaign.villain.weakSpots.map(item => show(item.value)).join(' · ')} />
      <Section title="Approach Keywords" value={campaign.villain.approaches.map(item => show(item.value)).join(' · ')} />
    </div></section>

    <section className="mission-group"><h2>Mission & Stakes</h2><div className="form-grid"><label>What must the Heroes do?<textarea value={campaign.mission} placeholder="The Heroes must…" onChange={event => edit('mission', event.target.value)} /></label><label>What happens if they fail?<textarea value={campaign.stakes} placeholder="If they fail…" onChange={event => edit('stakes', event.target.value)} /></label></div></section>

    <section className="mission-group"><h2>Allies</h2><div className="mission-grid">{campaign.allies.flatMap((ally, index) => [
      <Section key={`help-${index}`} title={`Ally ${index + 1} · Help`} value={show(ally.help.value)} onRoll={() => reroll(`allies.${index}.help`)} />,
      <Section key={`flaw-${index}`} title={`Ally ${index + 1} · Flaw`} value={show(ally.flaw.value)} onRoll={() => reroll(`allies.${index}.flaw`)} />,
    ])}</div></section>

    <section className="mission-group"><h2>Leads / MacGuffins</h2><div className="mission-grid">{campaign.leads.map((lead, index) => <Section key={index} title={`Lead ${index + 1}`} value={show(lead.value)} onRoll={() => reroll(`leads.${index}`)} />)}</div></section>

    <section className="mission-group"><h2>Campaign Phases</h2><div className="phase-grid">{campaign.phases.map((phase, index) => <article className="phase-card" key={phase.index}>
      <header><h3>{phase.name || `Phase ${phase.index}`}</h3><small>{phase.shots} · {phase.purpose}</small></header>
      <label>Aim<input value={phase.aim} placeholder="The Heroes aim to…" onChange={event => setCampaign(current => { const next = structuredClone(current); next.phases[index].aim = event.target.value; return next })} /></label>
      <PhaseResult label="Hurdle" value={show(phase.hurdle.value)} onRoll={() => reroll(`phases.${index}.hurdle`)} />
      <PhaseResult label="Climax" value={show(phase.climax.value)} onRoll={() => reroll(`phases.${index}.climax`)} />
      {phase.twist && <PhaseResult label="Twist" value={show(phase.twist.value)} onRoll={() => reroll(`phases.${index}.twist`)} />}
    </article>)}</div></section>
  </main>
}

function Section({ title, value, onRoll }) {
  return <article className="rolled-card"><h3><span>{title}</span>{onRoll && <button className="roll-button" aria-label={`Reroll ${title}`} title={`Reroll ${title}`} onClick={onRoll}>↻</button>}</h3><p>{value}</p></article>
}

function PhaseResult({ label, value, onRoll }) {
  return <div className="phase-result"><button className="roll-button" aria-label={`Reroll ${label}`} title={`Reroll ${label}`} onClick={onRoll}>↻</button><div><strong>{label}</strong><p>{value}</p></div></div>
}
