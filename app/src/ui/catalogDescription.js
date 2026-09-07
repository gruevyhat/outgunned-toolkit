const clippedTagline=(value,splitCommas=true)=>String(value||'').trim().replace(/^(?:a|an)\s+/i,'').replace(splitCommas?/,\s*/g:/$^/g,'. ').replace(/\s+(?:who|that)\s+/gi,'. ').replace(/\s+/g,' ').toUpperCase()
export function catalogDescription(item={}){
  const authored=item.blurb||item.tagline||item.prompt||item.summary
  if(authored)return clippedTagline(authored)
  return ''
}
