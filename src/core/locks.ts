export interface RefCountedLock {
  acquire: () => void
  release: () => void
}

/* The lock is DOM attributes + base.css rules, NEVER an inline `overflow` write:
 * a third-party scroll lock saves and restores that same register, and two
 * owners of one register cannot interleave without one clobbering the other.
 * Separate channels compose in any order.
 *
 * The holder count lives IN the attribute value, and the measurements needed at
 * release in custom properties, so two bundled copies still nest correctly.
 */
const LOCK_ATTR = 'data-sheet-scroll-lock'
const GAP_ATTR = 'data-sheet-scroll-gap'
const PIN_ATTR = 'data-sheet-scroll-pin'
const PR_VAR = '--_sheet-lock-pr'
const TOP_VAR = '--_sheet-lock-top'

function holders(el: Element, attr: string): number {
  return parseInt(el.getAttribute(attr) ?? '', 10) || 0
}

export const scrollLock: RefCountedLock = {
  acquire(): void {
    const html = document.documentElement
    const count = holders(html, LOCK_ATTR)
    if (count > 0) {
      html.setAttribute(LOCK_ATTR, String(count + 1))
      return
    }
    // Measure BEFORE the lock attribute lands: it switches the base.css rules
    // on, and reading clientWidth after that would flush layout with the
    // scrollbar already gone (gap 0) and the document already clipped.
    const scrollY = window.scrollY

    // Reserve the width the scrollbar occupies so the page behind the modal
    // doesn't jump when overflow:clip removes it.
    const gap = window.innerWidth - html.clientWidth

    // overflow:clip alone does not hold in WebKit: showing/hiding the keyboard
    // scrolls the layout viewport behind the modal. When the document itself is
    // the scroller, <body> is also pinned with position:fixed; a fixed-shell
    // layout (scrollHeight ≈ viewport) is left alone.
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
    const count = holders(html, LOCK_ATTR)
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
    // The pin collapses the document to viewport height, zeroing the scroll
    // position; put the page back where the lock found it.
    if (pinned) window.scrollTo(0, Number.isNaN(top) ? 0 : -top)
  },
}

/* Pin maximum-scale on the viewport meta so WebKit cannot auto-zoom on focus.
 * user-scalable=no is omitted: it fully blocks pinch-zoom, a WCAG 1.4.4 failure.
 *
 * Same channel as `scrollLock`: the holder count and the content to restore
 * live on the meta itself. Two bundled copies then nest, instead of the second
 * one saving the first one's edit as the original.
 */
const ZOOM_ATTR = 'data-sheet-zoom-lock'
const ZOOM_SAVED_ATTR = 'data-sheet-zoom-content'

export const zoomLock: RefCountedLock = {
  acquire(): void {
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return
    const count = holders(meta, ZOOM_ATTR)
    if (count > 0) {
      meta.setAttribute(ZOOM_ATTR, String(count + 1))
      return
    }
    const saved = meta.getAttribute('content') ?? ''
    meta.setAttribute(ZOOM_SAVED_ATTR, saved)
    meta.setAttribute(ZOOM_ATTR, '1')
    meta.setAttribute(
      'content',
      saved ? `${saved}, maximum-scale=1` : 'maximum-scale=1',
    )
  },
  release(): void {
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return
    const count = holders(meta, ZOOM_ATTR)
    if (count === 0) return
    if (count > 1) {
      meta.setAttribute(ZOOM_ATTR, String(count - 1))
      return
    }
    const saved = meta.getAttribute(ZOOM_SAVED_ATTR)
    meta.removeAttribute(ZOOM_ATTR)
    meta.removeAttribute(ZOOM_SAVED_ATTR)
    // A meta that had no `content` gets none back, rather than keeping ours.
    if (saved) meta.setAttribute('content', saved)
    else meta.removeAttribute('content')
  },
}
