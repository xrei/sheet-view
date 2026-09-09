import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {zoomLock} from '../src/core/locks'
import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {stubLayout} from './helpers'

// Both locks count their holders in the DOM, which means a leaked count
// outlives the module. Every core is reset in afterEach (which runs on
// assertion failure too) to keep one from reaching the next test.
describe('zoomLock (viewport meta)', () => {
  let meta: HTMLMetaElement
  let core: SheetCore | undefined
  let other: SheetCore | undefined

  beforeEach(() => {
    meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width'
    document.head.appendChild(meta)
  })

  afterEach(() => {
    core?.__resetForTests()
    other?.__resetForTests()
    core = other = undefined
    meta.remove()
  })

  it('leaves the viewport meta untouched by default', () => {
    core = createSheetCore()
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('opt-in appends maximum-scale, never user-scalable, and restores on close', () => {
    core = createSheetCore({zoomLock: true})
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('width=device-width, maximum-scale=1')

    core.__resetForTests()
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('nests independent cores through the holder count on the meta', () => {
    core = createSheetCore({zoomLock: true})
    other = createSheetCore({zoomLock: true})
    core.open({title: 'A'})
    // The second core must not save the first core's edit as the original.
    other.open({title: 'B'})
    expect(meta.getAttribute('data-sheet-zoom-lock')).toBe('2')
    expect(meta.getAttribute('content')).toBe('width=device-width, maximum-scale=1')

    other.__resetForTests()
    expect(meta.getAttribute('content')).toBe('width=device-width, maximum-scale=1')

    core.__resetForTests()
    expect(meta.hasAttribute('data-sheet-zoom-lock')).toBe(false)
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  // With the saved content in a module closure the second copy saves the first
  // copy's edit as the original, then restores it last and strands
  // maximum-scale=1 on the page. A distinct module id makes vite instantiate
  // the module twice, matching a standalone CDN build next to a bundled import
  // on a real page.
  it('two copies of the module nest instead of clobbering', async () => {
    const a = await import('../src/core/locks')
    // @ts-expect-error: same file, distinct module id, which loads it twice.
    const b = await import('../src/core/locks?copy')
    expect(a.zoomLock).not.toBe(b.zoomLock)

    a.zoomLock.acquire()
    b.zoomLock.acquire()
    expect(meta.getAttribute('content')).toBe('width=device-width, maximum-scale=1')

    a.zoomLock.release()
    b.zoomLock.release()
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('is a no-op with no viewport meta, and survives an unbalanced release', () => {
    meta.remove()
    expect(() => {
      zoomLock.acquire()
      zoomLock.release()
    }).not.toThrow()

    document.head.appendChild(meta)
    // A release with no holder must not strip the page's own content.
    zoomLock.release()
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('gives back no content attribute when the meta had none', () => {
    meta.removeAttribute('content')
    core = createSheetCore({zoomLock: true})
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('maximum-scale=1')

    core.__resetForTests()
    expect(meta.hasAttribute('content')).toBe(false)
  })
})

// The lock is the `data-sheet-scroll-lock` attribute plus base.css rules. The
// inline `overflow` register belongs to third-party locks, which save it, restore
// it, and read it back to decide whether they locked, so nothing here writes it.
describe('scrollLock (attribute channel)', () => {
  let core: SheetCore | undefined
  let restore: (() => void) | undefined
  const html = (): HTMLElement => document.documentElement

  afterEach(() => {
    core?.__resetForTests()
    core = undefined
    restore?.()
    restore = undefined
  })

  it('locks via the attribute, leaving every shared inline register pristine', () => {
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().getAttribute('data-sheet-scroll-lock')).toBe('1')
    expect(html().style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.paddingRight).toBe('')

    core.__resetForTests()
    expect(html().hasAttribute('data-sheet-scroll-lock')).toBe(false)
  })

  it('a third-party inline overflow survives the release', () => {
    core = createSheetCore()
    core.open({title: 'A'})
    // A third-party lock takes the inline register while the sheet is open.
    html().style.overflow = 'hidden'

    core.__resetForTests()
    core = undefined
    expect(html().hasAttribute('data-sheet-scroll-lock')).toBe(false)
    expect(html().style.overflow).toBe('hidden')

    html().style.overflow = ''
  })

  it('counts holders in the attribute itself, so independent cores nest', () => {
    core = createSheetCore()
    const other = createSheetCore()
    core.open({title: 'A'})
    core.open({title: 'B'})
    other.open({title: 'C'})
    expect(html().getAttribute('data-sheet-scroll-lock')).toBe('3')

    other.__resetForTests()
    expect(html().getAttribute('data-sheet-scroll-lock')).toBe('2')
    core.__resetForTests()
    expect(html().hasAttribute('data-sheet-scroll-lock')).toBe(false)
  })

  it('reserves the scrollbar width in the gap attribute and custom property', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1009}) // 15px classic scrollbar
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().hasAttribute('data-sheet-scroll-gap')).toBe(true)
    expect(html().style.getPropertyValue('--_sheet-lock-pr')).toBe('15px')
    expect(document.body.style.paddingRight).toBe('')

    core.__resetForTests()
    expect(html().hasAttribute('data-sheet-scroll-gap')).toBe(false)
    expect(html().style.getPropertyValue('--_sheet-lock-pr')).toBe('')
  })

  it('reserves no gap when the scrollbar takes no width (overlay scrollbars)', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1024})
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().hasAttribute('data-sheet-scroll-gap')).toBe(false)
  })

  it('pins a document-scrolled page and restores the scroll position on release', () => {
    restore = stubLayout({
      innerWidth: 1024,
      clientWidth: 1024,
      innerHeight: 800,
      scrollHeight: 2000,
      scrollY: 120,
    })
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().hasAttribute('data-sheet-scroll-pin')).toBe(true)
    // The offset lives in the DOM, so any bundled copy of the module can release it.
    expect(html().style.getPropertyValue('--_sheet-lock-top')).toBe('-120px')

    core.__resetForTests()
    expect(html().hasAttribute('data-sheet-scroll-pin')).toBe(false)
    expect(html().style.getPropertyValue('--_sheet-lock-top')).toBe('')
    expect(scrollTo).toHaveBeenCalledWith(0, 120)
    scrollTo.mockRestore()
  })

  it('leaves a fixed-shell page unpinned (scrollHeight ≈ viewport)', () => {
    restore = stubLayout({
      innerWidth: 1024,
      clientWidth: 1024,
      innerHeight: 800,
      scrollHeight: 800,
    })
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().hasAttribute('data-sheet-scroll-pin')).toBe(false)
  })
})
