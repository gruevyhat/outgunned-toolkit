const titleCase=value=>String(value||'').replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())
const shortList=values=>values.length<2?values[0]||'':values.length===2?values.join(' and '):`${values.slice(0,-1).join(', ')}, and ${values.at(-1)}`
const asList=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.keys(value):value?[value]:[]
const sentenceCase=value=>{
  const text=String(value||'').trim()
  if(text!==text.toUpperCase())return text
  return text.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g,(_,prefix,letter)=>`${prefix}${letter.toUpperCase()}`)
}

export function catalogDescription(item={}){
  const authored=item.blurb||item.tagline||item.prompt||item.summary
  if(authored)return sentenceCase(authored)
  const name=String(item.name||'Hero').replace(/^The /,'')
  const attributes=[...asList(item.attributes),...asList(item.attributeChoices),...asList(item.fixedAttributes),...asList(item.attribute),...asList(item.attributePoints)].filter(value=>['brawn','nerves','smooth','focus','crime'].includes(value)).map(titleCase)
  const skills=(item.skills||[]).slice(0,3).map(titleCase)
  if(attributes.length&&skills.length)return `A ${name} driven by ${shortList(attributes)}, skilled at ${shortList(skills)}.`
  if(attributes.length)return `A ${name} driven by ${shortList(attributes)}.`
  if(skills.length)return `A ${name} skilled at ${shortList(skills)}.`
  return `A Hero who embodies the ${name} archetype.`
}
