import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore, SheetPhase} from '../src/core/types'
import {mockMatchMedia, stubOffsetTop} from './helpers'

const el = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T

describe('motion phase', () => {
  let core: SheetCore

  afterEach(() => {
    core.__resetForTests()
    vi.useRealTimers()
  })

  describe('desktop', () => {
    beforeEach(() => {
      core = createSheetCore()
    })

    it("settles synchronously — there is no mobile entrance to wait out", () => {
      const handle = core.open({title: 'A'})
      expect(handle.phase()).toBe('settled')
      expect(el('dialog.sv-sheet').dataset['sheetSettled']).toBe('')
    })
  })

  describe('mobile', () => {
    let mm: ReturnType<typeof mockMatchMedia>

    beforeEach(() => {
      // matchMedia must be mocked BEFORE createSheetCore — makeIsMobile captures
      // the MediaQueryList at construction.
      mm = mockMatchMedia({mobile: true})
      core = createSheetCore()
    })

    afterEach(() => {
      mm.restore()
    })

    it("opens 'entering' and reaches 'settled' after openSettleMs", () => {
      vi.useFakeTimers()
      const handle = core.open({title: 'A'})
      stubOffsetTop(el('[data-sheet-part="panel"]'), 800)
      expect(handle.phase()).toBe('entering')

      vi.advanceTimersByTime(600) // the open rAF chain + the 400ms settle
      expect(handle.phase()).toBe('settled')
    })

    it("settles immediately under reduced motion", () => {
      vi.useFakeTimers()
      mm.setReducedMotion(true)
      const handle = core.open({title: 'A'})
      stubOffsetTop(el('[data-sheet-part="panel"]'), 800)

      vi.advanceTimersByTime(20) // just the rAF, not openSettleMs
      expect(handle.phase()).toBe('settled')
    })
  })

  describe('subscription', () => {
    beforeEach(() => {
      core = createSheetCore()
    })

    it("goes to 'closing' on close() and notifies once per transition", () => {
      vi.useFakeTimers()
      const seen: SheetPhase[] = []
      const handle = core.open({title: 'A'})
      handle.onPhase((p) => seen.push(p))

      handle.close()
      expect(handle.phase()).toBe('closing')
      expect(seen).toEqual(['closing'])

      // Idempotent: a second close is a no-op, so no second notification.
      handle.close()
      expect(seen).toEqual(['closing'])
    })

    it("never leaves 'closing' — a late settle must not say it is safe to measure", () => {
      vi.useFakeTimers()
      const handle = core.open({title: 'A'})
      handle.close()

      // A breakpoint crossing mid-exit calls markSettled; it must not win.
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(100)
      expect(handle.phase()).toBe('closing')
    })

    it('unsubscribes, and clears listeners on teardown', () => {
      vi.useFakeTimers()
      const listener = vi.fn()
      const handle = core.open({title: 'A'})
      const off = handle.onPhase(listener)
      off()

      handle.close()
      expect(listener).not.toHaveBeenCalled()
      vi.advanceTimersByTime(320)
      expect(core.getSnapshot()).toHaveLength(0)
    })

    it('a throwing listener cannot break the close path (or the page stays locked)', () => {
      vi.useFakeTimers()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const handle = core.open({title: 'A'})
      handle.onPhase(() => {
        throw new Error('boom')
      })

      expect(() => handle.close()).not.toThrow()
      vi.advanceTimersByTime(320)
      expect(core.getSnapshot()).toHaveLength(0)
      expect(
        document.documentElement.hasAttribute('data-sheet-scroll-lock'),
      ).toBe(false)
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })

    it('the snapshot carries the phase and the measuring nodes', () => {
      core.open({title: 'A'})
      const snap = core.getSnapshot()[0]!
      expect(snap.phase).toBe('settled')
      expect(snap.card).toBe(el('[data-sheet-part="card"]'))
      expect(snap.scroll).toBe(el('[data-sheet-part="scroll"]'))
      expect(snap.layers.anchored).toBe(el('[data-sheet-part="anchor-layer"]'))
      expect(snap.layers.viewport).toBe(el('[data-sheet-part="viewport-layer"]'))
    })
  })
})
