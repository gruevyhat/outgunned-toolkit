export function isTropeAvailableToRole(trope,role,placement='trope'){
  if(!trope)return false
  if(trope.colorTrope)return placement==='role'&&Boolean(role?.doubleTrope)
  return true
}

export function availableTropes(catalog,role,placement='trope'){
  return Object.fromEntries(Object.entries(catalog||{}).filter(([,trope])=>isTropeAvailableToRole(trope,role,placement)))
}
