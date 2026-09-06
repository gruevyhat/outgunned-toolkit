import { d6 } from './dice.js'

export const DIFFICULTIES = [
  { value: 2, label: 'Basic' },
  { value: 3, label: 'Critical' },
  { value: 4, label: 'Extreme' },
  { value: 5, label: 'Impossible' },
]

const levelName = count => count >= 6 ? 'Jackpot!' : `${DIFFICULTIES.find(level => level.value === count)?.label || 'Basic'} Success`
const unitsFor = count => count >= 6 ? Infinity : 3 ** (count - 2)

export function analyseActionRoll(dice, difficulty = 3) {
  const counts = dice.reduce((all, die) => ({ ...all, [die]: (all[die] || 0) + 1 }), {})
  const combinations = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([face, count]) => ({ face: Number(face), count, label: levelName(count) }))
    .sort((a, b) => b.count - a.count || a.face - b.face)
  const units = combinations.reduce((total, combination) => total + unitsFor(combination.count), 0)
  const passed = units >= 3 ** (difficulty - 2)
  return {
    combinations,
    passed,
    summary: combinations.length ? combinations.map(item => item.label).join(' + ') : 'No Success',
  }
}

export function rollAction({ attribute = 0, skill = 0, modifier = 0, difficulty = 3 }, rng = Math.random) {
  const pool = Math.max(2, Math.min(9, Number(attribute) + Number(skill) + Number(modifier)))
  const dice = Array.from({ length: pool }, () => d6(rng)).sort((a, b) => a - b)
  return { pool, dice, difficulty, ...analyseActionRoll(dice, difficulty) }
}
