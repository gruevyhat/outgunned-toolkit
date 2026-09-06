import React,{useState} from 'react'
import {makeRng} from '../../engine/dice.js'
import {campaignMarkdown,generateCampaign,rerollField} from '../../engine/mission.js'
import {encodeCampaign} from '../../engine/share.js'

const show=v=>typeof v==='string'?v:Object.values(v||{}).join(' / ')
export default function Mission({data,onBack,initial}){
  const [campaign,setCampaign]=useState(()=>initial||generateCampaign(makeRng(Date.now()),data.missionTables))
  const edit=(key,value)=>setCampaign(c=>({...c,[key]:value}))
  const reroll=path=>setCampaign(c=>{const n=rerollField(makeRng(Date.now()),c,path,data.missionTables);if(path==='villain')n.villain={...c.villain,...n.villain};return n})
  return <main className="panel mission"><button className="link" onClick={onBack}>← Menu</button>
    <div className="title-row"><h1>Assistant Director</h1><button className="primary" onClick={()=>setCampaign(generateCampaign(makeRng(Date.now()),data.missionTables))}>🎲 ROLL EVERYTHING</button></div>
    <div className="form-grid"><label>Campaign name<input value={campaign.name} onChange={e=>edit('name',e.target.value)}/></label><label>Setting<input value={campaign.setting} onChange={e=>edit('setting',e.target.value)}/></label></div>
    <Section title="Villain" value={show(campaign.villain.value)} onRoll={()=>reroll('villain')}/><Section title="Strong Spots" value={campaign.villain.strongSpots.map(x=>show(x.value)).join(' · ')}/><Section title="Weak Spots" value={campaign.villain.weakSpots.map(x=>show(x.value)).join(' · ')}/><Section title="Approach Keywords" value={campaign.villain.approaches.map(x=>show(x.value)).join(' · ')}/>
    <div className="form-grid"><label>Mission<textarea value={campaign.mission} onChange={e=>edit('mission',e.target.value)}/></label><label>Stakes<textarea value={campaign.stakes} onChange={e=>edit('stakes',e.target.value)}/></label></div>
    <h2>Allies</h2>{campaign.allies.map((a,i)=><div className="form-grid" key={i}><Section title={`Ally ${i+1}: Help`} value={show(a.help.value)} onRoll={()=>reroll(`allies.${i}.help`)}/><Section title="Flaw" value={show(a.flaw.value)} onRoll={()=>reroll(`allies.${i}.flaw`)}/></div>)}
    <h2>Leads / MacGuffins</h2>{campaign.leads.map((x,i)=><Section key={i} title={`Lead ${i+1}`} value={show(x.value)} onRoll={()=>reroll(`leads.${i}`)}/>)}
    <h2>Campaign Phases</h2><div className="card-grid">{campaign.phases.map((p,i)=><article className="choice-card" key={p.index}><h3>{p.name||`Phase ${p.index}`}</h3><small>{p.shots} · {p.purpose}</small><label>Aim<input value={p.aim} onChange={e=>setCampaign(c=>{const n=structuredClone(c);n.phases[i].aim=e.target.value;return n})}/></label><p><button onClick={()=>reroll(`phases.${i}.hurdle`)}>🎲</button> {show(p.hurdle.value)}</p><p><button onClick={()=>reroll(`phases.${i}.climax`)}>🎲</button> <strong>Climax:</strong> {show(p.climax.value)}</p>{p.twist&&<p><button onClick={()=>reroll(`phases.${i}.twist`)}>🎲</button> <strong>Twist:</strong> {show(p.twist.value)}</p>}</article>)}</div>
    <div className="actions"><button onClick={()=>navigator.clipboard.writeText(campaignMarkdown(campaign))}>COPY MARKDOWN</button><button onClick={()=>navigator.clipboard.writeText(`${location.href.split('#')[0]}${encodeCampaign(campaign)}`)}>COPY LINK</button></div>
  </main>
}
function Section({title,value,onRoll}){return <section className="rolled"><h2>{title} {onRoll&&<button aria-label={`Reroll ${title}`} onClick={onRoll}>🎲</button>}</h2><p>{value}</p></section>}
