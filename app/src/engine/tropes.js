export function isTropeAvailableToRole(trope,role,placement='trope'){
  if(!trope)return false
  if(placement==='role'&&role?.doubleTrope)return Boolean(trope.colorTrope)
  if(trope.colorTrope)return false
  return true
}

export function availableTropes(catalog,role,placement='trope'){
  return Object.fromEntries(Object.entries(catalog||{}).filter(([,trope])=>isTropeAvailableToRole(trope,role,placement)))
}
