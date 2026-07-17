import {afterEach, beforeEach, describe, expect, it} from 'vitest'

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

describe('scrollLock (scrollbar gap)', () => {
  let core: SheetCore | undefined
  let restore: (() => void) | undefined

  afterEach(() => {
    core?.__resetForTests()
    core = undefined
    restore?.()
    restore = undefined
  })

  it('reserves the vanished scrollbar width as body padding, then restores it', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1009}) // 15px classic scrollbar
    core = createSheetCore()
    core.open({title: 'A'})
    expect(document.body.style.paddingRight).toBe('15px') // page doesn't shift

    core.__resetForTests()
    expect(document.body.style.paddingRight).toBe('')
  })

  it('adds no padding when there is no gap (overlay scrollbars / scrollbar-gutter)', () => {
    restore = stubLayout({innerWidth: 1024, clientWidth: 1024}) // gap 0
    core = createSheetCore()
    core.open({title: 'A'})
    expect(document.body.style.paddingRight).toBe('')
  })
})
