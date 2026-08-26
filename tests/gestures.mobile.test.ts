import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ENTER_EASE, EXIT_EASE, FLICK_EASE, runMotion} from '../src/core/gestures'
import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {
  mockMatchMedia,
  motionMs,
  motionOf,
  motionRange,
  easingOf,
  overshoots,
  paceAt,
  stubLayout,
  stubOffsetTop,
} from './helpers'
import type {MockMatchMedia} from './helpers'

const el = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T

describe('gestures (mobile)', () => {
  let core: SheetCore
  let mm: MockMatchMedia

  beforeEach(() => {
    // matchMedia must be mocked before createSheetCore: makeIsMobile captures the
    // MediaQueryList at construction.
    mm = mockMatchMedia({mobile: true})
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    mm.restore()
    vi.useRealTimers()
  })

  // Drives a sheet to the open snap point so openDone latches without the settle wait.
  const settleOpen = (scroll: HTMLElement, panel: HTMLElement): void => {
    stubOffsetTop(panel, 800)
    scroll.scrollTop = 800
    scroll.dispatchEvent(new Event('scroll'))
  }

  // jsdom reports 0 for every dimension, and the release geometry is a function
  // of the card height.
  const stubCardHeight = (card: HTMLElement, px: number): void => {
    Object.defineProperty(card, 'offsetHeight', {configurable: true, get: () => px})
  }

  // Records every scrollTop write from here on, tagged with the freeze state and
  // the snap state it landed in.
  interface Park {
    to: number
    frozen: boolean
    snapped: boolean
  }
  const recordParks = (scroll: HTMLElement): Park[] => {
    const parks: Park[] = []
    let raw = scroll.scrollTop
    Object.defineProperty(scroll, 'scrollTop', {
      configurable: true,
      get: () => raw,
      set: (v: number) => {
        raw = v
        parks.push({
          to: v,
          frozen: scroll.style.overflow === 'hidden',
          snapped: scroll.style.scrollSnapType !== 'none',
        })
      },
    })
    return parks
  }

  // Releases the sheet from `at` and reports the card's animation.
  const releaseFrom = (at: number): {ms: number; closing: boolean; card: HTMLElement} => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    stubCardHeight(card, 800)
    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = at
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend'))
    return {ms: motionMs(card), closing: core.getSnapshot()[0]!.isClosing, card}
  }

  it('a motion is two keyframes joined by a curve that cannot leave [0,1]', () => {
    const box = document.createElement('div')
    runMotion(box, ENTER_EASE, 500, (p) => ({transform: `translateY(${100 * p}px)`}))

    expect(motionOf(box)!.frames).toEqual([
      {transform: 'translateY(0px)'},
      {transform: 'translateY(100px)'},
    ])
    expect(easingOf(box)).toBe(ENTER_EASE)

    for (const ease of [ENTER_EASE, EXIT_EASE, FLICK_EASE]) {
      const points = /\(([^)]+)\)/.exec(ease)![1]!.split(',').map(Number)
      expect(points).toHaveLength(4)
      for (const v of points) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      runMotion(box, ease, 500, (p) => ({opacity: String(p)}))
      expect(motionOf(box)!.frames).toHaveLength(2)
      expect(overshoots(box)).toBe(false)
    }
  })

  it("every motion carries fill: 'backwards'", () => {
    // An animation does not affect rendering until the frame after it is created,
    // and callers write the resting value inline first, so without a backwards
    // fill the element paints one frame at its destination.
    const box = document.createElement('div')
    runMotion(box, EXIT_EASE, 500, (p) => ({opacity: String(p)}))
    expect(motionOf(box)!.effect.getTiming().fill).toBe('backwards')

    releaseFrom(410)
    expect(motionOf(el<HTMLElement>('.sv-sheet__card'))!.effect.getTiming().fill).toBe(
      'backwards',
    )
  })

  it('touchstart turns scroll snap off', () => {
    // With snap live the browser starts its own animation to the nearest snap
    // point on the release, which drags the card the opposite way from the exit.
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    expect(scroll.style.scrollSnapType).toBe('')

    scroll.dispatchEvent(new Event('touchstart'))
    expect(scroll.style.scrollSnapType).toBe('none')
  })

  it('the exit parks the scroller before it freezes it', () => {
    // A programmatic scroll only cancels the browser's own snap animation while
    // the element is still a live scroller; once overflow is hidden it cancels
    // nothing.
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    stubCardHeight(card, 800)
    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 300
    scroll.dispatchEvent(new Event('scroll'))

    const parks = recordParks(scroll)
    scroll.dispatchEvent(new Event('touchend')) // → dismiss → runSheetExit
    expect(core.getSnapshot()[0]!.isClosing).toBe(true)

    // The cancelling write lands first, the anti-clamp one after the freeze,
    // both at the position the finger left and neither with snap live.
    expect(parks[0]).toEqual({to: 300, frozen: false, snapped: false})
    expect(parks.at(-1)).toEqual({to: 300, frozen: true, snapped: false})
  })

  it('the exit takes snap off before it parks, with no touchstart to do it', () => {
    // A wheel or trackpad drag never fires touchstart, so this path is the only
    // thing standing between the park and a live snap. Parking a snapping
    // scroller starts the browser's own animation to the nearest point, which
    // runs against the exit.
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    expect(scroll.style.scrollSnapType).toBe('')

    const parks = recordParks(scroll)
    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll')) // → dismiss → runSheetExit
    expect(core.getSnapshot()[0]!.isClosing).toBe(true)

    expect(parks.filter((p) => p.snapped)).toEqual([{to: 0, frozen: false, snapped: true}])
    expect(parks.at(-1)!.snapped).toBe(false)
  })

  it('the return parks the scroller before it freezes it', () => {
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    stubCardHeight(el<HTMLElement>('.sv-sheet__card'), 800)
    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 700 // above the midpoint, so the release returns
    scroll.dispatchEvent(new Event('scroll'))

    const parks = recordParks(scroll)
    scroll.dispatchEvent(new Event('touchend'))
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)

    expect(parks[0]).toEqual({to: 800, frozen: false, snapped: false})
    expect(parks.at(-1)).toEqual({to: 800, frozen: true, snapped: false})
  })

  it('the thaw re-parks the scroller after it hands the overflow back', () => {
    // Freezing only stops the user scrolling: the release's momentum survives it
    // and Chrome resumes the fling the frame overflow comes back.
    vi.useFakeTimers()
    releaseFrom(410)
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    expect(scroll.style.overflow).toBe('hidden')

    const parks = recordParks(scroll)
    scroll.scrollTop = 1123 // the fling, carrying on through the freeze

    vi.advanceTimersByTime(20) // the rAF thaw
    expect(scroll.style.overflow).toBe('')
    expect(parks.at(-1)).toEqual({to: 800, frozen: false, snapped: false})
    expect(scroll.scrollTop).toBe(800)
  })

  it('a scroll frame during a return neither drives nor dismisses the sheet', () => {
    // The freeze covers the first frame only, and the rest of the flight is a
    // live scroller with its animations armed and `touching` already false.
    vi.useFakeTimers()
    releaseFrom(410)
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    const dim = backdrop.style.opacity

    expect(scroll.style.overflow).toBe('hidden')
    scroll.scrollTop = 100
    scroll.dispatchEvent(new Event('scroll'))
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
    expect(backdrop.style.opacity).toBe(dim)

    vi.advanceTimersByTime(20) // thawed, still in flight
    expect(scroll.style.overflow).toBe('')
    scroll.scrollTop = 200 // way past the commit point
    scroll.dispatchEvent(new Event('scroll'))
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
    expect(backdrop.style.opacity).toBe(dim)
  })

  it('every release takes the same time whatever the travel', () => {
    vi.useFakeTimers()
    const near = releaseFrom(240) // 240px left to travel → dismisses
    expect(near.closing).toBe(true)
    expect(near.ms).toBe(517)
    core.__resetForTests()
    const far = releaseFrom(80) // 720px left → dismisses
    expect(far.closing).toBe(true)
    expect(far.ms).toBe(517)
  })

  it('a flick differs from a slow release by curve and pace, never by duration', () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now')
    const flickCard = (): HTMLElement => {
      core.open({title: 'A', content: () => 'body'})
      const scroll = el<HTMLElement>('.sv-sheet__scroll')
      const card = el<HTMLElement>('.sv-sheet__card')
      settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
      stubCardHeight(card, 800)
      scroll.dispatchEvent(new Event('touchstart'))
      now.mockReturnValue(1000)
      scroll.scrollTop = 400
      scroll.dispatchEvent(new Event('scroll'))
      now.mockReturnValue(1016)
      scroll.scrollTop = 240 // 10 px/ms down, a flick, with only 240px left
      scroll.dispatchEvent(new Event('scroll'))
      scroll.dispatchEvent(new Event('touchend'))
      return card
    }
    const flick = flickCard()
    core.__resetForTests()
    const {card: slow} = releaseFrom(240) // same commit, no velocity

    expect(motionMs(flick)).toBe(517)
    expect(motionMs(slow)).toBe(517)
    expect(easingOf(flick)).toBe(FLICK_EASE)
    expect(easingOf(slow)).toBe(EXIT_EASE)
    // The flick is stiffer, so at the same instant it is further along.
    expect(paceAt(flick, 0.2)).toBeGreaterThan(paceAt(slow, 0.2))
    expect(overshoots(flick)).toBe(false)
    expect(overshoots(slow)).toBe(false)
    now.mockRestore()
  })

  it('the scroll hot path reads panel.offsetTop once, and again after a resize', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    const off = stubOffsetTop(panel, 800)

    for (let i = 0; i < 5; i++) scroll.dispatchEvent(new Event('scroll'))
    expect(off.reads()).toBe(1)

    window.dispatchEvent(new Event('resize'))
    scroll.dispatchEvent(new Event('scroll'))
    expect(off.reads()).toBe(2)

    off.restore()
  })

  it('reduced motion settles the sheet in the open rAF, not after openSettleMs', () => {
    vi.useFakeTimers()
    mm.setReducedMotion(true)
    core.open({title: 'Locked', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')

    // A closeDisabled sheet freezes its drag scroller at settle, so overflow-y is
    // the proof settleOpen ran inside the rAF and not at openSettleMs (507).
    vi.advanceTimersByTime(50)
    expect(scroll.style.overflowY).toBe('hidden')
  })

  it('the mobile entrance never calls scroll.scrollTo()', () => {
    // WebKit refuses to animate scrollTo() inside a mandatory-snap scroller and
    // jumps to the target, popping card and dim in one frame. The entrance is a
    // compositor transform in base.css instead.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const scrollTo = vi.fn()
    scroll.scrollTo = scrollTo as unknown as typeof scroll.scrollTo

    vi.advanceTimersByTime(600) // the whole open rAF chain plus openSettleMs
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('enterMs mirrors onto the sheet as the private token base.css reads', () => {
    // The public --sheet-enter-duration is read ahead of this private value, so a
    // consumer's CSS override wins over it.
    const slow = createSheetCore({enterMs: 600})
    slow.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    expect(root.style.getPropertyValue('--_sheet-enter-ms')).toBe('600ms')
    expect(root.style.getPropertyValue('--sheet-enter-duration')).toBe('')
    slow.__resetForTests()
  })

  it('a sheet opened on desktop carries data-sheet-settled from the start', () => {
    // No entrance runs there, and the flag is what tells base.css to stop
    // transitioning the dim so drag frames can set it raw.
    mm.setMobile(false)
    core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    expect(root.hasAttribute('data-sheet-settled')).toBe(true)
  })

  it('a programmatic close runs the same transform exit as a drag commit', () => {
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')
    const card = el<HTMLElement>('.sv-sheet__card')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    expect(backdrop.style.opacity).toBe('1') // driven inline while open

    core.getSnapshot()[0]!.handle.close()
    expect(root.dataset['sheetState']).toBe('closing')

    vi.advanceTimersByTime(20) // flush the rAF the transitions are armed in
    expect(motionMs(card)).toBe(517) // closeMs default
    expect(overshoots(card)).toBe(false)
    expect(motionMs(backdrop)).toBe(517)
    expect(overshoots(backdrop)).toBe(false)
    expect(backdrop.style.opacity).toBe('0')
    expect(scroll.style.overflow).toBe('hidden') // off the scroller, momentum dead
  })

  it('a drag commit slides the card and fades the dim on one clock and one curve', () => {
    // A backdrop on its own curve lingers after the card is visually gone.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 240 // past halfway…
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend')) // …and released there
    vi.advanceTimersByTime(20)

    expect(motionMs(card)).toBe(motionMs(backdrop))
    expect(motionMs(card)).toBe(517)
    expect(easingOf(card)).toBe(EXIT_EASE)
    expect(easingOf(backdrop)).toBe(EXIT_EASE)
    expect(backdrop.style.opacity).toBe('0')
  })

  it('the snap-back fades the dim from where the drag left it', () => {
    // The drag drives the dim inline per frame, so at the release it sits at the
    // finger's position: animating from full flashes the settled dim over a card
    // that is still travelling.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 400 // progress 0.5, above the midpoint, so it returns
    scroll.dispatchEvent(new Event('scroll'))
    expect(backdrop.style.opacity).toBe('0.5') // driven by the finger

    scroll.dispatchEvent(new Event('touchend'))
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
    expect(backdrop.style.opacity).toBe('1') // rest
    expect(motionRange(backdrop, 'opacity')).toEqual(['0.5', '1'])
  })

  it('the commit point is half the card, not half the viewport', () => {
    vi.useFakeTimers()
    const drag = (cardPx: number, to: number): boolean => {
      core.open({title: 'A', content: () => 'body'})
      const scroll = el<HTMLElement>('.sv-sheet__scroll')
      settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
      stubCardHeight(el<HTMLElement>('.sv-sheet__card'), cardPx)
      scroll.dispatchEvent(new Event('touchstart'))
      scroll.scrollTop = to
      scroll.dispatchEvent(new Event('scroll'))
      scroll.dispatchEvent(new Event('touchend'))
      const closing = core.getSnapshot()[0]!.isClosing
      core.__resetForTests()
      return closing
    }
    // A 448px card in an 800px viewport is gone once it has travelled 224px, so
    // the boundary sits at scrollTop 576.
    expect(drag(448, 590)).toBe(false) // 210px travelled, not yet
    expect(drag(448, 560)).toBe(true) // 240px travelled, committed
    expect(drag(448, 420)).toBe(true)
    // A full-height card's own midpoint is also the viewport's.
    expect(drag(800, 410)).toBe(false)
    expect(drag(800, 390)).toBe(true)
  })

  it('a snap that lands closed with no touchstart dismisses the sheet', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    // Trackpad, wheel and devtools drags have no touch to wait for.
    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
  })

  it('a touch drag carried past halfway and back does not dismiss', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 240 // dip below the line…
    scroll.dispatchEvent(new Event('scroll'))
    scroll.scrollTop = 700 // …and carry it back up
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
  })

  it('a downward flick released above the midpoint dismisses', () => {
    // A fast release moves one station in its direction of travel from wherever
    // it is. Velocity is estimated over the finger's own frames, so the clock is
    // scripted.
    const now = vi.spyOn(performance, 'now')
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    now.mockReturnValue(1000)
    scroll.scrollTop = 700
    scroll.dispatchEvent(new Event('scroll'))
    now.mockReturnValue(1016)
    scroll.scrollTop = 540 // 160px in 16ms = 10 px/ms
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend')) // released above the midpoint

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
    now.mockRestore()
  })

  it('an upward flick from below the midpoint returns on the exit curve', () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now')
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    now.mockReturnValue(1000)
    scroll.scrollTop = 240 // deep below the midpoint…
    scroll.dispatchEvent(new Event('scroll'))
    now.mockReturnValue(1016)
    scroll.scrollTop = 400 // …moving up fast at the lift (10 px/ms)
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(false) // one station up
    vi.advanceTimersByTime(20)
    expect(easingOf(card)).toBe(EXIT_EASE) // a return rides it however hard it was thrown
    expect(motionMs(card)).toBe(517)
    expect(overshoots(card)).toBe(false)
    now.mockRestore()
  })

  it('one reversed frame cannot flip a release: the estimate is a window', () => {
    // A finger that has left the glass reports nothing more, but a mouse
    // translated into touch (devtools device mode) keeps reporting and can
    // reverse in the last frame.
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now')
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    // A steady drag down, below the midpoint: this gesture is a dismissal.
    let t = 1000
    for (const top of [700, 600, 500, 400, 300]) {
      now.mockReturnValue((t += 16))
      scroll.scrollTop = top
      scroll.dispatchEvent(new Event('scroll'))
    }
    // …and one frame back up at the lift, which alone reads as −2.5 px/ms.
    now.mockReturnValue((t += 16))
    scroll.scrollTop = 340
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
    now.mockRestore()
  })

  it('a slow release above the midpoint returns on the fixed clock, not the native snap', () => {
    // The browser's own snap times itself by distance. The release is taken off
    // the scroller instead: park at the open point, compensate with a transform,
    // animate to rest.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 700 // above the midpoint, velocity ~0
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('touchend'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
    expect(scroll.style.overflow).toBe('hidden') // off the scroller
    expect(scroll.scrollTop).toBe(800) // parked at the open point

    // Armed in the same task as the release: by the next frame the scroller is
    // frozen, so a deferred arm shows one motionless frame after the finger lifts.
    expect(motionMs(card)).toBe(517)
    expect(overshoots(card)).toBe(false)
    expect(card.style.transform).toBe('') // heading to rest

    vi.advanceTimersByTime(600) // the motion lands: unfrozen for the next drag
    expect(scroll.style.overflow).toBe('')
  })

  it('a touch during the snap-back hands the offset from the card to the scroller', () => {
    // An overflow:hidden element is not a scroll container at all, so a finger
    // landing on one chains straight past the sheet and rubber-bands the page.
    vi.useFakeTimers()
    const {card} = releaseFrom(410) // above the midpoint → returns
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')

    // The freeze kills the fling the release left behind, and lasts one frame.
    expect(scroll.style.overflow).toBe('hidden')
    vi.advanceTimersByTime(20)
    expect(scroll.style.overflow).toBe('')
    expect(scroll.style.touchAction).toBe('')
    expect(motionOf(card)).toBeDefined() // still travelling

    // jsdom resolves no transforms, so stand in for the engine: the card is 300px
    // below rest, i.e. 500 of the 800 given back.
    const gcs = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(
        (node: Element) =>
          ({
            transform: node === card ? 'matrix(1, 0, 0, 1, 0, 300)' : 'none',
            opacity: '1',
          }) as unknown as CSSStyleDeclaration,
      )
    scroll.dispatchEvent(new Event('touchstart'))
    gcs.mockRestore()

    expect(motionOf(card)).toBeUndefined() // the return is off
    expect(card.style.transform).toBe('') // the card gave the offset up…
    expect(scroll.scrollTop).toBe(500) // …and the scroller took it on
    expect(backdrop.style.opacity).toBe('0.625') // the dim follows the position
  })

  it('a caught return released without moving restores scroll snap', () => {
    // Snap stays off for the whole flight so it cannot fight the grab, so the
    // path that ends the gesture without displacing anything restores it itself.
    vi.useFakeTimers()
    releaseFrom(410)
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    vi.advanceTimersByTime(20)
    expect(scroll.style.scrollSnapType).toBe('none')

    scroll.dispatchEvent(new Event('touchstart')) // catches at rest (no live ty)
    expect(scroll.scrollTop).toBe(800)
    scroll.dispatchEvent(new Event('touchend'))
    expect(scroll.style.scrollSnapType).toBe('')
  })

  it('a release that displaced nothing plays no return', () => {
    // Touch events bubble out of the card's own scroller, so every tap on a
    // field and every pull of the body ends here. `offsetTop` is an integer
    // where `scrollTop` is a double, so a resting sheet sits a fraction below
    // the snap point and an exact compare read that as a drag: half a second of
    // the card travelling, the scroller frozen, and snap off, over a sheet
    // nobody moved.
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, el<HTMLElement>('.sv-sheet__panel'))
    stubCardHeight(card, 800)

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 799.6 // sub-pixel rest, not a drag
    scroll.dispatchEvent(new Event('touchend'))

    expect(motionOf(card)).toBeUndefined()
    expect(scroll.style.overflow).toBe('')
    expect(scroll.style.touchAction).toBe('')
    expect(scroll.style.scrollSnapType).toBe('') // snap handed straight back
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
  })

  it('a stale snap max cannot invent a drag: the release re-measures', () => {
    // The dynamic viewport moves under a live sheet (URL bar, keyboard) and the
    // memo is only dropped on a resize event. Reading it stale at the release
    // put a resting sheet below its own snap point.
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const panel = el<HTMLElement>('.sv-sheet__panel')
    const card = el<HTMLElement>('.sv-sheet__card')
    settleOpen(scroll, panel) // memoises 800
    stubCardHeight(card, 800)

    stubOffsetTop(panel, 700) // the viewport grew; no resize fired
    scroll.scrollTop = 700 // still parked at the open point
    scroll.dispatchEvent(new Event('touchstart'))
    scroll.dispatchEvent(new Event('touchend'))

    expect(motionOf(card)).toBeUndefined()
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
  })

  it('a touch during the entrance does not leave the scroller snapless', () => {
    // touchstart takes snap off unconditionally, and the drag is not armed yet,
    // so this release decides nothing — but it still has to give snap back, or
    // the sheet spends the rest of the entrance with no snap point to return to.
    vi.useFakeTimers()
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')

    scroll.dispatchEvent(new Event('touchstart')) // mid-entrance, before settle
    expect(scroll.style.scrollSnapType).toBe('none')
    scroll.dispatchEvent(new Event('touchend'))

    expect(scroll.style.scrollSnapType).toBe('')
    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
  })

  it('a return that is never touched puts the scroller back on its own', () => {
    vi.useFakeTimers()
    releaseFrom(410)
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    vi.advanceTimersByTime(600) // past the 517ms return
    expect(scroll.style.overflow).toBe('')
    expect(scroll.style.touchAction).toBe('')
    expect(scroll.style.scrollSnapType).toBe('')
  })

  it("a same-tick close() keeps data-sheet-state='closing' through the open rAF", () => {
    // The rAF stamps 'open'; writing it over 'closing' unmatches every
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
    // cancelled, so a close() between the open rAF and settle has to survive it.
    vi.useFakeTimers()
    const handle = core.open({title: 'A', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    stubOffsetTop(el<HTMLElement>('.sv-sheet__panel'), 800)

    vi.advanceTimersByTime(50) // past the open rAF, the settle timer is armed
    handle.close()
    vi.advanceTimersByTime(600) // the settle timer fires during/after the exit

    expect(scroll.style.overflowY).toBe('')
    expect(backdrop.style.opacity).not.toBe('1')
  })

  it("desktop: a same-tick close() keeps data-sheet-state='closing'", () => {
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

  it("desktop: data-sheet-state flips to 'open' in a rAF, a frame after open()", () => {
    // Which is why the entrance is an animation, not a transition keyed off the
    // open state: nothing keyed off it can start until frame two.
    vi.useFakeTimers()
    mm.setMobile(false)
    const desktop = createSheetCore()
    desktop.open({title: 'A', content: () => 'body'})
    const root = el<HTMLElement>('.sv-sheet')

    expect(root.dataset['sheetState']).toBe('opening')
    vi.advanceTimersByTime(50)
    expect(root.dataset['sheetState']).toBe('open')
    desktop.__resetForTests()
  })

  it('desktop: the exit slides the card off the bottom edge and never fades it', () => {
    vi.useFakeTimers()
    mm.setMobile(false)
    const restore = stubLayout({innerHeight: 900})
    const desktop = createSheetCore()
    const handle = desktop.open({title: 'A', content: () => 'body'})
    const card = el<HTMLElement>('.sv-sheet__card')
    Object.defineProperty(card, 'offsetHeight', {configurable: true, get: () => 500})
    vi.advanceTimersByTime(50)

    handle.close()

    // Half the viewport plus half the card puts the top edge on the bottom edge,
    // the distance base.css rises through as calc(50dvh + 50%).
    expect(motionRange(card, 'transform')).toEqual([
      'translateY(0px)',
      'translateY(700px)',
    ])
    expect(motionOf(card)!.frames.some((f) => 'opacity' in f)).toBe(false)
    expect(card.style.opacity).toBe('')
    expect(easingOf(card)).toBe(ENTER_EASE) // the presentation curve, both ways
    restore()
    desktop.__resetForTests()
  })

  it('desktop: an exit inside the entrance starts where the card actually is', () => {
    // A transition never starts on a property a CSS animation is animating, and
    // the entrance is one on both transform and opacity, so the exit is a single
    // animation composed from the pose the entrance reached.
    vi.useFakeTimers()
    mm.setMobile(false)
    const restore = stubLayout({innerHeight: 900})
    const desktop = createSheetCore()
    const handle = desktop.open({title: 'A', content: () => 'body'})
    const card = el<HTMLElement>('.sv-sheet__card')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    Object.defineProperty(card, 'offsetHeight', {configurable: true, get: () => 500})

    // jsdom resolves no transforms, so stand in for an engine caught mid-rise:
    // the card 240px below rest, the dim half faded in.
    const gcs = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(
        (node: Element) =>
          ({
            transform: node === card ? 'matrix(1, 0, 0, 1, 0, 240)' : 'none',
            opacity: node === backdrop ? '0.5' : '1',
          }) as unknown as CSSStyleDeclaration,
      )
    handle.close()
    gcs.mockRestore()

    expect(motionRange(card, 'transform')).toEqual([
      'translateY(240px)',
      'translateY(700px)',
    ])
    expect(motionRange(backdrop, 'opacity')).toEqual(['0.5', '0'])
    expect(motionMs(backdrop)).toBe(motionMs(card))

    restore()
    desktop.__resetForTests()
  })

  it('a sheet caught mid-open and dragged back down dismisses', () => {
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    stubOffsetTop(el<HTMLElement>('.sv-sheet__panel'), 800) // openDone not latched

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 20 // progress 0.025
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(true)
  })

  it('a locked sheet caught mid-open is frozen open, never dismissed', () => {
    core.open({title: 'Locked', closeDisabled: true, content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    stubOffsetTop(el<HTMLElement>('.sv-sheet__panel'), 800)

    scroll.dispatchEvent(new Event('touchstart'))
    scroll.scrollTop = 20
    scroll.dispatchEvent(new Event('scroll'))

    expect(core.getSnapshot()[0]!.isClosing).toBe(false)
    expect(scroll.style.overflowY).toBe('hidden') // frozen open (lockDrag)
  })

  // The mobile dim rests at an inline opacity of '1' because drag frames write it
  // raw, so the stack handoff runs in JS in both directions.
  const els = (): {
    scroll: HTMLElement
    panel: HTMLElement
    backdrop: HTMLElement
    scrim: HTMLElement
  } => ({
    scroll: el<HTMLElement>('.sv-sheet__scroll'),
    panel: el<HTMLElement>('.sv-sheet__panel'),
    backdrop: el<HTMLElement>('.sv-sheet__backdrop'),
    scrim: el<HTMLElement>('.sv-sheet__scrim'),
  })

  it("promotion fades the scrim back to clear on the closing sheet's own pair", () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const a = els()
    stubOffsetTop(a.panel, 800)
    core.open({title: 'B'})
    // Demoted: the page dim stays pinned on the bottom sheet's backdrop, and the
    // new sheet's dim is the scrim on this card at the under-top fraction.
    expect(a.backdrop.style.opacity).toBe('1')
    expect(a.scrim.style.opacity).toBe('0.6')

    core.getSnapshot()[1]!.handle.close()
    expect(a.backdrop.style.opacity).toBe('1')
    expect(a.scrim.style.opacity).toBe('') // rest, with the journey to it armed
    expect(motionRange(a.scrim, 'opacity')).toEqual(['0.6', '0'])
    expect(motionMs(a.scrim)).toBe(517) // the exit above it
    expect(overshoots(a.scrim)).toBe(false)
    expect(a.scroll.scrollTop).toBe(800) // snap drift self-healed on the way back
  })

  it('the deck rides the presentation curve on open and the departure one on close', () => {
    // 507 and 517 are close enough that a duration assertion alone would not tell
    // the two curves apart.
    vi.useFakeTimers()
    core.open({title: 'A'})
    const a = els()
    stubOffsetTop(a.panel, 800)

    core.open({title: 'B'})
    expect(motionMs(a.scrim)).toBe(507) // the entrance above it
    expect(easingOf(a.scrim)).toBe(ENTER_EASE)
    expect(motionOf(a.scrim)!.frames.map((f) => f['opacity'])).toEqual(['0', '0.6'])

    core.getSnapshot()[1]!.handle.close()
    expect(easingOf(a.scrim)).toBe(EXIT_EASE)
    expect(motionOf(a.scrim)!.frames.map((f) => f['opacity'])).toEqual(['0.6', '0'])
  })

  it('a promoted sheet closing inside its own promotion window keeps the exit timing', () => {
    // The promotion arms motions on the sheet below plus a timer to disarm them,
    // and a close inside that window has to take both registers back.
    vi.useFakeTimers()
    core.open({title: 'A'})
    const a = els()
    stubOffsetTop(a.panel, 800)
    core.open({title: 'B'})

    core.getSnapshot()[1]!.handle.close() // B: promotes A on the exit pair
    expect(motionMs(a.scrim)).toBe(517)

    vi.advanceTimersByTime(100) // and 300ms before the disarm, close A too
    core.getSnapshot()[0]!.handle.close()
    expect(motionMs(a.backdrop)).toBe(517)
    expect(overshoots(a.backdrop)).toBe(false)
    expect(a.backdrop.style.opacity).toBe('0')

    // The moment the dead promotion timer would have fired.
    vi.advanceTimersByTime(280)
    expect(motionMs(a.backdrop)).toBe(517)
    expect(overshoots(a.backdrop)).toBe(false)
  })

  it("a covered sheet's scroll frames never write the dim back inline", () => {
    // A resize clamps a covered sheet's scrollTop, which fires scroll; the
    // register belongs to the role sync while covered.
    core.open({title: 'A'})
    const a = els()
    stubOffsetTop(a.panel, 800)
    core.open({title: 'B'})

    a.scroll.scrollTop = 400
    a.scroll.dispatchEvent(new Event('scroll'))
    expect(a.backdrop.style.opacity).toBe('1') // pinned, not progress-scaled
  })

  it('a breakpoint crossing is a no-op while covered, and still works on top', () => {
    // Geometry under content-visibility is not trustworthy and the dim belongs to
    // CSS while covered. Promotion re-parks the snap position.
    core.open({title: 'A'})
    const a = els()
    stubOffsetTop(a.panel, 800)
    core.open({title: 'B'})
    const top = el<HTMLElement>('dialog.sv-sheet:last-of-type')

    mm.setMobile(false)
    mm.setMobile(true)
    expect(a.backdrop.style.opacity).toBe('1') // the page dim it already held
    expect(a.scroll.scrollTop).toBe(0)

    // A stacked top sheet's dim is the scrim on the card beneath it, never a
    // second full-viewport dim.
    expect(top.querySelector<HTMLElement>('.sv-sheet__backdrop')!.style.opacity).toBe(
      '',
    )
    expect(a.scrim.style.opacity).toBe('0.6')
  })

  it('update({closeDisabled}) on a covered sheet does not re-arm the drag lock', () => {
    // lockDrag writes both scrollTop and an inline dim opacity.
    core.open({title: 'A'})
    const a = els()
    settleOpen(a.scroll, a.panel) // latch openDone, or syncDragLock never gets there
    const handle = core.getSnapshot()[0]!.handle
    core.open({title: 'B'})

    handle.update({closeDisabled: true})
    expect(a.backdrop.style.opacity).toBe('1') // untouched, still the page dim
    expect(a.scroll.style.overflowY).toBe('') // still unfrozen, re-locks on promotion
  })

  const stubWidth = (el: HTMLElement, px: number): void => {
    Object.defineProperty(el, 'offsetWidth', {configurable: true, get: () => px})
  }
  const stack3 = (): {cards: HTMLElement[]; top: HTMLElement} => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    const cards = [...document.querySelectorAll<HTMLElement>('.sv-sheet__card')]
    stubWidth(cards[0]!, 402)
    stubWidth(cards[1]!, 402)
    core.open({title: 'C'})
    const scrolls = [...document.querySelectorAll<HTMLElement>('.sv-sheet__scroll')]
    const panels = [...document.querySelectorAll<HTMLElement>('.sv-sheet__panel')]
    settleOpen(scrolls[2]!, panels[2]!)
    return {cards, top: scrolls[2]!}
  }

  it('drag frames pose the covered and buried cards as functions of the top card', () => {
    const {cards, top} = stack3()

    top.scrollTop = 400 // progress 0.5
    top.dispatchEvent(new Event('scroll'))

    // Covered (B, nested): the whole pose on the reveal curve, f(0.5) ≈ 0.586,
    // so the peek nudge and the scale both trail the finger's 0.5.
    expect(cards[1]!.style.transform).toMatch(/^translateY\(-5\.85/)
    expect(cards[1]!.style.transform).toMatch(/scale\(0\.95/)
    // Buried (A, bottom): receded scale frozen, a linear slide between its
    // stations (+10px at rest behind the top card, 0 at the covered station).
    expect(cards[0]!.style.transform).toBe(
      'translateY(5px) scale(0.9203980099502488)',
    )

    // A role flip retakes the registers: raw pose cleared, the journey armed on
    // the event's own pair, the CSS pose the destination.
    core.getSnapshot()[2]!.handle.close()
    expect(cards[1]!.style.transform).toBe('')
    expect(overshoots(cards[1]!)).toBe(false)
    expect(overshoots(cards[0]!)).toBe(false)
  })

  it('a drag-commit promotes the deck from the pose the drag left it in', () => {
    const {cards, top} = stack3()
    const scrims = [...document.querySelectorAll<HTMLElement>('.sv-sheet__scrim')]

    top.dispatchEvent(new Event('touchstart'))
    top.scrollTop = 300 // progress 0.375, below the midpoint, so it dismisses
    top.dispatchEvent(new Event('scroll'))
    const posedB = cards[1]!.style.transform
    const posedA = cards[0]!.style.transform
    const dimmedB = scrims[1]!.style.opacity
    expect(posedB).toMatch(/scale\(0\.9/)
    expect(dimmedB).not.toBe('0.6')

    top.dispatchEvent(new Event('touchend'))
    expect(core.getSnapshot()[2]!.isClosing).toBe(true)
    // Every journey starts at the value on screen the frame before.
    expect(motionRange(cards[1]!, 'transform')![0]).toBe(posedB)
    expect(motionRange(cards[0]!, 'transform')![0]).toBe(posedA)
    expect(motionRange(scrims[1]!, 'opacity')![0]).toBe(dimmedB)
  })

  it('the measured card width decides the recede inset: 16px narrow, 20px wide', () => {
    core.open({title: 'A'})
    const card = el<HTMLElement>('.sv-sheet__card')
    stubWidth(card, 440) // wide device → 20px inset → 1 − 40/440
    core.open({title: 'B'})
    const covered = el<HTMLElement>('dialog.sv-sheet')
    expect(covered.style.getPropertyValue('--_sheet-recede-scale')).toBe(
      String(1 - 40 / 440),
    )
  })

  it('reduced motion drops the pose drive and keeps the linear dim drive', () => {
    mm.setReducedMotion(true)
    const {cards, top} = stack3()

    top.scrollTop = 400
    top.dispatchEvent(new Event('scroll'))

    expect(cards[1]!.style.transform).toBe('') // no pose under reduced motion
    // The dim still tracks linearly on the covered card's scrim (0.5 × 0.6, the
    // under-top fraction of the dim colour); no backdrop is touched.
    const scrims = [...document.querySelectorAll<HTMLElement>('.sv-sheet__scrim')]
    expect(scrims[1]!.style.opacity).toBe('0.3')
    const backdrops = [...document.querySelectorAll<HTMLElement>('.sv-sheet__backdrop')]
    expect(backdrops[2]!.style.opacity).toBe('')
  })

  it('crossing into mobile lands at the open snap point, crossing out hands the dim to CSS', () => {
    mm.setMobile(false) // opened on desktop
    core.open({title: 'A', content: () => 'body'})
    const scroll = el<HTMLElement>('.sv-sheet__scroll')
    const backdrop = el<HTMLElement>('.sv-sheet__backdrop')
    stubOffsetTop(el<HTMLElement>('.sv-sheet__panel'), 800)

    // A fresh snap container sits at scrollTop 0, which is closed: an invisible
    // modal holding the page.
    mm.setMobile(true)
    expect(scroll.scrollTop).toBe(800)
    expect(backdrop.style.opacity).toBe('1')

    mm.setMobile(false)
    expect(backdrop.style.opacity).toBe('')
  })
})
