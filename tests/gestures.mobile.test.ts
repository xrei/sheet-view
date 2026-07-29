import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {mockMatchMedia, stubOffsetTop} from './helpers'
import type {MockMatchMedia} from './helpers'

// The mobile drag branch (matchMedia-gated) has no coverage in the rest of the
// suite. matchMedia must be mocked BEFORE createSheetCore — makeIsMobile captures
// the MediaQueryList at construction.
const el = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T

describe('gestures (mobile)', () => {
  let core: SheetCore
  let mm: MockMatchMedia

  beforeEach(() => {
    mm = mockMatchMedia({mobile: true})
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    mm.restore()
    vi.useRealTimers()
  })

  it('#3 — reads panel.offsetTop once across scroll frames, re-reads after resize', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    const off = stubOffsetTop(panel, 800)

    for (let i = 0; i < 5; i++) scroll.dispatchEvent(new Event('scroll'))
    expect(off.reads()).toBe(1) // cached — not one layout read per frame

    window.dispatchEvent(new Event('resize'))
    scroll.dispatchEvent(new Event('scroll'))
    expect(off.reads()).toBe(2) // cache invalidated on resize

    off.restore()
  })

  it('#4 — reduced motion settles immediately, skipping the open settle delay', () => {
    vi.useFakeTimers()
    mm.setReducedMotion(true)
    core.open({title: 'Locked', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')

    // Flush the rAF the reduced-motion path uses, WITHOUT advancing the 400ms
    // openSettleMs. A locked sheet freezes (lockDrag → overflow-y:hidden) at
    // settle, so overflow-y proves settleOpen ran early instead of at 400ms.
    vi.advanceTimersByTime(50)
    expect(scroll.style.overflowY).toBe('hidden')
  })

  it('open does NOT drive a programmatic smooth scroll (iOS jumps it, not glides)', () => {
    // The mobile entrance must be a compositor transform, not scroll.scrollTo()
    // inside the mandatory-snap scroller — iOS Safari refuses to animate that and
    // snaps straight to the target, popping the card + backdrop in one frame.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const scrollTo = vi.fn()
    scroll.scrollTo = scrollTo as unknown as typeof scroll.scrollTo

    vi.advanceTimersByTime(600) // flush the whole open rAF chain + openSettleMs
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('the backdrop fade is flagged for CSS, not duplicated as an inline duration', () => {
    // No scroll animation runs on open, so the single onScroll from resting at the
    // snap point would pop the dim to full. base.css fades it while
    // [data-sheet-settled] is absent — one token shared with the card slide, so the
    // two can't drift. JS must not arm a duration of its own (that was the drift).
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')

    expect(backdrop.style.transition).toBe('')
    expect(root.hasAttribute('data-sheet-settled')).toBe(false)

    // At settle the flag lands, so live drag frames set the dim opacity raw.
    vi.advanceTimersByTime(600)
    expect(root.hasAttribute('data-sheet-settled')).toBe(true)
  })

  it('enterMs mirrors onto the sheet as the private token base.css reads', () => {
    // The public --sheet-enter-duration is left alone on purpose: it's read ahead of
    // this private inline value, so a consumer's CSS override still wins.
    const slow = createSheetCore({enterMs: 600})
    slow.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    expect(root.style.getPropertyValue('--_sheet-enter-ms')).toBe('600ms')
    expect(root.style.getPropertyValue('--sheet-enter-duration')).toBe('')
    slow.__resetForTests()
  })

  it('a sheet opened on desktop is settled, so a rotation into mobile drags raw', () => {
    mm.setMobile(false)
    core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    // No entrance ran, so there is no fade to protect — leaving the flag off would
    // arm the mobile enter transition on the dim for the rest of the sheet's life.
    expect(root.hasAttribute('data-sheet-settled')).toBe(true)
  })

  it('a non-drag close hands the dim back to CSS instead of holding it at full', () => {
    // The card leaves by scrolling, on a timeline the UA owns — but the dim's
    // opacity is inline (set per scroll frame) and onScroll stops updating it once
    // isClosing, so it used to sit at full for the whole closeMs and vanish with the
    // DOM. Clearing it lets base.css fade it from [data-sheet-state='closing'].
    core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    expect(backdrop.style.opacity).toBe('1') // driven inline while open

    core.getSnapshot()[0]!.handle.close()

    expect(root.dataset['sheetState']).toBe('closing')
    expect(backdrop.style.opacity).toBe('')
  })

  // Drives a sheet to the open snap point so openDone latches (no 400ms wait).
  const settleOpen = (scroll: HTMLElement, panel: HTMLElement): void => {
    stubOffsetTop(panel, 800)
    scroll.scrollTop = 800
    scroll.dispatchEvent(new Event('scroll')) // progress 1 → openDone = true
  }

  it('drag-close via wheel/trackpad (no touchstart) still dismisses — not resurrectable', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    settleOpen(scroll, panel)

    // Snap lands fully closed WITHOUT a touchstart (desktop/devtools/trackpad).
    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true) // committed, no zombie modal
  })

  it('a touch drag past halfway dismisses (responsive commit)', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    settleOpen(scroll, panel)

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 240 // progress 0.3 — past the 0.5 dismiss line
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
  })

  it('drag-close fades the backdrop in lockstep with the card slide', () => {
    // The card slide and backdrop fade must share duration + easing (and start in
    // the same frame), or the backdrop's slower curve lingers after the card is
    // visually gone — a desync where the dim outlasts the sheet.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    const card = el<HTMLElement>('.sv-sheet__card')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    settleOpen(scroll, panel)

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 240 // past halfway → commitDragClose
    scroll.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(20) // flush the rAF both transitions are armed in

    // Card and backdrop share the same easing curve (was 'ease' on the backdrop).
    expect(card.style.transition).toContain('cubic-bezier(0.32, 0.72, 0, 1)')
    expect(backdrop.style.transition).toContain('cubic-bezier(0.32, 0.72, 0, 1)')
    // …and the same duration (dragCloseMs), and the fade actually runs.
    expect(backdrop.style.transition).toContain('220ms')
    expect(card.style.transition).toContain('220ms')
    expect(backdrop.style.opacity).toBe('0')
  })

  it("a same-tick close() keeps data-sheet-state='closing' — the open rAF must not overwrite it", () => {
    // open() schedules a rAF that stamps 'open'; a close() in the same tick has
    // already stamped 'closing'. Writing 'open' over it unmatches every
    // [data-sheet-state='closing'] rule and kills the exit animation.
    vi.useFakeTimers()
    const handle = core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    handle.close()
    expect(root.dataset['sheetState']).toBe('closing')

    vi.advanceTimersByTime(50) // flush the open rAF
    expect(root.dataset['sheetState']).toBe('closing')
  })

  it('a close() inside the entrance window is not yanked back by the settle timer', () => {
    // closeDisabled arms lockDrag at settle, and the settle timer is never
    // cancelled. A programmatic close() (unguarded by closeDisabled) between the
    // open rAF and settle used to let that timer re-freeze the scroller at the
    // OPEN snap point and pop the dim back to full, mid-exit.
    vi.useFakeTimers()
    const handle = core.open({title: 'A', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    stubOffsetTop(el<HTMLElement>('.sv-sheet__panel'), 800)

    vi.advanceTimersByTime(50) // past the open rAF — the settle timer is armed
    handle.close()
    vi.advanceTimersByTime(600) // the settle timer fires during/after the exit

    expect(scroll.style.overflowY).toBe('')
    expect(backdrop.style.opacity).not.toBe('1')
  })

  it("desktop: a same-tick close() also survives the open rAF", () => {
    vi.useFakeTimers()
    mm.setMobile(false)
    const desktop = createSheetCore()
    const handle = desktop.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    handle.close()
    vi.advanceTimersByTime(50) // flush the open rAF
    expect(root.dataset['sheetState']).toBe('closing')
    desktop.__resetForTests()
  })

  it('#5 — a sheet caught mid-open and dragged back down dismisses (no invisible modal)', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    stubOffsetTop(panel, 800) // openDone NOT latched — caught before settle

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 20 // progress 0.025
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
  })

  it('#5 — a locked sheet caught mid-open is frozen open, never dismissed', () => {
    core.open({title: 'Locked', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    stubOffsetTop(panel, 800)

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 20
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(false) // not dismissed
    expect(scroll.style.overflowY).toBe('hidden') // frozen open (lockDrag)
  })

  it('#6 — crossing the breakpoint while open keeps the sheet visible, not a closed snap', () => {
    mm.setMobile(false) // opened on desktop
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    stubOffsetTop(panel, 800)

    // desktop → mobile (rotate / iPad split-view): land at the OPEN snap point,
    // not scrollTop 0 (which would be an invisible modal holding the page).
    mm.setMobile(true)
    expect(scroll.scrollTop).toBe(800)
    expect(backdrop.style.opacity).toBe('1')

    // mobile → desktop: the per-frame inline opacity is handed back to CSS.
    mm.setMobile(false)
    expect(backdrop.style.opacity).toBe('')
  })
})
