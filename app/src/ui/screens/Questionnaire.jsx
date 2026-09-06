import React, { useEffect, useMemo, useState } from 'react'
import { makeRng } from '../../engine/dice.js'
import { drawQuestions, suggest } from '../../engine/questionnaire.js'

export default function Questionnaire({ data, onBack, onAccept, onRoll }) {
  const questions = useMemo(() => drawQuestions(makeRng(Date.now()), data.questionnaire, 16), [data])
  const [answers, setAnswers] = useState([])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [answers.length])

  if (answers.length === questions.length) {
    const result = suggest(answers, data)
    return <main className="panel">
      <button className="link" onClick={onBack}>← Home</button>
      <div className="tool-intro"><div><p className="eyebrow">Your shortlist</p><h1>Who are you?</h1></div></div>
      <p>These are your strongest matches. Use the leading Role and Trope to continue building, or let the dice take over.</p>
      <div className="results-grid"><Results title="Roles" values={result.roles} /><Results title="Tropes" values={result.tropes} /></div>
      <div className="actions"><button className="primary" onClick={() => onAccept(result)}>Use these choices</button><button onClick={onRoll}>Just roll it</button></div>
    </main>
  }

  const question = questions[answers.length]
  return <main className="panel quiz">
    <button className="link" onClick={answers.length ? () => setAnswers(current => current.slice(0, -1)) : onBack}>{answers.length ? '← Previous question' : '← Home'}</button>
    <div className="progress" aria-label={`Question ${answers.length + 1} of ${questions.length}`}><i style={{ width: `${(answers.length + 1) / questions.length * 100}%` }} /></div>
    <p className="eyebrow">Question {answers.length + 1} / {questions.length}</p>
    <h1>{question.prompt}</h1>
    <div className="stack">{question.answers.map((answer, index) => <button className="answer" key={index} onClick={() => setAnswers(current => [...current, answer])}><span>{String.fromCharCode(65 + index)}.</span> {answer.text}</button>)}</div>
  </main>
}

function Results({ title, values }) {
  const max = Math.max(1, ...values.map(value => value.score))
  return <section className="result-card"><h2>{title}</h2>{values.map((value, index) => <div className="score" key={value.id}><span>{index === 0 ? '★ ' : ''}{value.name}</span><span className="score-track"><i style={{ width: `${value.score / max * 100}%` }} /></span><b>{value.score}</b></div>)}</section>
}
