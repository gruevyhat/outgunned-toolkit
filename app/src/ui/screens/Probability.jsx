import React, { useState } from 'react'
import { actionSuccessProbability, DIFFICULTIES } from '../../engine/actionRoll.js'

const DICE_POOLS = [2, 3, 4, 5, 6, 7, 8, 9]
const WIDTH = 900
const HEIGHT = 470
const FRAME = { left: 82, right: 28, top: 24, bottom: 68 }
const PLOT_WIDTH = WIDTH - FRAME.left - FRAME.right
const PLOT_HEIGHT = HEIGHT - FRAME.top - FRAME.bottom
const Y_TICKS = [0, 20, 40, 60, 80, 100]

const xFor = dice => FRAME.left + ((dice - 2) / 7) * PLOT_WIDTH
const yFor = probability => FRAME.top + (1 - probability) * PLOT_HEIGHT
const formatProbability = probability => {
  const percent = probability * 100
  return `${percent.toFixed(percent > 0 && percent < 10 ? 1 : 0)}%`
}

export const probabilitySeries = () => DIFFICULTIES.map((difficulty, index) => ({
  ...difficulty,
  color: index + 1,
  points: DICE_POOLS.map(dice => ({ dice, probability: actionSuccessProbability(dice, difficulty.value) })),
}))

export default function Probability({ onBack }) {
  const series = probabilitySeries()
  const [active, setActive] = useState(null)
  const showDice = (dice, top = 48) => setActive({ dice, top })
  const activeValues = active ? series.map(item => ({ ...item, probability: item.points.find(point => point.dice === active.dice).probability })) : []
  return <main className="panel probability-page">
    <button className="link" onClick={onBack}>← Home</button>
    <div className="tool-intro"><div><p className="eyebrow">Know the odds</p><h1>Success Probability</h1><p className="probability-intro">The cumulative chance of passing each difficulty on the initial roll, before a Re-roll.</p></div></div>

    <section className="probability-chart" aria-labelledby="probability-chart-title">
      <h2 id="probability-chart-title">Chance of success by dice pool</h2>
      <div className="probability-legend" aria-label="Difficulty legend">
        {series.map(item => <span key={item.label} className={`probability-key probability-series-${item.color}`}><i aria-hidden="true" />{item.label}</span>)}
      </div>
      <div className="probability-plot-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Success probabilities by dice pool" aria-describedby="probability-svg-description" onMouseLeave={() => setActive(null)}>
        <desc id="probability-svg-description">Four connected lines show the chance of a Basic, Critical, Extreme, or Impossible success with dice pools from two to nine.</desc>

        {Y_TICKS.map(tick => {
          const y = yFor(tick / 100)
          return <g key={tick} className="probability-gridline"><line x1={FRAME.left} x2={WIDTH - FRAME.right} y1={y} y2={y} /><text x={FRAME.left - 13} y={y + 5} textAnchor="end">{tick}%</text></g>
        })}
        <line className="probability-axis" x1={FRAME.left} x2={FRAME.left} y1={FRAME.top} y2={HEIGHT - FRAME.bottom} />
        <line className="probability-axis" x1={FRAME.left} x2={WIDTH - FRAME.right} y1={HEIGHT - FRAME.bottom} y2={HEIGHT - FRAME.bottom} />

        {DICE_POOLS.map(dice => <g key={dice} className="probability-x-tick"><line x1={xFor(dice)} x2={xFor(dice)} y1={HEIGHT - FRAME.bottom} y2={HEIGHT - FRAME.bottom + 7} /><text x={xFor(dice)} y={HEIGHT - FRAME.bottom + 28} textAnchor="middle">{dice}</text></g>)}
        <text className="probability-axis-title" x={FRAME.left + PLOT_WIDTH / 2} y={HEIGHT - 13} textAnchor="middle">Number of dice</text>
        <text className="probability-axis-title" x={20} y={FRAME.top + PLOT_HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 20 ${FRAME.top + PLOT_HEIGHT / 2})`}>Probability of success</text>

        {series.map(item => {
          const points = item.points.map(point => `${xFor(point.dice)},${yFor(point.probability)}`).join(' ')
          return <g key={item.label} data-series={item.label} className={`probability-line probability-series-${item.color}`}>
            <polyline points={points} />
            {item.points.map(point => <circle key={point.dice} cx={xFor(point.dice)} cy={yFor(point.probability)} r="7"><title>{`${item.label}: ${formatProbability(point.probability)} with ${point.dice} dice`}</title></circle>)}
          </g>
        })}
        {active && <line className="probability-hover-guide" x1={xFor(active.dice)} x2={xFor(active.dice)} y1={FRAME.top} y2={HEIGHT - FRAME.bottom} aria-hidden="true" />}
        {DICE_POOLS.map(dice => {
          const band = PLOT_WIDTH / 7
          const x = Math.max(FRAME.left, xFor(dice) - band / 2)
          const width = Math.min(WIDTH - FRAME.right, xFor(dice) + band / 2) - x
          return <rect key={dice} className="probability-hit" x={x} y={FRAME.top} width={width} height={PLOT_HEIGHT} tabIndex="0" role="button" aria-label={`Show probabilities for ${dice} dice`} onMouseMove={event => { const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect(); showDice(dice, Math.max(8, Math.min(88, (event.clientY - bounds.top) / bounds.height * 100))) }} onFocus={() => showDice(dice)} onBlur={() => setActive(null)} onClick={() => showDice(dice)} onKeyDown={event => { if (event.key === 'Escape') { setActive(null); event.currentTarget.blur() } }} />
        })}
      </svg>
      {active && <div className="probability-tooltip" role="tooltip" style={{left:`${xFor(active.dice) / WIDTH * 100}%`,top:`${active.top}%`,transform:`translate(${active.dice <= 3 ? '0' : active.dice >= 8 ? '-100%' : '-50%'}, ${active.top > 52 ? 'calc(-100% - 12px)' : '12px'})`}}><strong>{active.dice} dice</strong>{activeValues.map(item => <span key={item.label} className={`probability-tooltip-row probability-series-${item.color}`}><i aria-hidden="true" />{item.label}<b>{formatProbability(item.probability)}</b></span>)}</div>}
      </div>
    </section>

    <p className="probability-rule"><strong>Three for one:</strong> Three smaller successes combine into one greater success, and a greater success may be spent as three smaller successes.</p>
  </main>
}
