import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {ENTER_EASE, EXIT_EASE, FLICK_EASE} from '../src/core/gestures'

// jsdom does not compute styles from imported CSS, so these read the stylesheet
// source and assert the rules, never their rendered effect. Comments are
// stripped so prose cannot satisfy or defeat a match.
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (file: string) =>
  strip(readFileSync(join(process.cwd(), 'src', 'styles', file), 'utf8'))
const base = read('base.css')
const theme = read('theme.css')

describe('CSS contract', () => {
  it('content inputs are ≥16px, the size at which Safari stops auto-zooming on focus', () => {
    expect(theme).toContain(':where(input, select, textarea)')
    expect(theme).toContain('font-size: max(1em, 16px)')
  })

  it('the keyframe sets are two stops each and the easing tokens are cubic-beziers inside the unit square', () => {
    expect(base).toMatch(
      /@keyframes sv-sheet-rise \{\s*from \{ transform: translateY\(var\(--_sheet-rise\)\); \}\s*to \{ transform: translateY\(0\); \}\s*\}/,
    )
    expect(base).toMatch(
      /@keyframes sv-sheet-fade \{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/,
    )
    for (const name of ['enter', 'exit', 'flick']) {
      const declared = new RegExp(
        `--_sheet-${name}-easing: var\\(--sheet-${name}-easing, cubic-bezier\\(([^)]+)\\)\\)`,
      ).exec(base)
      expect(declared).not.toBeNull()
      const points = declared![1].split(',').map(Number)
      expect(points).toHaveLength(4)
      for (const point of points) {
        expect(point).toBeGreaterThanOrEqual(0)
        expect(point).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the CSS easing tokens carry the same curves as the JS constants', () => {
    // The entrance is a CSS animation and the exit is a Web Animation, so one
    // gesture can hand over from one to the other. They only line up while both
    // sides spell the curve the same way.
    const pairs: Array<[string, string]> = [
      ['enter', ENTER_EASE],
      ['exit', EXIT_EASE],
      ['flick', FLICK_EASE],
    ]
    for (const [name, js] of pairs) {
      const declared = new RegExp(
        `--_sheet-${name}-easing: var\\(--sheet-${name}-easing, (cubic-bezier\\([^)]+\\))\\)`,
      ).exec(base)
      expect(declared).not.toBeNull()
      expect(declared![1]!.replace(/\s+/g, '')).toBe(js.replace(/\s+/g, ''))
    }
  })

  it('the mobile card entrance rises one card height on a composited transform', () => {
    // The open path parks the scroller at the open snap point rather than
    // scrolling to it: WebKit does not animate scrollTo inside a mandatory snap
    // scroller.
    expect(base).toMatch(
      /:not\(\[data-sheet-focus-open\]\) \.sv-sheet__card \{\s*--_sheet-rise: 100%;\s*animation: sv-sheet-rise var\(--_sheet-enter\) var\(--_sheet-enter-easing\)\s*backwards;/,
    )
  })

  it('reduced motion cross-fades the mobile card in instead of sliding it', () => {
    const rm = base.slice(base.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(rm).toMatch(
      /\.sv-sheet:not\(\[data-sheet-focus-open\]\) \.sv-sheet__card,\s*\.sv-sheet\[data-sheet-focus-open\] \.sv-sheet__card \{\s*animation: sv-sheet-fade var\(--_sheet-enter\) linear both;/,
    )
  })

  it('motion lives in base.css, and the only transition in theme.css is the close button’s', () => {
    for (const rule of [
      '@keyframes sv-sheet-rise',
      '@keyframes sv-sheet-fade',
      "[data-sheet-state='closing']",
    ]) {
      expect(base).toContain(rule)
      expect(theme).not.toContain(rule)
    }
    const owners = [...theme.matchAll(/([.\w-]+)\s*(?::hover)?\s*\{[^}]*transition:/g)]
    expect(owners.map((m) => m[1])).toEqual(['.sv-sheet__close', '.sv-sheet__close'])
    expect(theme).not.toContain('animation:')
  })

  it('the public --sheet-* token surface is exactly the documented set (semver-linter)', () => {
    const tokens = (css: string) =>
      [...new Set([...css.matchAll(/--sheet-[a-z-]+/g)].map((m) => m[0]))].sort()
    expect(tokens(base)).toEqual([
      '--sheet-enter-duration',
      '--sheet-enter-duration-focus',
      '--sheet-enter-easing',
      '--sheet-exit-duration',
      '--sheet-exit-easing',
      '--sheet-flick-easing',
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
    expect(tokens(theme)).toEqual([
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

  it('the desktop entrance animates card and dim on one token, with no state dependency', () => {
    // A transition needs a before-change style, so it cannot begin until the
    // frame after JS writes data-sheet-state. The entrance is an animation.
    const desktop = base.slice(base.indexOf('@media (min-width: 768px)'))
    expect(desktop).toMatch(
      /\.sv-sheet__card \{\s*--_sheet-rise: calc\(50dvh \+ 50%\);\s*animation: sv-sheet-rise var\(--_sheet-enter\)/,
    )
    expect(desktop).toMatch(
      /\.sv-sheet:not\(\[data-sheet-nested\]\) \.sv-sheet__backdrop \{\s*animation: sv-sheet-fade var\(--_sheet-enter\)/,
    )
    expect(desktop).toMatch(
      /\.sv-sheet:not\(\[data-sheet-nested\]\) \.sv-sheet__backdrop \{\s*opacity: 1;/,
    )
    expect(base).not.toMatch(/data-sheet-state='open'[^}]*opacity/)
  })

  it('the desktop card has no CSS exit, and the dim transition stands aside while closing', () => {
    // A transition never starts on a property a running animation controls, and
    // transitions outrank animations, so an unscoped one would beat the JS exit.
    const desktop = base.slice(base.indexOf('@media (min-width: 768px)'))
    expect(desktop).not.toMatch(/\.sv-sheet__card \{[^}]*transition:/)
    expect(desktop).not.toMatch(/data-sheet-state='closing'\] \.sv-sheet__card/)
    expect(desktop).toMatch(
      /\.sv-sheet:not\(\[data-sheet-state='closing'\]\) \.sv-sheet__backdrop \{\s*transition: opacity var\(--_sheet-exit\)/,
    )
  })

  it('the mobile dim fades out from the closing state, and its rule wins on source order', () => {
    const mobile = base.slice(base.indexOf('@media (max-width: 767px)'))
    expect(mobile).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__backdrop \{\s*opacity: 0;\s*transition: opacity var\(--_sheet-exit\)/,
    )
    // Both backdrop rules are (0,3,0), so this one wins only by coming later.
    expect(
      mobile.indexOf(':not([data-sheet-nested], [data-sheet-settled]) .sv-sheet__backdrop'),
    ).toBeLessThan(mobile.indexOf("[data-sheet-state='closing'] .sv-sheet__backdrop"))
  })

  it('only the sheet that owns the page dim plays the mobile entrance fade', () => {
    const mobile = base.slice(base.indexOf('@media (max-width: 767px)'))
    for (const m of mobile.matchAll(/([^{}]*\.sv-sheet__backdrop)\s*\{\s*animation:/g)) {
      expect(m[1]).toContain('[data-sheet-nested]')
    }
    // A :not() list takes the specificity of its most specific argument while a
    // chain adds them up, so a chain here breaks the (0,3,0) tie the closing
    // rule needs to win on source order.
    expect(mobile).not.toMatch(/:not\(\[data-sheet-nested\]\):not\(/)
    expect(mobile).toContain(
      '.sv-sheet:not([data-sheet-nested], [data-sheet-settled]) .sv-sheet__backdrop',
    )
  })

  it('both popover layers are boxless, and only the viewport one re-arms pointer events', () => {
    // An inset:0 wrapper with pointer-events:auto covers the viewport and
    // swallows backdrop-dismiss and drag-to-close.
    expect(base).toMatch(/\.sv-sheet__anchor-layer\s*\{\s*display: contents;\s*\}/)
    expect(base).toMatch(
      /\.sv-sheet__viewport-layer\s*\{\s*display: contents;\s*pointer-events: auto;\s*\}/,
    )
  })

  it('the desktop scroller is clipped, not hidden, so focus reveal cannot scroll it', () => {
    // The entrance translates the card a viewport down, and transformed bounds
    // count into scrollable overflow — with `hidden` the box is still a scroll
    // container, and showModal()'s focus scroll-reveals the close button
    // mid-entrance: the card overshoots its rest and snaps back. `clip` makes
    // the box unscrollable entirely.
    const desktop = base.slice(base.indexOf('@media (min-width: 768px)'))
    const scrollRule = /\.sv-sheet__scroll \{[^}]*\}/.exec(desktop)
    expect(scrollRule).not.toBeNull()
    expect(scrollRule![0]).toContain('overflow: clip')
    expect(scrollRule![0]).not.toContain('overflow: hidden')
  })

  it('the scroll lock is an attribute plus a rule, so it composes with third-party inline locks', () => {
    // Third-party locks own html.style.overflow and read it back to decide
    // whether they hold a lock, so this lock never writes that register. No
    // !important: a foreign inline lock may win it while both are active, and
    // either value locks.
    expect(base).toMatch(
      /html\[data-sheet-scroll-lock\]\[data-sheet-scroll-lock\]\s*\{\s*overflow: clip;\s*\}/,
    )
    expect(base).toMatch(
      /html\[data-sheet-scroll-lock\]\[data-sheet-scroll-lock\] body\s*\{\s*overflow: clip;\s*\}/,
    )
    expect(base).toMatch(
      /html\[data-sheet-scroll-gap\]\[data-sheet-scroll-gap\] body\s*\{\s*padding-right: var\(--_sheet-lock-pr\);\s*\}/,
    )
    expect(base).toMatch(
      /html\[data-sheet-scroll-pin\]\[data-sheet-scroll-pin\] body\s*\{\s*position: fixed;\s*top: var\(--_sheet-lock-top\);/,
    )
    expect(base).not.toContain('!important')
  })

  it('the top layer and its children go inert while closing', () => {
    // The close path arms .sv-sheet__scroll inline, which the top layer sits
    // outside of, and its children may re-arm pointer events themselves.
    expect(base).toMatch(
      /\[data-sheet-state='closing'\] \.sv-sheet__toplayer,[\s\S]*?\.sv-sheet__toplayer \*\s*\{\s*pointer-events: none;/,
    )
  })

  it('the card and the top layer are stacking contexts at rest, so consumer z-index cannot cross out', () => {
    // A live transform creates one anyway, so declaring it keeps paint order
    // identical at rest and mid-animation.
    expect(base).toMatch(/\.sv-sheet__card\s*\{[^}]*isolation: isolate/)
    expect(base).toMatch(/\.sv-sheet__toplayer\s*\{[^}]*isolation: isolate/)
  })

  it('the card is the anchored layer’s offsetParent, and the content area is not', () => {
    expect(base).toMatch(/\.sv-sheet__card\s*\{[^}]*position: relative/)
    // A position on .sv-sheet__content makes it the containing block for
    // absolute descendants and re-arms its clip on them.
    expect(base).not.toMatch(/\.sv-sheet__content\s*\{[^}]*position:/)
  })

  it('the default × is CSS-generated on the empty close glyph, not JS text', () => {
    expect(base).toMatch(/\.sv-sheet__close-icon:empty::before\s*\{\s*content: '×'/)
    expect(base).toMatch(/\.sv-sheet__close-icon\s*\{[^}]*display: inline-flex/)
  })

  it('the close button carries a ≥44px hit target in base.css, so it works themeless', () => {
    expect(base).toContain('.sv-sheet__close::before')
    expect(base).toContain('width: max(100%, 44px)')
    expect(base).toContain('height: max(100%, 44px)')
  })

  it('the close button is reset in base.css, where a global button {} cannot hijack it', () => {
    // Unlayered class specificity (0,1,0) beats a consumer `button {}` (0,0,1).
    expect(base).toMatch(/\.sv-sheet__close\s*\{[^}]*appearance:\s*none/)
    expect(base).toMatch(/\.sv-sheet__close\s*\{[^}]*background:\s*transparent/)
  })

  it('the desktop backdrop blur applies only to the bottom sheet, ungated by state', () => {
    // :not([data-sheet-nested]) is the bottom sheet at any depth, so at most one
    // backdrop-filter is ever computed.
    expect(theme).toMatch(
      /\.sv-sheet:not\(\[data-sheet-nested\]\) \.sv-sheet__backdrop \{\s*backdrop-filter: blur/,
    )
    expect(theme).not.toContain("data-sheet-state='open'")
  })

  it('the stack render model lives in base.css: hidden depth hides the scroller and the top layer', () => {
    // Never the dialog itself: it also owns the full-viewport backdrop, and the
    // deepest sheet is the one carrying the page dim.
    expect(theme).not.toContain("data-sheet-stack='")
    expect(base).toMatch(
      /\.sv-sheet\[data-sheet-stack='hidden'\] \.sv-sheet__scroll,\s*\.sv-sheet\[data-sheet-stack='hidden'\] \.sv-sheet__toplayer \{\s*visibility: hidden;\s*\}/,
    )
    expect(base).not.toMatch(/\.sv-sheet\[data-sheet-stack='hidden'\]\s*\{/)
    expect(base).not.toContain('visibility: visible')
    // Not content-visibility: WebKit does not invalidate the skipped layout when
    // it is removed, so a revealed sheet comes back with its text never laid
    // out, and a forced reflow does not repair it.
    expect(base).not.toContain('content-visibility')
  })

  it('the dim model is one page backdrop plus card-clipped scrims, with no opacity ladder', () => {
    expect(base).not.toMatch(/data-sheet-stack\][^{]*\.sv-sheet__backdrop\s*\{/)
    expect(base).toMatch(
      /\.sv-sheet__scrim\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*border-radius: inherit;/,
    )
    expect(base).toMatch(/\.sv-sheet__scrim\s*\{[^}]*pointer-events: none;/)
    expect(theme).toMatch(
      /\.sv-sheet__scrim\s*\{\s*background: var\(--sheet-backdrop, var\(--_sheet-backdrop\)\);\s*\}/,
    )
    // The core arms role flips inline and drives drag frames raw, so a standing
    // transition here would fight both.
    expect(base).not.toMatch(/\.sv-sheet__scrim\s*\{[^}]*transition:/)
  })

  it('the receded pose is one mobile-only rule, scaled and offset by core-measured values', () => {
    expect(base).toMatch(
      /\.sv-sheet\[data-sheet-recede\] \.sv-sheet__card \{\s*transform: translateY\(var\(--_sheet-stack-ty, 0px\)\)\s*scale\(var\(--_sheet-recede-scale, 1\)\);\s*\}/,
    )
    expect(base).not.toMatch(/scale\(0\.\d+\)/)
    const pose = base.indexOf('.sv-sheet[data-sheet-recede] .sv-sheet__card')
    const mobile = base.lastIndexOf('@media (max-width: 767px)', pose)
    expect(mobile).toBeGreaterThan(-1)
    expect(base.slice(mobile, pose)).not.toContain('@media (min-width: 768px)')
    expect(base).not.toMatch(/min-width: 768px\)[^@]*data-sheet-recede/)
    // The peek strip is the height difference, so the scale must not move the
    // card's top edge.
    expect(base).toMatch(/\.sv-sheet__card \{\s*transform-origin: top center;\s*\}/)
    expect(base).not.toContain('bottom center')
    expect(base).not.toMatch(/data-sheet-recede\][^{]*\{[^}]*transition:/)
  })

  it('reduced motion drops the pose to transform: none and leaves the dims alone', () => {
    const rm = base.slice(base.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(rm).toMatch(
      /\.sv-sheet\[data-sheet-recede\] \.sv-sheet__card \{\s*transform: none;\s*\}/,
    )
    expect(rm).not.toMatch(/data-sheet-stack\] \.sv-sheet__backdrop/)
  })

  it('a nested desktop card travels without fading, and the rise keyframes carry no opacity', () => {
    // A nested card lands on a same-size card in the same place, so at any
    // opacity below 1 both headers and both button rows are legible at once.
    const rmAt = base.lastIndexOf('@media (prefers-reduced-motion')
    const motion = base.slice(base.lastIndexOf('@media (min-width: 768px)', rmAt), rmAt)
    expect(motion).toContain('sv-sheet-rise')
    expect(motion).not.toMatch(/\.sv-sheet__card[^{]*\{[^}]*sv-sheet-fade/)
    // Reduced motion removes the travel, and a nested card gets nothing rather
    // than the cross-fade the others reduce to.
    expect(base.slice(rmAt)).toMatch(
      /\.sv-sheet\[data-sheet-nested\] \.sv-sheet__card \{\s*animation: none;/,
    )
    const rise = /@keyframes sv-sheet-rise \{([\s\S]*?)\n\}/.exec(base)
    expect(rise![1]).not.toContain('opacity')
  })

  it('the default palette follows the host color-scheme through light-dark(), with no fallback', () => {
    expect(theme).toMatch(/\.sv-sheet\s*\{[^}]*--_sheet-surface:\s*light-dark\(/)
    // prefers-color-scheme reads the OS, which inverts a light host page on a
    // dark machine.
    expect(theme).not.toContain('prefers-color-scheme')
    // And no @supports guard behind it: a second palette is a second thing to
    // keep in step, and light-dark() is inside the floor.
    expect(theme).not.toContain('@supports')
    expect(theme).toMatch(/\.sv-sheet\s*\{[^}]*color-scheme:\s*inherit/)
  })

  it('the stylesheets carry no vendor-prefixed fallback the floor already covers', () => {
    // -webkit-tap-highlight-color is the exception: it has no standard form.
    for (const sheet of [base, theme]) {
      const prefixed = (sheet.match(/-webkit-[\w-]+/g) ?? []).filter(
        (p) => p !== '-webkit-tap-highlight-color',
      )
      expect(prefixed).toEqual([])
    }
  })

  it('no public token is redefined per scheme, so a :root override wins in both schemes', () => {
    // Public --sheet-* tokens are only ever read as var(--sheet-*, …); a colon
    // after one is a definition, which shadows the consumer's.
    expect(theme).not.toMatch(/--sheet-surface:/)
    expect(theme).not.toMatch(/--sheet-text:/)
  })

  it('hover affordances sit inside @media (hover: hover), so touch gets no sticky hover', () => {
    expect(theme).toContain('@media (hover: hover)')
    expect(theme).toMatch(/@media \(hover: hover\)\s*\{\s*\.sv-sheet__close:hover/)
  })
})
