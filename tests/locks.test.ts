import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {stubLayout} from './helpers'

// scrollLock / zoomLock are module-global singletons; reset the core in afterEach
// (even on assertion failure) so a leaked ref-count can't bleed into the next test.
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

  it('is off by default — the viewport meta is left untouched (WCAG 1.4.4)', () => {
    core = createSheetCore()
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('opt-in appends maximum-scale (no user-scalable) and restores on close', () => {
    core = createSheetCore({zoomLock: true})
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('width=device-width, maximum-scale=1')

    core.__resetForTests()
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })

  it('opt-in on an empty viewport meta has no leading comma', () => {
    meta.setAttribute('content', '')
    core = createSheetCore({zoomLock: true})
    core.open({title: 'A'})
    expect(meta.getAttribute('content')).toBe('maximum-scale=1')
  })
})

// The lock lives in `data-sheet-scroll-lock` + base.css rules, NOT in inline
// styles — the inline `overflow` register is left entirely to third-party locks
// (Headless UI et al.) that save/restore it and read it back to decide whether
// they even locked. See locks.ts for why sharing that register cannot work.
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

  it('a third-party inline lock survives our release (the Headless UI leak)', () => {
    core = createSheetCore()
    core.open({title: 'A'})
    // Headless UI opens a Select inside the sheet: it saves html.style.overflow
    // ('' — we never wrote it) and takes the inline register for itself.
    html().style.overflow = 'hidden'

    // Sheet closes first. The foreign value must survive our teardown: HUI reads
    // it back to decide whether to run ITS cleanup — clobbering it leaks its
    // document listeners ("containers is not iterable" on every later tap).
    core.__resetForTests()
    core = undefined
    expect(html().hasAttribute('data-sheet-scroll-lock')).toBe(false)
    expect(html().style.overflow).toBe('hidden')

    // HUI's own teardown restores what it saved, and the page is free.
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

  it('reserves the vanished scrollbar width via the gap attribute + custom prop', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1009}) // 15px classic scrollbar
    core = createSheetCore()
    core.open({title: 'A'})
    expect(html().hasAttribute('data-sheet-scroll-gap')).toBe(true)
    expect(html().style.getPropertyValue('--_sheet-lock-pr')).toBe('15px')
    expect(document.body.style.paddingRight).toBe('') // never inline on body

    core.__resetForTests()
    expect(html().hasAttribute('data-sheet-scroll-gap')).toBe(false)
    expect(html().style.getPropertyValue('--_sheet-lock-pr')).toBe('')
  })

  it('reserves no gap when there is none (overlay scrollbars / scrollbar-gutter)', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1024}) // gap 0
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
    // The offset is parked in the DOM so ANY copy of the module can release it.
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
