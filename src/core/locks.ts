export interface RefCountedLock {
  acquire: () => void
  release: () => void
}

export function refCounted(
  onFirst: () => void,
  onLast: () => void,
): RefCountedLock {
  let count = 0
  return {
    acquire(): void {
      if (count === 0) onFirst()
      count++
    },
    release(): void {
      count = Math.max(0, count - 1)
      if (count === 0) onLast()
    },
  }
}

/* The scroll lock lives in DOM attributes + base.css rules, NEVER in inline
 * `overflow` writes. Third-party scroll locks (Headless UI, body-scroll-lock, …)
 * save and restore `style.overflow` on the SAME elements, and some decide
 * whether they even hold a lock by reading the current value back. Two owners
 * doing save/restore on one register cannot interleave: our restore erases
 * their value (they skip their cleanup and leak document listeners), while
 * "restore only if still mine" hands the cleanup to them — and they'd restore
 * the value they saved, which is OURS, freezing the page for good. Separate
 * channels compose in any order: they own the inline register, we own the
 * attribute; either one alone still locks, and each teardown removes only its
 * own contribution.
 *
 * The attribute value is the holder count, so the count itself lives in the
 * DOM — two bundled copies of this module (or two cores) still nest correctly.
 * All measurements needed at release (the pinned scroll offset) are parked in
 * custom properties for the same reason.
 */
const LOCK_ATTR = 'data-sheet-scroll-lock'
const GAP_ATTR = 'data-sheet-scroll-gap'
const PIN_ATTR = 'data-sheet-scroll-pin'
const PR_VAR = '--_sheet-lock-pr'
const TOP_VAR = '--_sheet-lock-top'

function holders(html: HTMLElement): number {
  return parseInt(html.getAttribute(LOCK_ATTR) ?? '', 10) || 0
}

export const scrollLock: RefCountedLock = {
  acquire(): void {
    const html = document.documentElement
    const count = holders(html)
    if (count > 0) {
      html.setAttribute(LOCK_ATTR, String(count + 1))
      return
    }
    // Measure BEFORE the lock attribute lands: it switches the base.css rules
    // on, and reading clientWidth after that would flush layout with the
    // scrollbar already gone (gap 0) and the document already clipped.
    const scrollY = window.scrollY || window.pageYOffset || 0

    // Reserve the width the scrollbar occupied so the page behind the modal
    // doesn't jump ~15px when overflow:clip removes it (classic Win/Linux bars).
    const gap = window.innerWidth - html.clientWidth

    // overflow:clip alone doesn't hold on iOS: showing/hiding the keyboard
    // scrolls the layout viewport behind the modal. When the document itself is
    // the scroller we also pin <body> with position:fixed; a fixed-shell layout
    // (scrollHeight ≈ viewport) is left alone.
    const pin = html.scrollHeight > window.innerHeight + 1

    html.setAttribute(LOCK_ATTR, '1')
    if (gap > 0) {
      const current = parseFloat(getComputedStyle(document.body).paddingRight) || 0
      html.style.setProperty(PR_VAR, `${current + gap}px`)
      html.setAttribute(GAP_ATTR, '')
    }
    if (pin) {
      html.style.setProperty(TOP_VAR, `-${scrollY}px`)
      html.setAttribute(PIN_ATTR, '')
    }
  },
  release(): void {
    const html = document.documentElement
    const count = holders(html)
    if (count > 1) {
      html.setAttribute(LOCK_ATTR, String(count - 1))
      return
    }
    const pinned = html.hasAttribute(PIN_ATTR)
    const top = parseFloat(html.style.getPropertyValue(TOP_VAR))
    html.removeAttribute(LOCK_ATTR)
    html.removeAttribute(GAP_ATTR)
    html.removeAttribute(PIN_ATTR)
    html.style.removeProperty(PR_VAR)
    html.style.removeProperty(TOP_VAR)
    // The pin collapsed the document to viewport height, zeroing the scroll
    // position; put the page back where the lock found it.
    if (pinned) window.scrollTo(0, Number.isNaN(top) ? 0 : -top)
  },
}

// Pin maximum-scale on the viewport meta so iOS can't auto-zoom on input focus.
// user-scalable=no is intentionally omitted (it fully blocks pinch-zoom, a WCAG
// 1.4.4 failure); opt in via the core's zoomLock option only when you must.
let savedViewport: string | null = null
export const zoomLock: RefCountedLock = refCounted(
  () => {
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return
    savedViewport = meta.getAttribute('content')
    const base = savedViewport ?? ''
    meta.setAttribute(
      'content',
      base ? `${base}, maximum-scale=1` : 'maximum-scale=1',
    )
  },
  () => {
    if (savedViewport === null) return
    const meta = document.querySelector('meta[name="viewport"]')
    if (meta) meta.setAttribute('content', savedViewport)
    savedViewport = null
  },
)
