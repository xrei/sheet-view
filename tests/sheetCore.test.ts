import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {mockMatchMedia, motionMs, motionRange} from './helpers'

describe('createSheetCore', () => {
  let core: SheetCore
  const extraCores: SheetCore[] = []

  beforeEach(() => {
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    for (const c of extraCores) c.__resetForTests()
    extraCores.length = 0
    vi.useRealTimers()
  })

  it('open() appends an entry and returns a handle', () => {
    const handle = core.open({title: 'A'})
    const snap = core.getSnapshot()

    expect(snap).toHaveLength(1)
    expect(typeof snap[0]!.id).toBe('number')
    expect(snap[0]!.isClosing).toBe(false)
    expect(handle).toMatchObject({
      id: expect.any(Number),
      close: expect.any(Function),
      update: expect.any(Function),
    })
  })

  it('teardown parks an occupied layer whole, content still inside it', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const survivor = document.createElement('div')
    survivor.textContent = 'toast'
    handle.layers.viewport.appendChild(survivor)

    handle.close()
    vi.advanceTimersByTime(600)

    // The layer node moved, not its children, so a foreign reconciler can still
    // removeChild what it rendered.
    expect(survivor.isConnected).toBe(true)
    expect(survivor.parentElement).toBe(handle.layers.viewport)
    expect(survivor.closest('[data-sheet-part="layer-rescue"]')).not.toBeNull()
    // An empty layer is not parked, it leaves with the dialog.
    expect(handle.layers.anchored.isConnected).toBe(false)

    vi.advanceTimersByTime(1000) // let the sweep run, so nothing outlives the test
  })

  it('the sweep drops a parked layer after the grace period, sparing claimed nodes', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const abandoned = document.createElement('div')
    const claimed = document.createElement('div')
    handle.layers.viewport.append(abandoned, claimed)

    handle.close()
    vi.advanceTimersByTime(600)
    expect(abandoned.isConnected).toBe(true)

    document.body.appendChild(claimed) // its owner re-homed it
    vi.advanceTimersByTime(1000)

    expect(abandoned.isConnected).toBe(false)
    expect(abandoned.parentElement).toBe(handle.layers.viewport)
    expect(claimed.isConnected).toBe(true)
    // Nothing left parked, so the receiver leaves the host's <body> too.
    expect(document.querySelector('[data-sheet-part="layer-rescue"]')).toBeNull()
    claimed.remove()
  })

  it('removes the entry and fires onExited after the close animation', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const handle = core.open({title: 'A', onExited})
    handle.close()

    expect(core.getSnapshot()).toHaveLength(1)
    vi.advanceTimersByTime(600)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('update() applies size and cardClassName', () => {
    const handle = core.open({title: 'A', size: 'sm', cardClassName: 'a'})
    const card = document.querySelector('.sv-sheet__card')!
    expect(card.getAttribute('data-sheet-size')).toBe('sm')
    expect(card.classList.contains('a')).toBe(true)

    handle.update({size: 'lg', cardClassName: 'b'})
    expect(card.getAttribute('data-sheet-size')).toBe('lg')
    expect(card.classList.contains('b')).toBe(true)
    expect(card.classList.contains('a')).toBe(false)
  })

  it('applies className and style on open, and update() clears the keys it replaces', () => {
    const handle = core.open({
      title: 'A',
      className: 'my-root',
      style: {'--sheet-surface': '#f00', zIndex: '5'},
    })
    const dialog = document.querySelector('dialog.sv-sheet') as HTMLElement
    expect(dialog.classList.contains('my-root')).toBe(true)
    expect(dialog.style.getPropertyValue('--sheet-surface')).toBe('#f00')
    // camelCase is normalized to kebab, setProperty silently no-ops otherwise.
    expect(dialog.style.getPropertyValue('z-index')).toBe('5')

    handle.update({className: 'other', style: {'--sheet-backdrop': '#00f'}})
    expect(dialog.classList.contains('other')).toBe(true)
    expect(dialog.classList.contains('my-root')).toBe(false)
    expect(dialog.classList.contains('sv-sheet')).toBe(true)
    expect(dialog.style.getPropertyValue('--sheet-backdrop')).toBe('#00f')
    expect(dialog.style.getPropertyValue('--sheet-surface')).toBe('')
    expect(dialog.style.getPropertyValue('z-index')).toBe('')
  })

  it('closeLabel defaults to "Close" and is overridable per sheet', () => {
    core.open({title: 'A'})
    expect(document.querySelector('.sv-sheet__close')).toHaveAttribute(
      'aria-label',
      'Close',
    )
    core.__resetForTests()
    core.open({title: 'B', closeLabel: 'Fermer'})
    expect(document.querySelector('.sv-sheet__close')).toHaveAttribute(
      'aria-label',
      'Fermer',
    )
  })

  it('leaves the close glyph node empty, inside the button', () => {
    // The default × is painted by `.sv-sheet__close-icon:empty::before`, so any
    // stray text node in that span kills it.
    const handle = core.open({title: 'A'})
    const btn = document.querySelector('.sv-sheet__close')!
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(glyph).toBe(handle.slots.closeIcon)
    expect(btn.contains(glyph)).toBe(true)
    expect(glyph.childNodes.length).toBe(0)
  })

  it('closeIcon fills that node and leaves the accessible name alone', () => {
    const icon = document.createElement('span')
    icon.textContent = '✕'
    icon.setAttribute('data-custom-icon', '')
    core.open({title: 'B', closeIcon: icon})
    const btn = document.querySelector('.sv-sheet__close')!
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(glyph.querySelector('[data-custom-icon]')).not.toBeNull()
    expect(btn.textContent).toBe('✕')
    expect(btn).toHaveAttribute('aria-label', 'Close')
  })

  it('the icon slot renders before the title and keeps the close button', () => {
    const glyph = document.createElement('i')
    glyph.setAttribute('data-glyph', '')
    core.open({title: 'A', icon: glyph})

    const header = document.querySelector('.sv-sheet__default-header')!
    const icon = document.querySelector('[data-sheet-part="icon"]')!
    expect(header.firstElementChild).toBe(icon)
    expect(icon.querySelector('[data-glyph]')).not.toBeNull()
    expect(document.querySelector('.sv-sheet__close')).not.toBeNull()
    // A sibling of the <h2>, so it cannot leak into the aria-labelledby name.
    expect(icon.querySelector('[data-sheet-part="title"]')).toBeNull()
  })

  it('notifies subscribers on open and close', () => {
    const listener = vi.fn()
    const unsubscribe = core.subscribe(listener)

    const handle = core.open({title: 'A'})
    expect(listener).toHaveBeenCalled()

    listener.mockClear()
    handle.close()
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })

  it('closeMs sets the delay between close() and onExited', () => {
    vi.useFakeTimers()
    const fast = createSheetCore({closeMs: 50})
    extraCores.push(fast)
    const onExited = vi.fn()
    fast.open({title: 'A', onExited}).close()

    vi.advanceTimersByTime(49)
    expect(onExited).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('focusOnOpen marks the dialog with data-sheet-focus-open', () => {
    core.open({title: 'A', focusOnOpen: true})
    expect(document.querySelector('dialog.sv-sheet')).toHaveAttribute(
      'data-sheet-focus-open',
    )
  })

  it('a native dialog close runs the full teardown and releases the scroll lock', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    core.open({title: 'A', onExited})
    const dialog = document.querySelector('dialog.sv-sheet')!
    expect(
      document.documentElement.hasAttribute('data-sheet-scroll-lock'),
    ).toBe(true)

    // What a <form method="dialog"> submit or a UA force-close looks like.
    dialog.dispatchEvent(new Event('close'))
    vi.advanceTimersByTime(600)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(
      document.documentElement.hasAttribute('data-sheet-scroll-lock'),
    ).toBe(false)
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  const roles = (): Array<string | null> =>
    [...document.querySelectorAll('dialog.sv-sheet')].map((d) =>
      d.getAttribute('data-sheet-stack'),
    )
  const recedes = (): boolean[] =>
    [...document.querySelectorAll('dialog.sv-sheet')].map((d) =>
      d.hasAttribute('data-sheet-recede'),
    )

  it('assigns top / covered / buried / hidden roles as the stack grows', () => {
    core.open({title: 'A'})
    expect(roles()).toEqual([null])
    core.open({title: 'B'})
    expect(roles()).toEqual(['covered', null])
    core.open({title: 'C'})
    expect(roles()).toEqual(['buried', 'covered', null])
    core.open({title: 'D'})
    expect(roles()).toEqual(['hidden', 'buried', 'covered', null])
    core.open({title: 'E'})
    expect(roles()).toEqual(['hidden', 'hidden', 'buried', 'covered', null])
  })

  it('marks sheets opened over a live sheet as nested, permanently', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    const dialogs = (): HTMLElement[] => [
      ...document.querySelectorAll<HTMLElement>('dialog.sv-sheet'),
    ]
    expect(dialogs().map((d) => d.hasAttribute('data-sheet-nested'))).toEqual([
      false,
      true,
    ])
    // Promotion back to top does not clear it: the geometry it carries is fixed
    // at open.
    core.getSnapshot()[1]!.handle.close()
    expect(dialogs()[1]!.hasAttribute('data-sheet-nested')).toBe(true)
  })

  // A card recedes iff a full-height sheet (lg/xl) is above it AND it is either
  // full-height itself or sits directly on a receding full-height card.
  // Bottom of the stack first.
  it.each([
    {sizes: ['lg', 'lg'], expected: [true, false]},
    {sizes: ['lg', 'md'], expected: [false, false]},
    {sizes: ['md', 'lg'], expected: [false, false]},
    {sizes: ['md', 'md'], expected: [false, false]},
    {sizes: ['lg', 'md', 'lg'], expected: [true, true, false]}, // md rides along
    {sizes: ['md', 'lg', 'lg'], expected: [false, true, false]},
    {sizes: ['md', 'md', 'lg'], expected: [false, false, false]},
    {sizes: ['lg', 'lg', 'md'], expected: [true, false, false]},
    {sizes: ['lg', 'xl'], expected: [true, false]}, // xl is full-height too
    {sizes: ['sm', 'lg'], expected: [false, false]},
    {sizes: ['lg', 'lg', 'lg', 'lg'], expected: [true, true, true, false]},
  ] as Array<{sizes: Array<'sm' | 'md' | 'lg' | 'xl'>; expected: boolean[]}>)(
    'recede matrix: $sizes → $expected',
    ({sizes, expected}) => {
      for (const size of sizes) core.open({title: size, size})
      expect(recedes()).toEqual(expected)
    },
  )

  it.each([
    {
      sizes: ['lg', 'md', 'lg'],
      stations: ['covered', 'covered', null],
      receding: [true, true, false],
    },
    {
      sizes: ['lg', 'md', 'md', 'lg'],
      stations: ['covered', 'covered', 'covered', null],
      receding: [true, true, false, false],
    },
  ] as Array<{
    sizes: Array<'sm' | 'md' | 'lg' | 'xl'>
    stations: Array<string | null>
    receding: boolean[]
  }>)(
    'a station counts the full-height sheets above a card, not its index: $sizes → $stations',
    ({sizes, stations, receding}) => {
      for (const size of sizes) core.open({title: size, size})
      expect(roles()).toEqual(stations)
      expect(recedes()).toEqual(receding)
    },
  )

  it('a receding card writes its measured scale, and a rider sinks to its anchor', () => {
    const stub = (el: HTMLElement, w: number, h: number): void => {
      Object.defineProperty(el, 'offsetWidth', {configurable: true, get: () => w})
      Object.defineProperty(el, 'offsetHeight', {configurable: true, get: () => h})
    }
    // Mobile only: a centred desktop card holds no pose, so nothing is measured.
    const mm = mockMatchMedia({mobile: true})
    try {
      const mobileCore = createSheetCore()
      extraCores.push(mobileCore)
      mobileCore.open({title: 'A', size: 'lg'})
      mobileCore.open({title: 'B', size: 'md'})
      const cards = [...document.querySelectorAll<HTMLElement>('.sv-sheet__card')]
      stub(cards[0]!, 402, 760)
      stub(cards[1]!, 402, 520)
      mobileCore.open({title: 'C', size: 'lg'})

      const dialogs = [...document.querySelectorAll<HTMLElement>('dialog.sv-sheet')]
      const scale = 1 - 32 / 402 // 16px inset each side at 402px wide
      expect(dialogs[0]!.style.getPropertyValue('--_sheet-recede-scale')).toBe(
        String(scale),
      )
      // Every card at a station shares one bottom edge, so the shorter md sinks
      // past the anchor's constant by (anchorHeight - ownHeight) * (1 - scale).
      expect(dialogs[0]!.style.getPropertyValue('--_sheet-stack-ty')).toBe('0px')
      const ty = -(760 - 520) * (1 - scale)
      expect(dialogs[1]!.style.getPropertyValue('--_sheet-stack-ty')).toBe(`${ty}px`)
    } finally {
      mm.restore()
    }
  })

  it('a role flip takes every measurement before it writes anything', () => {
    // Reading offsetWidth flushes style and layout. A flush between a flip and
    // the animation carrying it lands in the first frames as a stutter.
    const mm = mockMatchMedia({mobile: true})
    const mobileCore = createSheetCore()
    extraCores.push(mobileCore)
    mobileCore.open({title: 'A'})
    const dialog = document.querySelector<HTMLElement>('dialog.sv-sheet')!
    const card = dialog.querySelector<HTMLElement>('.sv-sheet__card')!

    // The two registers a flip writes, sampled at the moment it measures.
    let atMeasure: {attr: string | null; pose: string} | null = null
    Object.defineProperty(card, 'offsetWidth', {
      configurable: true,
      get: () => {
        atMeasure ??= {
          attr: dialog.getAttribute('data-sheet-stack'),
          pose: dialog.style.getPropertyValue('--_sheet-recede-scale'),
        }
        return 402
      },
    })

    try {
      mobileCore.open({title: 'B'})
      expect(atMeasure).toEqual({attr: null, pose: ''})
      // The animation carries its own start value, so nothing has to be flushed
      // to make it run.
      expect(dialog.getAttribute('data-sheet-stack')).toBe('covered')
      expect(motionMs(card)).toBe(507)
      const [from, to] = motionRange(card, 'transform')!
      expect(from).toContain('scale(1)')
      expect(to).toContain('scale(0.920')
    } finally {
      mm.restore()
    }
  })

  it('desktop holds no pose: the stack is marked by the role and the dim alone', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    const covered = document.querySelector<HTMLElement>('dialog.sv-sheet')!
    expect(covered.dataset['sheetStack']).toBe('covered')
    expect('sheetRecede' in covered.dataset).toBe(true)
    expect(covered.style.getPropertyValue('--_sheet-recede-scale')).toBe('')
    expect(covered.style.getPropertyValue('--_sheet-stack-ty')).toBe('')
    expect(covered.querySelector<HTMLElement>('.sv-sheet__scrim')!.style.opacity).toBe(
      '0.6',
    )
  })

  it('dims: one page backdrop on the bottom sheet, 0.6 / 0.8 scrims above it', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    core.open({title: 'C'})
    const scrims = [...document.querySelectorAll<HTMLElement>('.sv-sheet__scrim')]
    const backdrops = [
      ...document.querySelectorAll<HTMLElement>('.sv-sheet__backdrop'),
    ]
    expect(scrims.map((s) => s.style.opacity)).toEqual(['0.8', '0.6', ''])
    // Desktop rests the page dim on CSS, so no backdrop carries an inline value.
    expect(backdrops.map((b) => b.style.opacity)).toEqual(['', '', ''])
    core.open({title: 'D'})
    const scrims4 = [...document.querySelectorAll<HTMLElement>('.sv-sheet__scrim')]
    expect(scrims4.map((s) => s.style.opacity)).toEqual(['0.8', '0.8', '0.6', ''])
  })

  it('the page dim stays on the bottom sheet once that sheet is hidden', () => {
    for (const title of ['A', 'B', 'C', 'D', 'E']) core.open({title})
    const dialogs = [...document.querySelectorAll<HTMLElement>('dialog.sv-sheet')]
    expect(dialogs.map((d) => d.dataset['sheetStack'] ?? null)).toEqual([
      'hidden',
      'hidden',
      'buried',
      'covered',
      null,
    ])
    expect(core.getSnapshot()).toHaveLength(5)
    const backdrops = [...document.querySelectorAll<HTMLElement>('.sv-sheet__backdrop')]
    expect(backdrops[0]!.closest('dialog')!.dataset['sheetStack']).toBe('hidden')
    // 'hidden' hides the CARD, not the dialog, so its backdrop still paints.
    expect(dialogs[0]!.style.visibility).toBe('')
  })

  it('closing the bottom sheet hands the page dim to the new bottom-most sheet', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    core.open({title: 'B'})
    const backdrops = [
      ...document.querySelectorAll<HTMLElement>('.sv-sheet__backdrop'),
    ]

    core.getSnapshot()[0]!.handle.close()
    // A nested sheet's backdrop rests transparent in CSS, so the page dim it
    // inherits has to be written inline.
    expect(backdrops[1]!.style.opacity).toBe('1')
    // Desktop fades it from base.css, so the core runs no animation of its own.
    expect(motionRange(backdrops[1]!, 'opacity')).toBeUndefined()
  })

  it("update({size}) re-walks the recede: shrinking the top to 'md' releases the card below", () => {
    core.open({title: 'A'})
    const top = core.open({title: 'B'})
    expect(recedes()).toEqual([true, false])

    top.update({size: 'md'})
    expect(recedes()).toEqual([false, false])
    expect(roles()).toEqual(['covered', null]) // still covered, only the pose goes

    top.update({size: 'lg'})
    expect(recedes()).toEqual([true, false])
  })

  it('closing the top promotes the one below synchronously, before the exit paints', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    core.open({title: 'B'})
    core.open({title: 'C'})

    core.getSnapshot()[2]!.handle.close()
    // The closing sheet keeps its role for the whole exit, so the two dims
    // cross-fade.
    expect(roles()).toEqual(['covered', null, null])

    vi.advanceTimersByTime(600)
    expect(roles()).toEqual(['covered', null])
  })

  it('closing a middle sheet leaves it covered and promotes the one below it', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    core.open({title: 'B'})
    core.open({title: 'C'})

    core.getSnapshot()[1]!.handle.close()
    expect(roles()).toEqual(['covered', 'covered', null])

    vi.advanceTimersByTime(600)
    expect(roles()).toEqual(['covered', null])
  })

  it('closeAll freezes every sheet in its pre-close role', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    core.open({title: 'C'})
    core.closeAll()
    // A promotion here would fade a dim in under sheets that are all leaving.
    expect(roles()).toEqual(['buried', 'covered', null])
  })

  it("strategy 'replace' keeps the sheet below covered for the whole swap", () => {
    core.open({title: 'A'})
    core.open({title: 'B', key: 'k'})
    expect(roles()).toEqual(['covered', null])

    core.open({title: 'C', key: 'k', strategy: 'replace'})
    // A is demoted again in the same tick it is promoted, so no frame paints it
    // uncovered.
    expect(roles()).toEqual(['covered', null, null])
  })

  it('a native close promotes the sheet below it too', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    core.open({title: 'B'})
    expect(roles()).toEqual(['covered', null])

    const dialogs = document.querySelectorAll('dialog.sv-sheet')
    dialogs[1]!.dispatchEvent(new Event('close'))
    expect(roles()).toEqual([null, null])

    vi.advanceTimersByTime(600)
    expect(roles()).toEqual([null])
  })

  it('demotion gives the inline page dim back to CSS', () => {
    // Specificity cannot beat an inline style, so the ladder rules in base.css
    // only work once the core drops the register. (Mobile drives it per frame;
    // the inline write here stands in for that.)
    core.open({title: 'A'})
    const backdrop = document.querySelector<HTMLElement>('.sv-sheet__backdrop')!
    backdrop.style.opacity = '1'

    core.open({title: 'B'})
    expect(backdrop.style.opacity).toBe('')
  })

  it('a native close while already closing does not double-fire teardown', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const handle = core.open({title: 'A', onExited})
    handle.close()
    const dialog = document.querySelector('dialog.sv-sheet')!
    dialog.dispatchEvent(new Event('close'))

    vi.advanceTimersByTime(600)
    expect(core.getSnapshot()).toHaveLength(0)
    expect(onExited).toHaveBeenCalledTimes(1)
  })
})
