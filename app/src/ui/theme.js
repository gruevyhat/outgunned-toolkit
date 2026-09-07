/**
 * The visual vocabulary for the toolkit.  Keeping the values in one object
 * makes the screens usable without a CSS framework and keeps the single-file
 * build self contained.
 */
export const theme = {
  colors: {
    paper: '#f3ede0',
    paperDark: '#e5dac5',
    ink: '#17161a',
    red: '#c8202f',
    redDark: '#941726',
    muted: '#6b6660',
    white: '#fffaf0',
    line: '#b9ad9b',
    disabled: '#aaa39a',
    success: '#315f45',
  },
  fonts: {
    display: '"Arial Narrow", Impact, sans-serif',
    body: 'Arial, Helvetica, sans-serif',
    mono: '"SFMono-Regular", Consolas, monospace',
  },
  radii: { sm: 3, md: 7, lg: 12 },
  shadow: '0 2px 9px rgba(23, 22, 26, .13)',
  space: { xs: 4, sm: 8, md: 12, lg: 18, xl: 28 },
};

export const styles = {
  app: {
    minHeight: '100vh',
    color: theme.colors.ink,
    backgroundColor: theme.colors.paper,
    backgroundImage:
      'linear-gradient(115deg, rgba(255,255,255,.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.08) 75%)',
    backgroundSize: '7px 7px',
    fontFamily: theme.fonts.body,
  },
  page: {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 34px)',
    boxSizing: 'border-box',
  },
  card: {
    background: 'rgba(255, 250, 240, .78)',
    border: `1px solid ${theme.colors.line}`,
    borderRadius: theme.radii.md,
    boxShadow: theme.shadow,
    padding: theme.space.lg,
  },
  display: {
    fontFamily: theme.fonts.display,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  button: {
    appearance: 'none',
    border: `1px solid ${theme.colors.ink}`,
    borderRadius: theme.radii.sm,
    background: theme.colors.paper,
    color: theme.colors.ink,
    cursor: 'pointer',
    fontFamily: theme.fonts.display,
    fontSize: 15,
    letterSpacing: '.04em',
    padding: '10px 14px',
    textTransform: 'uppercase',
  },
  primaryButton: {
    background: theme.colors.red,
    border: `1px solid ${theme.colors.red}`,
    color: theme.colors.white,
  },
};

export default theme;
