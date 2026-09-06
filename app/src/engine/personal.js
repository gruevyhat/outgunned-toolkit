import { pick } from './dice.js'

const CATCHPHRASES = {
  brawn: ['Let’s do this the hard way.', 'Stand back. I’ve got this.'],
  nerves: ['Keep up.', 'I never miss twice.'],
  smooth: ['Trust me.', 'Try to keep your eyes on the mission.'],
  focus: ['I’ve got a plan.', 'There is always another angle.'],
  crime: ['You never saw me.', 'Rules are more like suggestions.'],
}
const FLAWS = {
  brawn: ['I act before I think.', 'I try to solve every problem with force.'],
  nerves: ['I never know when to back down.', 'I take reckless chances under pressure.'],
  smooth: ['I cannot resist an audience.', 'I promise more than I can deliver.'],
  focus: ['I lose sight of people when chasing an answer.', 'I need proof before I trust anyone.'],
  crime: ['I trust no one.', 'I bend the rules even when I should not.'],
}
const GENERIC_CATCHPHRASES = ['Not on my watch.', 'This is going to be fun.', 'We can still pull this off.']
const GENERIC_FLAWS = ['I always make things personal.', 'I cannot leave well enough alone.', 'I hate asking for help.']
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))]
const roleName = role => (role?.name || 'Hero').replace(/^The\s+/i, '')

export function personalOptions(field,{role={},trope={},attributes=[]}={}){
  if(field==='job'){
    const authored=unique(role.jobs?.length?role.jobs:role.origins||[])
    return authored.length?authored:[roleName(role)]
  }
  if(field==='catchphrase'){
    const authored=unique([...(role.catchphrases||[]),trope.quote])
    return authored.length?authored:unique([...attributes.flatMap(attribute=>CATCHPHRASES[attribute]||[]),...GENERIC_CATCHPHRASES])
  }
  if(field==='flaw'){
    const authored=unique(role.flaws||[])
    return authored.length?authored:unique([...attributes.flatMap(attribute=>FLAWS[attribute]||[]),...GENERIC_FLAWS])
  }
  return []
}

export function randomPersonalValue(field,{data={},role={},trope={},attributes=[],current=''}={},rng=Math.random){
  if(field==='name'){
    const first=data.names?.first||data.names?.firstNames||data.names?.unisex||['Alex'],last=data.names?.last||data.names?.surnames||['Reed']
    let result=`${pick(rng,first)} ${pick(rng,last)}`
    if(result===current&&last.length>1)result=`${result.slice(0,result.lastIndexOf(' ')+1)}${last[(last.indexOf(result.split(' ').at(-1))+1)%last.length]}`
    return result
  }
  const options=personalOptions(field,{role,trope,attributes}),alternatives=options.filter(value=>value!==current)
  return pick(rng,alternatives.length?alternatives:options)
}
