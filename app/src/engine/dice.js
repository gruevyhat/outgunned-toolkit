export function makeRng(seed = Date.now()) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed))
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
function hashSeed(value) { let h = 2166136261; for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
export const d6 = rng => Math.floor(rng() * 6) + 1
export const coin = rng => rng() < .5 ? 0 : 1
export const d66 = rng => d6(rng) * 10 + d6(rng)
export function pick(rng, values) { if (!values?.length) throw new Error('Cannot pick from an empty list'); return values[Math.floor(rng() * values.length)] }
export function shuffle(rng, values) { const out = [...values]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] } return out }
