const RANGED_KINDS = new Set(['gun', 'firearm', 'energy_weapon', 'throwing_weapon', 'ranged_weapon', 'gadget_energy_weapon', 'gadget_ranged_weapon'])
const MELEE_KINDS = new Set(['melee', 'melee_weapon', 'gadget_melee_weapon'])

const featuresOf = item => (item?.features || []).map(feature => String(feature).toLowerCase())

export function isRangedWeapon(item = {}) {
  if (item.range || RANGED_KINDS.has(item.kind)) return true
  if (item.kind !== 'weapon') return false
  const features = featuresOf(item)
  return features.some(feature => ['single_shot', 'shoot_plus_1', 'ranged', 'throwing_weapon'].includes(feature))
}

export function isMeleeWeapon(item = {}) {
  return MELEE_KINDS.has(item.kind) || (item.kind === 'weapon' && !isRangedWeapon(item))
}

export function isWeapon(item = {}) {
  return isRangedWeapon(item) || isMeleeWeapon(item)
}

export function usesMags(item = {}) {
  if (!['gun', 'firearm'].includes(item.kind)) return false
  const features = featuresOf(item)
  return !features.some(feature => ['single_shot', 'laser', 'stream', 'junk_shooter'].includes(feature))
}

export function weaponModifier(item = {}) {
  if (Number.isFinite(Number(item.modifier))) return Number(item.modifier)
  return featuresOf(item).includes('shoot_plus_1') ? 1 : 0
}
