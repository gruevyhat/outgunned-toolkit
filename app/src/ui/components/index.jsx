import React from 'react';
import { styles, theme } from '../theme.js';

export function Dots({ value = 0, max = 3, label, className = '' }) {
  const count = Math.max(0, Math.min(Number(value) || 0, max));
  return (
    <span className={`dots ${className}`} aria-label={`${label || 'Score'} ${count} of ${max}`} style={{display:'inline-flex',alignItems:'center',gap:4,lineHeight:1}}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 11,
            height: 11,
            boxSizing: 'border-box',
            borderRadius: '50%',
            border: `1.5px solid var(--dot-color, ${theme.colors.ink})`,
            background: i < count ? `var(--dot-fill, ${theme.colors.ink})` : 'transparent',
            flex: '0 0 auto',
          }}
        />
      ))}
    </span>
  );
}

export function Tracker({ value = 0, max = 1, label, filled = '✓', onChange }) {
  const count = Math.max(0, Math.min(Number(value) || 0, max));
  return (
    <span aria-label={`${label || 'Tracker'} ${count} of ${max}`} style={{display:'inline-grid',gridTemplateColumns:`repeat(${max}, 20px)`,alignItems:'center',gap:4,lineHeight:1}}>
      {Array.from({ length: max }, (_, i) => (
        <button
          type="button"
          key={i}
          aria-label={`${label || 'Tracker'} ${i + 1}`}
          aria-pressed={i < count}
          disabled={!onChange}
          onClick={()=>onChange?.(i < count ? i : i + 1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            margin: 0,
            padding: 0,
            border: `1.5px solid ${theme.colors.ink}`,
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 900,
            lineHeight: 1,
            color: i < count ? theme.colors.white : 'transparent',
            background: i < count ? theme.colors.redDark : theme.colors.white,
            cursor: onChange ? 'pointer' : 'default',
            opacity: 1,
          }}
        >
          {i < count ? filled : ' '}
        </button>
      ))}
    </span>
  );
}

export function Banner({ children, as: Tag = 'h2', style: styleProp, ...props }) {
  return (
    <Tag
      {...props}
      style={{
        ...styles.display,
        background: theme.colors.red,
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
        color: theme.colors.white,
        fontSize: 15,
        lineHeight: 1.3,
        margin: 0,
        padding: '6px 16px 6px 10px',
        ...styleProp,
      }}
    >
      {children}
    </Tag>
  );
}

export function Button({ children, primary = false, style: styleProp, type = 'button', ...props }) {
  return (
    <button
      {...props}
      type={type}
      style={{ ...styles.button, ...(primary ? styles.primaryButton : {}), ...styleProp }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, style: styleProp }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0, ...styleProp }}>
      <span style={{ ...styles.display, color: theme.colors.muted, fontSize: 11 }}>{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, children, style: styleProp }) {
  return (
    <section style={{ ...styles.card, padding: 0, overflow: 'hidden', ...styleProp }}>
      {title ? <Banner>{title}</Banner> : null}
      <div style={{ padding: theme.space.md }}>{children}</div>
    </section>
  );
}

export { theme, styles };

export default { Dots, Tracker, Banner, Button, Field, Section };
