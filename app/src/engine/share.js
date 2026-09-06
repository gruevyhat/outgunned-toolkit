const encodeUtf8=value=>btoa(unescape(encodeURIComponent(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const decodeUtf8=value=>decodeURIComponent(escape(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='))))
export function encodeHero(hero){ return `#h=${encodeUtf8(JSON.stringify(hero))}` }
export function encodeCampaign(campaign){ return `#m=${encodeUtf8(JSON.stringify(campaign))}` }
export function decodeHash(hash,validate,data){ const match=/^#([hm])=([A-Za-z0-9_-]+)$/.exec(hash||''); if(!match) return null; try { const value=JSON.parse(decodeUtf8(match[2])); if(match[1]==='h'&&validate){ const errors=validate(value,data); if(errors.length) return {type:'error',errors} } return {type:match[1]==='h'?'hero':'campaign',value} } catch { return {type:'error',errors:['Invalid share link']} } }
