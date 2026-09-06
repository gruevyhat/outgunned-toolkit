import React from 'react';
import { Banner, Button } from '../components/index.jsx';
import { styles, theme } from '../theme.js';

const OPTIONS = [
  ['random', 'Random Hero', 'One click. One larger-than-life action hero.'],
  ['guided', 'Guided Hero', 'Build your hero one choice at a time.'],
  ['quiz', 'Who Are You?', 'Answer a few questions and find your fit.'],
  ['crew', 'Assemble a Crew', 'Put together a team with no duplicate Roles.'],
  ['mission', 'New Mission', 'Give the Director a mission worth remembering.'],
  ['oracles', 'Oracles', 'Roll the tables when the story needs a push.'],
];

export default function Menu({ onNavigate, onSelectMode = onNavigate, packs = [], enabledPacks = [], onTogglePack, onImportMarkdown }) {
  const navigate = onSelectMode || onNavigate || (() => {});
  return (
    <main className="menu-page" style={{ ...styles.page, display: 'grid', gap: theme.space.xl }}>
      <header style={{ display: 'grid', gap: theme.space.sm, maxWidth: 700 }}>
        <Banner as="div" style={{ justifySelf: 'start', fontSize: 13 }}>Outgunned toolkit</Banner>
        <h1 style={{ ...styles.display, fontSize: 'clamp(36px, 10vw, 86px)', lineHeight: .86, margin: 0 }}>
          Make trouble.<br /><span style={{ color: theme.colors.red }}>Look cool.</span>
        </h1>
        <p style={{ color: theme.colors.muted, fontSize: 17, lineHeight: 1.45, margin: 0, maxWidth: 560 }}>
          Fast, table-ready play aids for cinematic heroes, impossible missions, and the crews who survive them.
        </p>
      </header>

      {packs.length ? <details className="books-card" style={styles.card}><summary id="books-in-play">Books in play · {enabledPacks.length+1} active</summary><div className="books-content"><p style={{color:theme.colors.muted}}>Core action is always available. Choose which genre books and supplements feed every character tool, including Weapons, Gear, and Rides. Your choices are remembered.</p><div className="pack-grid"><div className="pack-option is-checked"><span aria-hidden="true">✓</span><strong>Outgunned Corebook</strong><small>Always on</small></div>{packs.map(pack=>{const checked=enabledPacks.includes(pack.id);return <button type="button" key={pack.id} aria-pressed={checked} className={`pack-option ${checked?'is-checked':''}`} onClick={()=>onTogglePack?.(pack.id)}><span aria-hidden="true">{checked?'✓':''}</span><strong>{pack.name}</strong><small>{Object.keys(pack.roles).length} Roles · {Object.keys(pack.tropes).length} Tropes</small></button>})}</div></div></details> : null}

      <nav aria-label="Toolkit modes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: theme.space.md }}>
        {OPTIONS.map(([mode, title, description], index) => (
          <button
            type="button"
            key={mode}
            onClick={() => navigate(mode)}
            style={{
              ...styles.card,
              border: `1px solid ${index === 0 ? theme.colors.red : theme.colors.line}`,
              cursor: 'pointer',
              display: 'grid',
              gap: 8,
              minHeight: 120,
              textAlign: 'left',
              transition: 'transform .12s ease, box-shadow .12s ease',
            }}
          >
            <span style={{ ...styles.display, color: index === 0 ? theme.colors.red : theme.colors.ink, fontSize: 22 }}>
              {title}
            </span>
            <span style={{ color: theme.colors.muted, lineHeight: 1.4, textTransform: 'none' }}>{description}</span>
            <span style={{ ...styles.display, color: theme.colors.red, fontSize: 12 }}>Open  →</span>
          </button>
        ))}
      </nav>

      {onImportMarkdown&&<section className="character-import"><div><strong>Continue a character</strong><small>Upload a Markdown sheet exported by this toolkit. Its source books are enabled automatically.</small></div><label className="file-button">Upload Markdown<input type="file" accept=".md,text/markdown,text/plain" onChange={event=>{const file=event.target.files?.[0];if(file)onImportMarkdown(file);event.target.value='' }}/></label></section>}

      <footer style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 1.5, maxWidth: 760 }}>
        Outgunned is a game by Two Little Mice. This is an unofficial fan-made toolkit; it is not affiliated with or endorsed by the publisher.
      </footer>
    </main>
  );
}

export { Button };
