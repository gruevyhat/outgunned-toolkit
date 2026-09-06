import React,{useMemo,useState} from 'react'
import { makeRng } from '../../engine/dice.js'
import { drawQuestions,suggest } from '../../engine/questionnaire.js'

export default function Questionnaire({data,onBack,onAccept,onRoll}){
  const questions=useMemo(()=>drawQuestions(makeRng(Date.now()),data.questionnaire,16),[data]), [answers,setAnswers]=useState([])
  if(answers.length===questions.length){const result=suggest(answers,data); return <main className="panel"><button className="link" onClick={onBack}>← Menu</button><p className="eyebrow">YOUR SHORTLIST</p><h1>Who are you?</h1><Results title="Roles" values={result.roles}/><Results title="Tropes" values={result.tropes}/><div className="actions"><button className="primary" onClick={()=>onAccept(result)}>ACCEPT & FINISH</button><button onClick={onRoll}>JUST ROLL IT</button></div></main>}
  const q=questions[answers.length]; return <main className="panel quiz"><button className="link" onClick={answers.length?()=>setAnswers(a=>a.slice(0,-1)):onBack}>← Back</button><div className="progress"><i style={{width:`${answers.length/questions.length*100}%`}}/></div><p className="eyebrow">QUESTION {answers.length+1} / {questions.length}</p><h1>{q.prompt}</h1><div className="stack">{q.answers.map((a,i)=><button className="answer" key={i} onClick={()=>setAnswers(x=>[...x,a])}>{a.text}</button>)}</div></main>
}
function Results({title,values}){const max=Math.max(1,...values.map(x=>x.score));return <section><h2>{title}</h2>{values.map(x=><div className="score" key={x.id}><span>{x.name}</span><i style={{width:`${x.score/max*100}%`}}/></div>)}</section>}
