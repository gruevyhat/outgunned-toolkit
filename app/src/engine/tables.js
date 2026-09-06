import { coin, d6, d66 } from './dice.js'

function rangeContains(spec, value) {
  if (typeof spec === 'number') return spec === value
  const [a, b = a] = String(spec).split('-').map(Number)
  return value >= a && value <= b
}
export function validateTable(table) {
  const errors = []
  if (!['d6', 'd66', 'd6x2', 'd6xcoin'].includes(table?.die)) errors.push('Invalid die')
  if (!Array.isArray(table?.rows) || !table.rows.length) errors.push('Rows required')
  if (!Array.isArray(table?.columns) || !table.columns.length) errors.push('Columns required')
  for (const row of table?.rows || []) for (const col of table.columns || []) if (!(col in row)) errors.push(`Missing ${col} at ${row.roll}`)
  const space = table?.die === 'd6' ? [1,2,3,4,5,6] : table?.die === 'd66' ? Array.from({length:36},(_,i)=>(Math.floor(i/6)+1)*10+i%6+1) : []
  for (const n of space) if ((table.rows || []).filter(r => rangeContains(r.roll, n)).length !== 1) errors.push(`Roll ${n} is not covered exactly once`)
  return [...new Set(errors)]
}
export function roll(rng, table) {
  const errors = validateTable(table); if (errors.length) throw new Error(errors.join('; '))
  if (table.die === 'd6') { const value = d6(rng); return { roll: value, row: table.rows.find(r => rangeContains(r.roll, value)) } }
  if (table.die === 'd66') { const value = d66(rng); return { roll: value, row: table.rows.find(r => rangeContains(r.roll, value)) } }
  const first = d6(rng)
  if (table.die === 'd6x2') { const second = d6(rng), index=Math.min(table.columns.length-1,Math.floor((second-1)*table.columns.length/6)); return { roll: [first, second], row: table.rows[first - 1], column: table.columns[index] } }
  const side = coin(rng); return { roll: [first, side], row: table.rows[first - 1], column: table.columns[side] }
}
