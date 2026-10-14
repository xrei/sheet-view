import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {render} from '@testing-library/react'
import {createPortal} from 'react-dom'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'

// What iCloud Passwords injects in desktop Chrome: a bare div straight on <body>,
// armoured with inline !important, shown as a manual popover. Attributes, never
// properties: an injected node carries no own property the page can see.
const ARMOUR = 'position: fixed !important; z-index: 2147483647 !important'

function inject(
  opts: {style?: string; popover?: string | null; parent?: Element} = {},
): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-test', 'foreign')
  if (opts.popover !== null) el.setAttribute('popover', opts.popover ?? 'manual')
  el.setAttribute('style', opts.style ?? ARMOUR)
  ;(opts.parent ?? document.body).appendChild(el)
  return el
}

// jsdom has no popover API, so no ToggleEvent either: the core reads `newState`
// as a plain property, and the browser's event is a task after showPopover().
function show(el: Element, newState = 'open'): void {
  el.dispatchEvent(Object.assign(new Event('toggle'), {newState}))
}

const toplayerOf = (dialog: HTMLDialogElement): Element =>
  dialog.querySelector(':scope > [data-sheet-part="toplayer"]')!

describe('foreign top-layer overlays', () => {
  let core: SheetCore
  let moveBefore: ReturnType<typeof vi.fn>

  const dialogs = (): HTMLDialogElement[] => [
    ...document.querySelectorAll<HTMLDialogElement>('dialog[data-sheet-part="root"]'),
  ]
  const top = (): HTMLDialogElement => dialogs().at(-1)!

  beforeEach(() => {
    // jsdom has no moveBefore. insertBefore stands in: what the real one adds
    // (the popover stays open, the iframe keeps its document) jsdom cannot show.
    moveBefore = vi.fn(function (this: Element, node: Node, child: Node | null) {
      this.insertBefore(node, child)
    })
    Object.defineProperty(Element.prototype, 'moveBefore', {
      configurable: true,
      writable: true,
      value: moveBefore,
    })
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    delete (Element.prototype as unknown as Record<string, unknown>)['moveBefore']
    for (const el of document.querySelectorAll('[data-test="foreign"]')) el.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('moves an injected overlay into the sheet, before the toplayer', () => {
    core.open({title: 'A'})
    const host = inject()
    show(host)

    const dialog = top()
    expect(host.parentNode).toBe(dialog)
    expect(dialog.lastElementChild).toBe(toplayerOf(dialog))
    expect(host.nextElementSibling).toBe(toplayerOf(dialog))
    expect(moveBefore).toHaveBeenCalledOnce()
  })

  it('counts !important written through setProperty', () => {
    core.open({title: 'A'})
    const host = inject({style: ''})
    host.style.setProperty('z-index', '2147483647', 'important')
    show(host)

    expect(host.parentNode).toBe(top())
  })

  it.each<[string, (el: HTMLElement) => void, {popover?: string | null; style?: string}]>([
    ['an enumerable expando', (el) => Object.assign(el, {__reactFiber$x: {}}), {}],
    [
      'a non-enumerable expando',
      (el) => Object.defineProperty(el, '__vnode', {value: {}, enumerable: false}),
      {},
    ],
    ['no !important', () => {}, {style: 'position: fixed; z-index: 2147483647'}],
    ['popover="auto"', () => {}, {popover: 'auto'}],
    ['no popover attribute', () => {}, {popover: null}],
    ['a data-sheet-part', (el) => el.setAttribute('data-sheet-part', 'x'), {}],
  ])('leaves a page popover with %s on <body>', (_, tweak, opts) => {
    core.open({title: 'A'})
    const host = inject(opts)
    tweak(host)
    show(host)

    expect(host.parentNode).toBe(document.body)
    expect(moveBefore).not.toHaveBeenCalled()
  })

  it('leaves a popover nested in page markup, and ignores a closing toggle', () => {
    core.open({title: 'A'})
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-test', 'foreign')
    document.body.appendChild(wrapper)
    const nested = inject({parent: wrapper})
    show(nested)
    const hidden = inject()
    show(hidden, 'closed')

    expect(nested.parentNode).toBe(wrapper)
    expect(hidden.parentNode).toBe(document.body)
    expect(moveBefore).not.toHaveBeenCalled()
  })

  // Moving a node a renderer owns breaks its unmount, which removes the child
  // from the parent it remembers. Its bookkeeping on the node is what tells it
  // apart: this one is otherwise shaped exactly like an injected overlay.
  it('never moves a node a renderer portaled to <body>', () => {
    core.open({title: 'A'})
    const {unmount} = render(
      createPortal(
        <div
          popover="manual"
          data-test="foreign"
          ref={(el) => el?.setAttribute('style', ARMOUR)}
        />,
        document.body,
      ),
    )
    const node = document.body.querySelector<HTMLElement>(
      ':scope > [data-test="foreign"]',
    )!
    show(node)

    expect(node.parentNode).toBe(document.body)
    expect(() => unmount()).not.toThrow()
  })

  it('does nothing while no sheet is open, nor after the last one closed', () => {
    const before = inject()
    show(before)
    expect(before.parentNode).toBe(document.body)

    vi.useFakeTimers()
    core.open({title: 'A'}).close()
    vi.advanceTimersByTime(600)
    const after = inject()
    show(after)

    expect(after.parentNode).toBe(document.body)
    expect(moveBefore).not.toHaveBeenCalled()
  })

  it('does nothing without moveBefore: appendChild would hide the popover', () => {
    delete (Element.prototype as unknown as Record<string, unknown>)['moveBefore']
    const append = vi.spyOn(Element.prototype, 'appendChild')
    core.open({title: 'A'})
    append.mockClear()
    const host = inject()
    append.mockClear()
    show(host)

    expect(host.parentNode).toBe(document.body)
    expect(append).not.toHaveBeenCalled()
  })

  it('survives a moveBefore that throws, leaving the overlay in place', () => {
    moveBefore.mockImplementation(() => {
      throw new DOMException('nope', 'HierarchyRequestError')
    })
    core.open({title: 'A'})
    const host = inject()

    expect(() => show(host)).not.toThrow()
    expect(host.parentNode).toBe(document.body)
  })

  // The dialog being torn down is still open when the overlays leave it, so a
  // "topmost open sheet" scan that does not skip it would pick it and lose the
  // overlay with the dialog.
  it('returns the overlay to <body> when its only sheet closes', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const host = inject()
    show(host)
    expect(host.parentNode).toBe(top())

    handle.close()
    vi.advanceTimersByTime(600)

    expect(host.isConnected).toBe(true)
    expect(host.parentNode).toBe(document.body)
  })

  it('goes to the top sheet, then down the stack as sheets close', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const b = core.open({title: 'B'})
    const [lower, upper] = dialogs()
    const host = inject()
    show(host)
    expect(host.parentNode).toBe(upper)

    b.close()
    vi.advanceTimersByTime(600)
    expect(host.parentNode).toBe(lower)
    expect(host.nextElementSibling).toBe(toplayerOf(lower!))

    core.closeAll()
    vi.advanceTimersByTime(600)
    expect(host.parentNode).toBe(document.body)
  })

  it('lands in a closing sheet, which is still the blocking modal, then moves down', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const b = core.open({title: 'B'})
    const [lower, upper] = dialogs()
    b.close()
    const host = inject()
    show(host)
    expect(host.parentNode).toBe(upper)

    vi.advanceTimersByTime(600)
    expect(host.parentNode).toBe(lower)
  })

  it('leaves a natively closed sheet at once', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const host = inject()
    show(host)

    // The shim dispatches `close` synchronously, as a <form method="dialog">
    // submit would a task later.
    top().close()
    expect(host.parentNode).toBe(document.body)

    vi.advanceTimersByTime(0)
    expect(host.isConnected).toBe(true)
    expect(dialogs()).toHaveLength(0)
  })

  it('closeAll() hands the overlay back to <body>', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    core.open({title: 'B'})
    const host = inject()
    show(host)

    core.closeAll()
    vi.advanceTimersByTime(600)

    expect(host.parentNode).toBe(document.body)
    expect(dialogs()).toHaveLength(0)
  })

  it('a keyed replace hands the overlay to the replacing sheet', () => {
    vi.useFakeTimers()
    core.open({key: 'k', title: 'A'})
    const host = inject()
    show(host)
    core.open({key: 'k', strategy: 'replace', title: 'B'})
    const replacing = top()

    vi.advanceTimersByTime(600)

    expect(dialogs()).toEqual([replacing])
    expect(host.parentNode).toBe(replacing)
  })

  it('__resetForTests() hands the overlay back and stops watching', () => {
    core.open({title: 'A'})
    const host = inject()
    show(host)

    core.__resetForTests()
    expect(host.parentNode).toBe(document.body)

    const later = inject()
    show(later)
    expect(later.parentNode).toBe(document.body)
  })

  it('takes an overlay from <html> and returns it there', () => {
    vi.useFakeTimers()
    const handle = core.open({title: 'A'})
    const host = inject({parent: document.documentElement})
    show(host)
    expect(host.parentNode).toBe(top())

    handle.close()
    vi.advanceTimersByTime(600)

    expect(host.parentNode).toBe(document.documentElement)
  })

  it('follows a re-show up to a sheet opened above it', () => {
    core.open({title: 'A'})
    const host = inject()
    show(host)
    core.open({title: 'B'})
    const [, upper] = dialogs()

    show(host)

    expect(host.parentNode).toBe(upper)
  })

  // Bitwarden and Proton Pass put their menu inside the modal dialog
  // themselves, and police where it lives.
  it('never touches UI its owner placed in the sheet itself', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const lower = top()
    const own = inject()
    lower.insertBefore(own, toplayerOf(lower))
    const b = core.open({title: 'B'})

    show(own)
    expect(own.parentNode).toBe(lower)

    b.close()
    vi.advanceTimersByTime(600)
    expect(own.parentNode).toBe(lower)
    expect(moveBefore).not.toHaveBeenCalled()
  })

  it('yields for good to an owner that takes its node back', () => {
    core.open({title: 'A'})
    const host = inject()
    show(host)
    expect(host.parentNode).toBe(top())

    document.body.appendChild(host)
    show(host)
    show(host)

    expect(host.parentNode).toBe(document.body)
    expect(moveBefore).toHaveBeenCalledOnce()
  })

  it('stops after a burst of fresh nodes, until the sheets close', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.open({title: 'A'})
    const hosts: HTMLElement[] = []
    for (let i = 0; i < 50; i++) {
      const host = inject()
      hosts.push(host)
      show(host)
    }

    const adopted = hosts.filter((h) => h.parentNode === top())
    expect(adopted).toHaveLength(20)
    expect(warn).toHaveBeenCalledOnce()

    core.__resetForTests()
    core.open({title: 'B'})
    const fresh = inject()
    show(fresh)
    expect(fresh.parentNode).toBe(top())
  })

  // A standalone CDN build next to a bundled import: two listeners, one DOM.
  it('two copies of the module adopt once between them', async () => {
    // @ts-expect-error: same file, distinct module id, which loads it twice.
    const copy = await import('../src/core/foreign?copy')
    copy.foreignOverlays.acquire()
    try {
      core.open({title: 'A'})
      const host = inject()

      expect(() => show(host)).not.toThrow()
      expect(host.parentNode).toBe(top())
      expect(moveBefore).toHaveBeenCalledOnce()
    } finally {
      copy.foreignOverlays.release()
    }
  })
})
