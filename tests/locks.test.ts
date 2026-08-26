import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {stubLayout} from './helpers'

// scrollLock and zoomLock are module-global singletons, so every core is reset in
// afterEach (which runs on assertion failure too) to keep a ref-count from leaking
// into the next test.
describe('zoomLock (viewport meta)', () => {
  let meta: HTMLMetaElement
  let core: SheetCore | undefined

  beforeEach(() => {
    meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width'
    document.head.appendChild(meta)
  })

  afterEach(() => {
    core?.__resetForTests()
    core = undefined
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
