import React from 'react'
import {describe,expect,it} from 'vitest'
import {renderToString} from 'react-dom/server'
import App,{initialEnabledPacks} from '../../src/ui/App.jsx'

describe('book selection',()=>{
  it('enables every installed book for a first visit',()=>{
    expect(initialEnabledPacks({getItem:()=>null})).toEqual(['adventure','superheroes','supplements'])
    const html=renderToString(<App/>)
    expect(html).toContain('Books in play · ')
    expect(html).toContain('>4<!-- --> active')
  })

  it('restores valid saved choices and ignores removed packs',()=>{
    const storage={getItem:()=>JSON.stringify(['superheroes','retired-pack'])}
    expect(initialEnabledPacks(storage)).toEqual(['superheroes'])
  })
})
