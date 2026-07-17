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

// overflow:clip alone doesn't hold on iOS: showing/hiding the keyboard scrolls
// the layout viewport behind the modal. When the document itself is the scroller
// we also pin <body> with position:fixed — with box-sizing:border-box so the
// width:100% pin includes the body's own padding instead of overflowing the
// viewport by it. A fixed-shell layout (scrollHeight ≈ viewport) is left alone.
let savedHtmlOverflow = ''
let savedBodyOverflow = ''
let savedBodyPosition = ''
let savedBodyTop = ''
let savedBodyLeft = ''
let savedBodyRight = ''
let savedBodyWidth = ''
let savedBodyBoxSizing = ''
let savedBodyPaddingRight = ''
let gapReserved = false
let lockedScrollY = 0
let bodyPinned = false
export const scrollLock: RefCountedLock = refCounted(
  () => {
    const html = document.documentElement
    const body = document.body
    lockedScrollY = window.scrollY || window.pageYOffset || 0

    // Reserve the width the scrollbar occupied so the page behind the modal
    // doesn't jump ~15px when overflow:clip removes it (classic Win/Linux bars).
    // Measured before clip — afterwards clientWidth would already equal innerWidth.
    const gap = window.innerWidth - html.clientWidth
    gapReserved = gap > 0
    if (gapReserved) {
      savedBodyPaddingRight = body.style.paddingRight
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${current + gap}px`
    }

    savedHtmlOverflow = html.style.overflow
    savedBodyOverflow = body.style.overflow
    html.style.overflow = 'clip'
    body.style.overflow = 'clip'
    bodyPinned = html.scrollHeight > window.innerHeight + 1
    if (bodyPinned) {
      savedBodyPosition = body.style.position
      savedBodyTop = body.style.top
      savedBodyLeft = body.style.left
      savedBodyRight = body.style.right
      savedBodyWidth = body.style.width
      savedBodyBoxSizing = body.style.boxSizing
      body.style.position = 'fixed'
      body.style.top = `-${lockedScrollY}px`
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'
      body.style.boxSizing = 'border-box'
    }
  },
  () => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = savedHtmlOverflow
    body.style.overflow = savedBodyOverflow
    if (gapReserved) {
      body.style.paddingRight = savedBodyPaddingRight
      gapReserved = false
    }
    if (bodyPinned) {
      body.style.position = savedBodyPosition
      body.style.top = savedBodyTop
      body.style.left = savedBodyLeft
      body.style.right = savedBodyRight
      body.style.width = savedBodyWidth
      body.style.boxSizing = savedBodyBoxSizing
      window.scrollTo(0, lockedScrollY)
      bodyPinned = false
    }
  },
)

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
