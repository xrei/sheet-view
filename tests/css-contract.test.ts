import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

// jsdom can't compute styles from imported CSS, so these guard the source of the
// CSS-only fixes: presence of the key rules, not their rendered effect. Verify the
// actual rendering once in the browser example. vitest runs from the package root.
const root = process.cwd()
const base = readFileSync(join(root, 'src', 'styles', 'base.css'), 'utf8')
const theme = readFileSync(join(root, 'src', 'styles', 'theme.css'), 'utf8')

describe('CSS contract', () => {
  it('#2 — content inputs are ≥16px so iOS never auto-zooms on focus', () => {
    expect(theme).toContain(':where(input, select, textarea)')
    expect(theme).toContain('font-size: max(1em, 16px)')
  })

  it('#4 — reduced-motion cross-fades the sheet in instead of sliding it (not a pop)', () => {
    expect(theme).toContain('@media (prefers-reduced-motion: reduce)')
    expect(theme).toMatch(/prefers-reduced-motion[\s\S]*sv-sheet-fade-in/)
    expect(theme).toContain('@keyframes sv-sheet-fade-in')
  })

  it('mobile open slides the card in with a compositor transform, not a scroll', () => {
    // iOS Safari won't animate scrollTo() inside a mandatory-snap scroller, so the
    // entrance is a GPU transform keyframe from translateY(100%) while the scroller
    // rests at the open snap point (drag-armed). focusOnOpen keeps its own rise-in.
    expect(theme).toContain('@keyframes sv-sheet-slide-up')
    expect(theme).toMatch(/@keyframes sv-sheet-slide-up[\s\S]*?translateY\(100%\)/)
    expect(theme).toMatch(
      /:not\(\[data-sheet-focus-open\]\)[\s\S]*?animation:[\s\S]*?sv-sheet-slide-up/,
    )
  })

  it('#8 — the close button has a ≥44px hit target in base.css (works themeless)', () => {
    expect(base).toContain('.sv-sheet__close::before')
    expect(base).toContain('width: max(100%, 44px)')
    expect(base).toContain('height: max(100%, 44px)')
  })

  it('the close button is reset in base.css so a global button {} can’t hijack it', () => {
    // Unlayered base.css at class specificity (0,1,0) beats a page/consumer
    // `button {}` reset (0,0,1); appearance:none drops the native face and
    // background:transparent lets the (possibly themed) card show through.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '') // strip comments (they contain { })
    expect(css).toMatch(/\.sv-sheet__close\s*\{[^}]*appearance:\s*none/)
    expect(css).toMatch(/\.sv-sheet__close\s*\{[^}]*background:\s*transparent/)
  })

  it('#13 — desktop backdrop-filter blur applies only in the open state', () => {
    expect(theme).toContain('backdrop-filter: none')
    expect(theme).toMatch(/data-sheet-state='open'[\s\S]*?backdrop-filter: blur/)
  })

  it('#14 — default palette follows the host color-scheme via light-dark(), OS fallback for old browsers', () => {
    // Modern browsers: the private per-scheme default resolves against the
    // inherited (host) color-scheme through light-dark().
    expect(theme).toContain('@supports (color: light-dark(')
    expect(theme).toMatch(
      /@supports \(color: light-dark\([\s\S]*?--_sheet-surface:\s*light-dark\(/,
    )
    // Old browsers (no light-dark()): prefers-color-scheme drives the PRIVATE default only.
    expect(theme).toMatch(
      /@media \(prefers-color-scheme: dark\)[\s\S]*?--_sheet-surface:/,
    )
    // The sheet inherits the host's declared scheme (explicit, documented).
    expect(theme).toMatch(/\.sv-sheet\s*\{[\s\S]*?color-scheme:\s*inherit/)
  })

  it('#14 — no public token is redefined per-scheme, so a :root override wins in BOTH schemes', () => {
    const css = theme.replace(/\/\*[\s\S]*?\*\//g, '') // ignore comments
    // Public --sheet-* tokens are only ever READ as var(--sheet-*, …); a
    // `--sheet-surface:` (colon = a definition) would re-introduce the #14
    // dark-mode shadowing the redesign removes.
    expect(css).not.toMatch(/--sheet-surface:/)
    expect(css).not.toMatch(/--sheet-text:/)
  })

  it('#14 — public colour tokens fall back to the private per-scheme default', () => {
    expect(theme).toMatch(/var\(--sheet-surface,\s*var\(--_sheet-surface\)\)/)
    expect(theme).toMatch(/var\(--sheet-text,\s*var\(--_sheet-text\)\)/)
    expect(theme).toMatch(/var\(--sheet-backdrop,\s*var\(--_sheet-backdrop\)\)/)
  })

  it('the remaining skin visuals are tokenized (title, close, handle, header padding)', () => {
    for (const t of [
      '--sheet-title-size',
      '--sheet-title-weight',
      '--sheet-close-size',
      '--sheet-close-radius',
      '--sheet-handle-radius',
      '--sheet-handle-opacity',
      '--sheet-header-padding',
    ]) {
      expect(theme).toContain(t)
    }
  })

  it('the public --sheet-* token surface is exactly the documented set (semver-linter)', () => {
    const css = theme.replace(/\/\*[\s\S]*?\*\//g, '') // ignore comments
    const found = [
      ...new Set([...css.matchAll(/--sheet-[a-z-]+/g)].map((m) => m[0])),
    ].sort()
    expect(found).toEqual([
      '--sheet-backdrop',
      '--sheet-backdrop-blur',
      '--sheet-border',
      '--sheet-border-subtle',
      '--sheet-close-radius',
      '--sheet-close-size',
      '--sheet-handle',
      '--sheet-handle-opacity',
      '--sheet-handle-radius',
      '--sheet-header-padding',
      '--sheet-hover',
      '--sheet-radius',
      '--sheet-radius-desktop',
      '--sheet-shadow',
      '--sheet-shadow-mobile',
      '--sheet-surface',
      '--sheet-text',
      '--sheet-title-size',
      '--sheet-title-weight',
    ])
  })

  it('hover affordances are gated behind @media (hover: hover) (no iOS sticky-hover)', () => {
    expect(theme).toContain('@media (hover: hover)')
    // the close-button hover background sits directly inside the hover query
    expect(theme).toMatch(/@media \(hover: hover\)\s*\{\s*\.sv-sheet__close:hover/)
  })
})
