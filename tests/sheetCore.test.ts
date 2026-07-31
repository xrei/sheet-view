import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'

describe('createSheetCore', () => {
  let core: SheetCore
  const extraCores: SheetCore[] = []

  beforeEach(() => {
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    for (const c of extraCores) c.__resetForTests() // cleaned even if a test throws
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

  it('stacks entries in open order', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    const ids = core.getSnapshot().map((e) => e.id)
    expect(ids).toEqual([1, 2])
  })

  it('teardown parks occupied layers whole — content stays connected, in its parent', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const survivor = document.createElement('div')
    survivor.textContent = 'toast'
    handle.layers.viewport.appendChild(survivor)

    handle.close()
    vi.advanceTimersByTime(320)

    // Still connected, still a child of ITS layer — the layer node itself was
    // parked, so a foreign reconciler can still removeChild its own content.
    expect(survivor.isConnected).toBe(true)
    expect(survivor.parentElement).toBe(handle.layers.viewport)
    expect(survivor.closest('[data-sheet-part="layer-rescue"]')).not.toBeNull()
    // The empty anchored layer left with the dialog.
    expect(handle.layers.anchored.isConnected).toBe(false)

    // A claimed node (moved out by a subscriber) is left alone by the sweep…
    const claimed = survivor
    document.body.appendChild(claimed)
    vi.advanceTimersByTime(1000)
    expect(claimed.isConnected).toBe(true)
    claimed.remove()
  })

  it('the rescue sweep drops content nobody claimed (the old lifecycle)', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const abandoned = document.createElement('div')
    handle.layers.viewport.appendChild(abandoned)

    handle.close()
    vi.advanceTimersByTime(320)
    expect(abandoned.isConnected).toBe(true) // parked…

    vi.advanceTimersByTime(1000)
    expect(abandoned.isConnected).toBe(false) // …then swept, like before
    // Its parent link survived even the sweep:
    expect(abandoned.parentElement).toBe(handle.layers.viewport)
  })

  it('teardown of an empty sheet parks nothing', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    handle.close()
    vi.advanceTimersByTime(320)
    // Both layers (sentinels only) leave with the dialog — nothing to park.
    expect(handle.layers.anchored.isConnected).toBe(false)
    expect(handle.layers.viewport.isConnected).toBe(false)
  })

  it('handle.close() flips isClosing without removing immediately', () => {
    const handle = core.open({title: 'A'})
    handle.close()
    const snap = core.getSnapshot()
    expect(snap).toHaveLength(1)
    expect(snap[0]!.isClosing).toBe(true)
  })

  it('removes the entry and fires onExited after the close animation', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const handle = core.open({title: 'A', onExited})
    handle.close()

    expect(core.getSnapshot()).toHaveLength(1)
    vi.advanceTimersByTime(320)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('handle.update() merges props (closeDisabled reflected in snapshot)', () => {
    const handle = core.open({title: 'A', closeDisabled: false})
    expect(core.getSnapshot()[0]!.closeDisabled).toBe(false)

    handle.update({closeDisabled: true})
    expect(core.getSnapshot()[0]!.closeDisabled).toBe(true)
  })

  it('update() applies size and cardClassName, not only slots', () => {
    const handle = core.open({title: 'A', size: 'sm', cardClassName: 'a'})
    const card = document.querySelector('.sv-sheet__card')!
    expect(card.getAttribute('data-sheet-size')).toBe('sm')
    expect(card.classList.contains('a')).toBe(true)

    handle.update({size: 'lg', cardClassName: 'b'})
    expect(card.getAttribute('data-sheet-size')).toBe('lg')
    expect(card.classList.contains('b')).toBe(true)
    expect(card.classList.contains('a')).toBe(false) // old class removed
  })

  it('applies root className + style tokens on open and re-syncs reset-safe on update', () => {
    const handle = core.open({
      title: 'A',
      className: 'my-root',
      // `--sheet-*` custom prop (primary use) + a camelCase normal prop.
      style: {'--sheet-surface': '#f00', zIndex: '5'},
    })
    const dialog = document.querySelector('dialog.sv-sheet') as HTMLElement
    expect(dialog.classList.contains('my-root')).toBe(true)
    expect(dialog.style.getPropertyValue('--sheet-surface')).toBe('#f00')
    // camelCase is normalized to kebab so setProperty doesn't silently no-op.
    expect(dialog.style.getPropertyValue('z-index')).toBe('5')

    handle.update({className: 'other', style: {'--sheet-backdrop': '#00f'}})
    expect(dialog.classList.contains('other')).toBe(true)
    expect(dialog.classList.contains('my-root')).toBe(false) // old class removed
    expect(dialog.classList.contains('sv-sheet')).toBe(true) // base class intact
    expect(dialog.style.getPropertyValue('--sheet-backdrop')).toBe('#00f')
    expect(dialog.style.getPropertyValue('--sheet-surface')).toBe('') // old key cleared
    expect(dialog.style.getPropertyValue('z-index')).toBe('') // old key cleared
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

  it('leaves the close glyph node EMPTY by default, so CSS can paint the ×', () => {
    // The default × is `.sv-sheet__close-icon:empty::before` (asserted in
    // css-contract, which jsdom can't evaluate). What the core owes it is an
    // empty node inside the button — any stray text node here kills the fallback.
    const handle = core.open({title: 'A'})
    const btn = document.querySelector('.sv-sheet__close')!
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(glyph).toBe(handle.slots.closeIcon)
    expect(btn.contains(glyph)).toBe(true)
    expect(glyph.childNodes.length).toBe(0)
  })

  it('closeIcon fills that node, and never touches the accessible name', () => {
    const icon = document.createElement('span')
    icon.textContent = '✕'
    icon.setAttribute('data-custom-icon', '')
    core.open({title: 'B', closeIcon: icon})
    const btn = document.querySelector('.sv-sheet__close')!
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(glyph.querySelector('[data-custom-icon]')).not.toBeNull()
    expect(btn.textContent).toBe('✕')
    // aria-label (the accessible name) is unaffected by a custom glyph.
    expect(btn).toHaveAttribute('aria-label', 'Close')
  })

  it('keeps the close glyph node identical across update() — portals depend on it', () => {
    // buildDefaultHeader rebuilds the whole row on every update(). If the node
    // were created there instead of moved, an external renderer's portal would
    // keep writing into the detached previous one and the glyph would vanish.
    const handle = core.open({title: 'A'})
    const before = document.querySelector('[data-sheet-part="close-icon"]')
    handle.update({title: 'B'})
    const after = document.querySelector('[data-sheet-part="close-icon"]')
    expect(after).toBe(before)
    expect(after).toBe(handle.slots.closeIcon)
    expect(document.querySelector('.sv-sheet__close')!.contains(after!)).toBe(true)
  })

  it('warns when closeIcon has no button to fill', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.open({title: 'A', closeIcon: '✕', closeHidden: true})
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes('`closeIcon` was ignored')),
    ).toBe(true)
    warn.mockRestore()
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
    // Sibling of the <h2>, so it can't pollute the aria-labelledby name.
    expect(icon.querySelector('[data-sheet-part="title"]')).toBeNull()
  })

  it('warns when `icon` has no title to sit next to (it would render nowhere)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.open({ariaLabel: 'A', icon: '★'})
    expect(warn.mock.calls.some((c) => String(c[0]).includes('`icon` was ignored'))).toBe(
      true,
    )
    warn.mockRestore()
  })

  it('a vanilla headerSlot + title names the dialog via aria-label', () => {
    // Same WCAG 4.1.2 hole as the React path, reachable without React: the custom
    // header means there is no title node to point aria-labelledby at, so the
    // title has to become the label rather than being dropped on the floor.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const header = document.createElement('h1')
    header.textContent = 'Filters'
    core.open({title: 'Filters', headerSlot: header})

    const dialog = document.querySelector('dialog.sv-sheet')!
    expect(dialog).toHaveAttribute('aria-label', 'Filters')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('closeLabel can be defaulted per core instance', () => {
    const de = createSheetCore({closeLabel: 'Schließen'})
    extraCores.push(de)
    de.open({title: 'A'})
    expect(document.querySelector('.sv-sheet__close')).toHaveAttribute(
      'aria-label',
      'Schließen',
    )
  })

  it('ids are monotonic and reset by __resetForTests', () => {
    expect(core.open({}).id).toBe(1)
    expect(core.open({}).id).toBe(2)
    core.__resetForTests()
    expect(core.open({}).id).toBe(1)
  })

  it('closeAll() flips isClosing on every open entry', () => {
    core.open({title: 'A'})
    core.open({title: 'B'})
    core.closeAll()
    expect(core.getSnapshot().every((e) => e.isClosing)).toBe(true)
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

  it('tuning options are honored (custom closeMs)', () => {
    vi.useFakeTimers()
    const fast = createSheetCore({closeMs: 50})
    const onExited = vi.fn()
    fast.open({title: 'A', onExited}).close()

    vi.advanceTimersByTime(49)
    expect(onExited).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onExited).toHaveBeenCalledTimes(1)
    fast.__resetForTests()
  })

  it('focusOnOpen marks the dialog with data-sheet-focus-open', () => {
    core.open({title: 'A', focusOnOpen: true})
    expect(document.querySelector('dialog.sv-sheet')).toHaveAttribute(
      'data-sheet-focus-open',
    )
  })

  it('omits data-sheet-focus-open by default', () => {
    core.open({title: 'A'})
    expect(document.querySelector('dialog.sv-sheet')).not.toHaveAttribute(
      'data-sheet-focus-open',
    )
  })

  it('a native dialog close (bypassing our path) runs full teardown', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    core.open({title: 'A', onExited})
    const dialog = document.querySelector('dialog.sv-sheet')!
    expect(
      document.documentElement.hasAttribute('data-sheet-scroll-lock'),
    ).toBe(true) // lock acquired

    // The browser closed it out from under us (<form method="dialog">, force-close).
    dialog.dispatchEvent(new Event('close'))
    vi.advanceTimersByTime(320)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(
      document.documentElement.hasAttribute('data-sheet-scroll-lock'),
    ).toBe(false) // lock released — page not frozen
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('a native close while already closing does not double-fire teardown', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const handle = core.open({title: 'A', onExited})
    handle.close()
    const dialog = document.querySelector('dialog.sv-sheet')!
    dialog.dispatchEvent(new Event('close')) // guarded: already closing

    vi.advanceTimersByTime(320)
    expect(core.getSnapshot()).toHaveLength(0)
    expect(onExited).toHaveBeenCalledTimes(1)
  })
})
