import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {createPortal} from 'react-dom'

import {SheetHost} from '../src/react/SheetHost'
import {SheetPortal} from '../src/react/SheetPortal'
import {createSheets} from '../src/react/sheets'
import type {SheetPublicHandle, SheetReactProps, Sheets} from '../src/react/sheets'
import {useSheetLayout} from '../src/react/useSheetLayout'

const dialog = (): HTMLDialogElement =>
  document.querySelector('dialog.sv-sheet') as HTMLDialogElement
const part = (name: string): HTMLElement =>
  document.querySelector(`[data-sheet-part="${name}"]`) as HTMLElement

// A press + release on the same node, the way a real dismiss happens.
const press = (el: Element): void => {
  fireEvent.pointerDown(el)
  fireEvent.click(el)
}

describe('popovers inside a sheet', () => {
  let sheets: Sheets

  function open(props: SheetReactProps): SheetPublicHandle {
    let handle!: SheetPublicHandle
    act(() => {
      handle = sheets.open(props)
    })
    return handle
  }

  beforeEach(() => {
    sheets = createSheets()
    render(<SheetHost instance={sheets} />)
  })

  afterEach(() => {
    sheets.__resetForTests()
  })

  describe('dismiss surfaces', () => {
    // The five structurally-empty nodes. Everything else in the dialog is either
    // the card or app content, and must not dismiss.
    for (const name of ['backdrop', 'scroll', 'spacer', 'panel']) {
      it(`a press on the ${name} dismisses`, () => {
        const onClose = vi.fn()
        open({title: 'A', content: () => <p>Body</p>, onClose})
        press(part(name))
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    }

    it('a press on the dialog itself dismisses (native ::backdrop retargets here)', () => {
      const onClose = vi.fn()
      open({title: 'A', content: () => <p>Body</p>, onClose})
      press(dialog())
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('a dismiss press still routes through closeDisabled', () => {
      const onClose = vi.fn()
      const onCloseAttempt = vi.fn()
      open({
        title: 'A',
        content: () => <p>Body</p>,
        closeDisabled: true,
        onClose,
        onCloseAttempt,
      })
      press(part('panel'))
      expect(onCloseAttempt).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('app-authored panels never dismiss the sheet', () => {
    it('clicking a panel in the anchor layer keeps the sheet open', () => {
      // The bug this whole feature exists for: a dropdown option used to satisfy
      // `!card.contains(target)` and tear the sheet down on selection.
      const onClose = vi.fn()
      open({
        title: 'A',
        onClose,
        content: () => (
          <SheetPortal>
            <button type="button">Option</button>
          </SheetPortal>
        ),
      })
      press(screen.getByText('Option'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('clicking a panel in the viewport layer keeps the sheet open', () => {
      const onClose = vi.fn()
      open({
        title: 'A',
        onClose,
        content: () => (
          <SheetPortal layer="viewport">
            <button type="button">Toast action</button>
          </SheetPortal>
        ),
      })
      press(screen.getByText('Toast action'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('a press that starts on a panel never dismisses, even if the click lands elsewhere', () => {
      // A menu that unmounts itself on selection detaches the click target, so the
      // click surfaces on the dialog. Deciding at pointerdown is what saves it.
      const onClose = vi.fn()
      open({
        title: 'A',
        onClose,
        content: () => (
          <SheetPortal>
            <button type="button">Option</button>
          </SheetPortal>
        ),
      })
      fireEvent.pointerDown(screen.getByText('Option'))
      fireEvent.click(dialog())
      expect(onClose).not.toHaveBeenCalled()
    })

    it('a stale press does not leak into a later click', () => {
      const onClose = vi.fn()
      open({title: 'A', content: () => <p>Body</p>, onClose})
      press(part('panel'))
      expect(onClose).toHaveBeenCalledTimes(1)

      // No pointerdown before this one — it must not reuse the previous verdict.
      fireEvent.click(dialog())
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('a cancelled press does not dismiss via a later keyboard click', () => {
      const onClose = vi.fn()
      open({title: 'A', content: () => <p>Body</p>, onClose})

      // A touch the browser takes over as a scroll: pointerdown on a dismiss
      // surface, then pointercancel — and never a click of its own.
      fireEvent.pointerDown(part('panel'))
      fireEvent.pointerCancel(part('panel'))

      // The next click arrives with NO pointerdown (a keyboard activation) and
      // must not inherit the dead press's verdict.
      fireEvent.click(dialog())
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('<SheetPortal>', () => {
    it('mounts into the layer named by `layer`', () => {
      open({
        title: 'A',
        content: () => (
          <>
            <SheetPortal>
              <span>anchored child</span>
            </SheetPortal>
            <SheetPortal layer="viewport">
              <span>viewport child</span>
            </SheetPortal>
          </>
        ),
      })
      expect(part('anchor-layer').textContent).toBe('anchored child')
      expect(part('viewport-layer').textContent).toBe('viewport child')
    })

    it('wraps children in a boxless, click-armed wrapper', () => {
      // display:contents is what stops the wrapper swallowing backdrop-dismiss and
      // drag-to-close, while pointer-events still reaches the children.
      open({
        title: 'A',
        content: () => (
          <SheetPortal layer="viewport">
            <span>child</span>
          </SheetPortal>
        ),
      })
      // :not(sentinel) — the layer's first element child is its permanent sentinel.
      const wrapper = part('viewport-layer').querySelector(
        ':scope > :not([data-sheet-part="layer-sentinel"])',
      ) as HTMLElement
      expect(wrapper.style.display).toBe('contents')
      expect(wrapper.style.pointerEvents).toBe('auto')
    })

    it('unmounts once the sheet starts closing', () => {
      const handle = open({
        title: 'A',
        content: () => (
          <SheetPortal>
            <span>panel</span>
          </SheetPortal>
        ),
      })
      expect(screen.getByText('panel')).toBeInTheDocument()

      act(() => {
        handle.close()
      })
      expect(screen.queryByText('panel')).toBeNull()
    })

    it('keepOnClose holds it through the exit, for an exit-animated toast', () => {
      const handle = open({
        title: 'A',
        content: () => (
          <SheetPortal layer="viewport" keepOnClose>
            <span>toast</span>
          </SheetPortal>
        ),
      })
      act(() => {
        handle.close()
      })
      expect(screen.getByText('toast')).toBeInTheDocument()
    })

    it('owns one stable host — a sheet opening over a live toast and closing never remounts it', () => {
      // The old wiring portaled straight into the layer node, so every target
      // change (sheet opens over the toast, sheet closes from under it) changed
      // createPortal's container and React rebuilt the subtree — a live toast
      // replayed its entrance twice per sheet.
      vi.useFakeTimers()
      render(
        <SheetPortal layer="viewport" instance={sheets}>
          <span>page toast</span>
        </SheetPortal>,
      )
      const toast = screen.getByText('page toast')
      const host = toast.parentElement!
      expect(host.parentElement).toBe(document.body)
      expect(host.style.display).toBe('contents')

      const handle = open({title: 'A'})
      // Same nodes, MOVED into the sheet's top layer — not a portal remount.
      expect(screen.getByText('page toast')).toBe(toast)
      expect(toast.parentElement).toBe(host)
      expect(host.parentElement).toBe(part('viewport-layer'))

      act(() => handle.close())
      act(() => {
        vi.advanceTimersByTime(320)
      })

      // Back on the page, still the same nodes, connected the whole way:
      // teardown parked the occupied layer (host inside) in the receiver, and
      // the target flip moved the host home from there — no detour through
      // detached DOM.
      expect(screen.getByText('page toast')).toBe(toast)
      expect(toast.parentElement).toBe(host)
      expect(host.isConnected).toBe(true)
      expect(host.closest('dialog')).toBeNull()
      expect(host.parentElement).toBe(document.body)

      // Run the rescue sweep so the parked layer doesn't leak into later tests.
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      vi.useRealTimers()
    })

    it('a React portal straight into the layer node survives teardown', () => {
      // The layer node is that portal's container. Teardown parks the occupied
      // layer WHOLE, so React's commit-phase container.removeChild(child) —
      // which no error boundary catches — always finds the child in place.
      vi.useFakeTimers()
      const handle = open({title: 'A'})
      const layer = part('viewport-layer')
      const direct = render(<>{createPortal(<div>direct child</div>, layer)}</>)
      const child = screen.getByText('direct child')

      act(() => handle.close())
      act(() => {
        vi.advanceTimersByTime(320)
      })
      expect(child.isConnected).toBe(true)
      expect(child.parentElement).toBe(layer)

      // Even after the sweep drops the unclaimed layer, the pair stays intact —
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(child.parentElement).toBe(layer)
      // — so React's own unmount (the old crash site) still works.
      expect(() => direct.unmount()).not.toThrow()
      vi.useRealTimers()
    })

    it('falls back to document.body when no sheet is open', () => {
      render(
        <SheetPortal layer="viewport">
          <span>homeless</span>
        </SheetPortal>,
      )
      const node = screen.getByText('homeless')
      expect(node).toBeInTheDocument()
      expect(document.querySelector('dialog.sv-sheet')).toBeNull()
    })

    it('warns when an anchored panel has no sheet to anchor to', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(
        <SheetPortal>
          <span>orphan</span>
        </SheetPortal>,
      )
      expect(warn).toHaveBeenCalled()
      expect(String(warn.mock.calls[0]?.[0])).toContain('anchored')
      warn.mockRestore()
    })
  })

  // Third-party portal libs treat a container they were handed as their own:
  // Headless UI deletes it once it has no children, then re-hangs the
  // disconnected node off <body> — outside the top-layer <dialog>, where the
  // browser paints it under the sheet and its dim. The sentinel starves the
  // "empty ⇒ delete" heuristic; the MutationObserver guard re-seats anything
  // that gets moved, removed, or cleared regardless of which library did it.
  describe('layer self-healing (adopted-container portal libs)', () => {
    // jsdom delivers MutationObserver callbacks as microtasks; one macrotask
    // hop is enough to flush them.
    const flushMO = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

    it('each layer carries a permanent invisible sentinel, so it never looks empty', () => {
      open({title: 'A'})
      for (const name of ['anchor-layer', 'viewport-layer']) {
        const sentinel = part(name).querySelector<HTMLElement>(
          ':scope > [data-sheet-part="layer-sentinel"]',
        )
        expect(sentinel).not.toBeNull()
        expect(sentinel!.style.display).toBe('none') // inline — no stylesheet needed
        expect(sentinel!.getAttribute('aria-hidden')).toBe('true')
      }
    })

    it('a layer exiled to <body> is re-seated into the card, content and all', async () => {
      open({
        title: 'A',
        content: () => (
          <SheetPortal>
            <button type="button">Option</button>
          </SheetPortal>
        ),
      })
      const layer = part('anchor-layer')
      document.body.appendChild(layer) // what Headless UI does to an adopted container
      await flushMO()
      expect(layer.parentElement).toBe(part('card'))
      expect(part('card').lastElementChild).toBe(layer) // back in its paint slot
      expect(screen.getByText('Option')).toBeInTheDocument()
    })

    it('a removed viewport layer is re-seated into the top layer', async () => {
      open({title: 'A'})
      const layer = part('viewport-layer')
      layer.remove()
      await flushMO()
      expect(layer.parentElement).toBe(part('toplayer'))
    })

    it('a cleared layer gets its sentinel back', async () => {
      open({title: 'A'})
      const layer = part('anchor-layer')
      layer.replaceChildren()
      await flushMO()
      expect(
        layer.querySelector(':scope > [data-sheet-part="layer-sentinel"]'),
      ).not.toBeNull()
    })

    it('the guard disconnects with the sheet — no repair after teardown', async () => {
      vi.useFakeTimers()
      const handle = open({title: 'A'})
      const layer = part('anchor-layer')
      act(() => {
        handle.close()
      })
      act(() => {
        vi.advanceTimersByTime(320)
      })
      vi.useRealTimers()
      document.body.appendChild(layer)
      await flushMO()
      expect(layer.parentElement).toBe(document.body)
      layer.remove()
    })
  })

  describe('useSheetLayout()', () => {
    it('hands slot content the nodes it needs to position against', () => {
      let seen: ReturnType<typeof useSheetLayout> = null
      function Probe(): null {
        seen = useSheetLayout()
        return null
      }
      open({title: 'A', content: () => <Probe />})

      expect(seen).not.toBeNull()
      expect(seen!.card).toBe(part('card'))
      expect(seen!.scroll).toBe(part('scroll'))
      expect(seen!.content).toBe(part('content'))
      expect(seen!.layers.anchored).toBe(part('anchor-layer'))
      expect(seen!.layers.viewport).toBe(part('viewport-layer'))
      expect(seen!.phase).toBe('settled')
      expect(seen!.isClosing).toBe(false)
    })

    it('is null outside a sheet', () => {
      let seen: ReturnType<typeof useSheetLayout> | 'unset' = 'unset'
      function Probe(): null {
        seen = useSheetLayout()
        return null
      }
      render(<Probe />)
      expect(seen).toBeNull()
    })
  })
})
