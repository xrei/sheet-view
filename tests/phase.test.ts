import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore, SheetPhase} from '../src/core/types'
import {mockMatchMedia} from './helpers'

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

    it('settles synchronously on open', () => {
      const handle = core.open({title: 'A'})
      expect(handle.phase()).toBe('settled')
      expect(el('dialog.sv-sheet').dataset['sheetSettled']).toBe('')
    })
  })

  describe('mobile', () => {
    let mm: ReturnType<typeof mockMatchMedia>

    beforeEach(() => {
      // matchMedia must be mocked before createSheetCore: makeIsMobile captures
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
      expect(handle.phase()).toBe('entering')

      vi.advanceTimersByTime(700) // the open rAF plus the 507ms settle
      expect(handle.phase()).toBe('settled')
    })

    it('settles immediately under reduced motion', () => {
      vi.useFakeTimers()
      mm.setReducedMotion(true)
      const handle = core.open({title: 'A'})

      vi.advanceTimersByTime(20) // just the rAF, not openSettleMs
      expect(handle.phase()).toBe('settled')
    })

    it("'closing' is terminal: the settle timer outliving the close cannot lift it", () => {
      vi.useFakeTimers()
      const handle = core.open({title: 'A'})
      vi.advanceTimersByTime(20) // the rAF that schedules the settle
      handle.close()

      vi.advanceTimersByTime(600)
      expect(handle.phase()).toBe('closing')
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

      handle.close()
      expect(seen).toEqual(['closing'])
    })

    it('onPhase returns an unsubscribe that stops notifications', () => {
      vi.useFakeTimers()
      const listener = vi.fn()
      const handle = core.open({title: 'A'})
      const off = handle.onPhase(listener)
      off()

      handle.close()
      vi.advanceTimersByTime(600)
      expect(listener).not.toHaveBeenCalled()
    })

    it('a throwing phase listener does not stop teardown or the scroll-lock release', () => {
      vi.useFakeTimers()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const handle = core.open({title: 'A'})
      handle.onPhase(() => {
        throw new Error('boom')
      })

      expect(() => handle.close()).not.toThrow()
      vi.advanceTimersByTime(600)
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
