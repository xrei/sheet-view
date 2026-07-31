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
    expect(base).toContain('@media (prefers-reduced-motion: reduce)')
    expect(base).toMatch(/prefers-reduced-motion[\s\S]*sv-sheet-fade-in/)
    expect(base).toContain('@keyframes sv-sheet-fade-in')
  })

  it('mobile open slides the card in with a compositor transform, not a scroll', () => {
    // iOS Safari won't animate scrollTo() inside a mandatory-snap scroller, so the
    // entrance is a GPU transform keyframe from translateY(100%) while the scroller
    // rests at the open snap point (drag-armed). focusOnOpen keeps its own rise-in.
    expect(base).toContain('@keyframes sv-sheet-slide-up')
    expect(base).toMatch(/@keyframes sv-sheet-slide-up[\s\S]*?translateY\(100%\)/)
    expect(base).toMatch(
      /:not\(\[data-sheet-focus-open\]\)[\s\S]*?animation:[\s\S]*?sv-sheet-slide-up/,
    )
  })

  it('motion lives in the REQUIRED base.css — theme.css is optional, so a themeless sheet must still animate', () => {
    // The JS open path never animates the scroll (iOS refuses inside a mandatory-snap
    // scroller), so these keyframes ARE the entrance: in theme.css a base-only
    // consumer got a teleporting card with a fading dim.
    for (const rule of [
      '@keyframes sv-sheet-slide-up',
      '@keyframes sv-sheet-rise-in',
      '@keyframes sv-sheet-fade-in',
      "[data-sheet-state='closing']",
    ]) {
      expect(base).toContain(rule)
      expect(theme).not.toContain(rule)
    }
    // The close button's hover fade is the one exception: it animates themed
    // properties, so it stays skin — and it's the ONLY transition left in the theme
    // (its own reduced-motion `transition: none` included).
    const css = theme.replace(/\/\*[\s\S]*?\*\//g, '')
    const owners = [...css.matchAll(/([.\w-]+)\s*(?::hover)?\s*\{[^}]*transition:/g)]
    expect(owners.map((m) => m[1])).toEqual(['.sv-sheet__close', '.sv-sheet__close'])
    expect(css).not.toContain('animation:')
  })

  it('the public --sheet-* surface of base.css is exactly the documented set (semver-linter)', () => {
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    const found = [
      ...new Set([...css.matchAll(/--sheet-[a-z-]+/g)].map((m) => m[0])),
    ].sort()
    expect(found).toEqual([
      '--sheet-backdrop-duration',
      '--sheet-enter-duration',
      '--sheet-enter-duration-focus',
      '--sheet-enter-easing',
      '--sheet-exit-duration',
      '--sheet-header-gap',
      '--sheet-height',
      '--sheet-height-lg',
      '--sheet-height-md',
      '--sheet-height-sm',
      '--sheet-height-xl',
      '--sheet-inset',
      '--sheet-inset-desktop',
      '--sheet-width',
      '--sheet-width-lg',
      '--sheet-width-md',
      '--sheet-width-sm',
      '--sheet-width-xl',
    ])
  })

  it('every duration is a token, so motion is tunable without a cascade fight', () => {
    // No hardcoded ms/s outside the token defaults: each animation/transition reads
    // a private var that resolves through the public token.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/animation: sv-sheet-slide-up var\(--_sheet-enter\)/)
    expect(css).toMatch(/transition: opacity var\(--_sheet-enter\) ease/)
  })

  it('public tokens are read once in a .sv-sheet block — never inline at a use site', () => {
    // The pattern that makes overrides reliable: `--_sheet-x: var(--sheet-x, lit)`
    // declared once, `var(--_sheet-x)` everywhere else. An inline
    // `var(--sheet-x, literal)` at a use site is a second source of truth that
    // silently drifts from the block's default.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    const outsideTokenBlocks = css.replace(/\.sv-sheet\s*\{[^}]*\}/g, '')
    expect(outsideTokenBlocks).not.toMatch(/var\(--sheet-/)
  })

  it('card sizing is tokenised and the viewport clamps stay inside the library', () => {
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const size of ['sm', 'md', 'lg', 'xl']) {
      expect(css).toContain(
        `width: min(var(--_sheet-width-${size}), var(--_sheet-max-width));`,
      )
      expect(css).toContain(`height: var(--_sheet-height-${size});`)
    }
    expect(css).toContain(
      '--_sheet-max-width: calc(100vw - var(--_sheet-inset-desktop));',
    )
    expect(css).toContain('--_sheet-max-height: calc(100dvh - var(--_sheet-inset));')
    expect(css).toContain(
      '--_sheet-max-height-desktop: calc(100vh - var(--_sheet-inset-desktop));',
    )
    // The bucket widths moved into the token block; none may linger at a use site.
    const desktop = css.slice(css.indexOf('@media (min-width: 768px)'))
    for (const literal of ['400px', '560px', '800px', '1000px']) {
      expect(desktop).not.toContain(`width: ${literal}`)
    }
  })

  it('the desktop entrance runs card + dim on one token, with no state dependency', () => {
    // The bug this locks in: the dim used to fade in from
    // `[data-sheet-state='open']`, which JS sets a frame late, while the card had no
    // entrance at all — so the card landed a full fade before its dim started.
    // A transition can't fix that (it needs a before-change style, hence the frame),
    // so the entrance MUST stay an animation, and both parts must read one token.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    const desktop = css.slice(css.indexOf('@media (min-width: 768px)'))
    expect(desktop).toMatch(
      /\.sv-sheet__card,\s*\.sv-sheet__backdrop \{\s*animation: sv-sheet-fade-in var\(--_sheet-backdrop-fade\)/,
    )
    // No opacity rule may key the desktop dim off the open state again.
    expect(base).not.toMatch(/data-sheet-state='open'[^}]*opacity/)
    // It rests visible instead, so the entrance is the animation and nothing else.
    expect(desktop).toMatch(/\.sv-sheet__backdrop \{\s*opacity: 1;/)
    // Both parts still leave on the state-driven exit.
    expect(desktop).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__backdrop \{\s*opacity: 0;/,
    )
    expect(desktop).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__card \{\s*transform: translateY\(20px\);/,
    )
  })

  it('the mobile exit fades the dim out — it must not pop with the DOM', () => {
    // The card's exit is a scroll the UA times, so only the dim can be declared
    // here; it fades from the closing state once JS drops its inline per-frame
    // opacity. The rule must come after the two enter rules it shares (0,3,0) with.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    const mobile = css.slice(css.indexOf('@media (max-width: 767px)'))
    expect(mobile).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__backdrop \{\s*opacity: 0;\s*transition: opacity var\(--_sheet-exit\)/,
    )
    // Both backdrop rules are (0,3,0), so the closing one only wins by coming
    // later. Compare the two rules themselves, not bare substrings — other rules
    // legitimately mention the closing state.
    expect(
      mobile.indexOf(':not([data-sheet-settled]) .sv-sheet__backdrop'),
    ).toBeLessThan(
      mobile.indexOf("[data-sheet-state='closing'] .sv-sheet__backdrop"),
    )
  })

  it('both popover layers are boxless, and only the viewport one re-arms clicks', () => {
    // Boxless is the whole design: a real inset:0 wrapper with pointer-events:auto
    // would cover the viewport and swallow backdrop-dismiss AND drag-to-close.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.sv-sheet__anchor-layer\s*\{\s*display: contents;\s*\}/)
    expect(css).toMatch(
      /\.sv-sheet__viewport-layer\s*\{\s*display: contents;\s*pointer-events: auto;\s*\}/,
    )
  })

  it('the scroll lock is attribute + rule, so it composes with third-party inline locks', () => {
    // Headless UI (and body-scroll-lock, …) save/restore html.style.overflow and
    // read it back to decide whether they hold a lock. Our lock must therefore
    // never live in that register: base.css owns the value, locks.ts only flips
    // the attribute. No !important — a foreign inline lock may legitimately win
    // the register while both are active, and either value locks.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(
      /html\[data-sheet-scroll-lock\]\[data-sheet-scroll-lock\]\s*\{\s*overflow: clip;\s*\}/,
    )
    expect(css).toMatch(
      /html\[data-sheet-scroll-lock\]\[data-sheet-scroll-lock\] body\s*\{\s*overflow: clip;\s*\}/,
    )
    expect(css).toMatch(
      /html\[data-sheet-scroll-gap\]\[data-sheet-scroll-gap\] body\s*\{\s*padding-right: var\(--_sheet-lock-pr\);\s*\}/,
    )
    expect(css).toMatch(
      /html\[data-sheet-scroll-pin\]\[data-sheet-scroll-pin\] body\s*\{\s*position: fixed;\s*top: var\(--_sheet-lock-top\);/,
    )
    expect(css).not.toContain('!important')
  })

  it('the top layer goes inert while closing — it escapes the inline close guard', () => {
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__toplayer,[\s\S]*?\.sv-sheet__toplayer \*\s*\{\s*pointer-events: none;/,
    )
  })

  it('the card and the top layer are stacking contexts, so consumer z-index cannot cross out', () => {
    // Also makes rest and mid-animation behave identically: a live transform
    // already made the card a stacking context, so order used to invert for 400ms.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.sv-sheet__card\s*\{[^}]*isolation: isolate/)
    expect(css).toMatch(/\.sv-sheet__toplayer\s*\{[^}]*isolation: isolate/)
  })

  it('no z-index anywhere — paint order is tree order, by contract (semver-linter)', () => {
    const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(strip(base)).not.toContain('z-index')
    expect(strip(theme)).not.toContain('z-index')
  })

  it('the card is the anchored layer’s offsetParent, and content deliberately is not', () => {
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.sv-sheet__card\s*\{[^}]*position: relative/)
    // Giving .sv-sheet__content a position would re-arm its clip on absolute
    // descendants — the exact thing layers.anchored exists to avoid.
    expect(css).not.toMatch(/\.sv-sheet__content\s*\{[^}]*position:/)
  })

  it('the header icon collapses while empty, so no gap appears before React fills it', () => {
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.sv-sheet__icon:empty\s*\{\s*display: none/)
    expect(css).toMatch(/\.sv-sheet__icon\s*\{[^}]*flex-shrink: 0/)
    expect(css).toContain('gap: var(--_sheet-header-gap);')
  })

  it('the default × is CSS-generated on the empty close glyph, not JS text', () => {
    // This rule IS the default close glyph. If it is deleted or moved to a layer a
    // consumer can beat, every themeless sheet gets a blank close button — and the
    // core deliberately writes no text into that node, so nothing else covers it.
    const css = base.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.sv-sheet__close-icon:empty::before\s*\{\s*content: '×'/)
    expect(css).toMatch(/\.sv-sheet__close-icon\s*\{[^}]*display: inline-flex/)
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
