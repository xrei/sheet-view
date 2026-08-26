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

// The dismiss verdict is taken at pointerdown, so a press is both events.
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
    // A press on the native ::backdrop retargets to the dialog element itself.
    const surfaces: Array<[string, () => Element]> = [
      ['backdrop', () => part('backdrop')],
      ['scroll', () => part('scroll')],
      ['spacer', () => part('spacer')],
      ['panel', () => part('panel')],
      ['dialog', dialog],
    ]

    for (const [name, node] of surfaces) {
      it(`a press on the ${name} dismisses`, () => {
        const onClose = vi.fn()
        open({title: 'A', content: () => <p>Body</p>, onClose})
        press(node())
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    }

    it('a dismiss press routes through closeDisabled', () => {
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
    it('a press on a panel in the anchored layer keeps the sheet open', () => {
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

    it('a press on a panel in the viewport layer keeps the sheet open', () => {
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

    it('a press that starts on a panel never dismisses, even when the click lands elsewhere', () => {
      // A menu that unmounts itself on selection detaches the click target, so
      // the click surfaces on the dialog.
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

    it('a spent press does not leak into a later click', () => {
      const onClose = vi.fn()
      open({title: 'A', content: () => <p>Body</p>, onClose})
      press(part('panel'))
      expect(onClose).toHaveBeenCalledTimes(1)

      fireEvent.click(dialog())
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('a cancelled press does not dismiss via a later keyboard click', () => {
      const onClose = vi.fn()
      open({title: 'A', content: () => <p>Body</p>, onClose})

      // A press the browser takes over as a scroll ends in pointercancel and
      // never fires a click; the click below arrives with no pointerdown of its
      // own, the way a keyboard activation does.
      fireEvent.pointerDown(part('panel'))
      fireEvent.pointerCancel(part('panel'))

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

    it('wraps children in a boxless, click-armed host', () => {
      // display:contents generates no box, so the host cannot swallow a
      // backdrop press or the drag gesture.
      open({
        title: 'A',
        content: () => (
          <SheetPortal layer="viewport">
            <span>child</span>
          </SheetPortal>
        ),
      })
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

    it('moves one stable host between page and sheet, never remounting its children', () => {
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
      expect(screen.getByText('page toast')).toBe(toast)
      expect(toast.parentElement).toBe(host)
      expect(host.parentElement).toBe(part('viewport-layer'))

      act(() => handle.close())
      act(() => {
        vi.advanceTimersByTime(600)
      })

      expect(screen.getByText('page toast')).toBe(toast)
      expect(toast.parentElement).toBe(host)
      expect(host.isConnected).toBe(true)
      expect(host.closest('dialog')).toBeNull()
      expect(host.parentElement).toBe(document.body)

      // Run the rescue sweep, so no parked layer leaks into a later test.
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      vi.useRealTimers()
    })

    it('a React portal straight into the layer node survives teardown and unmounts cleanly', () => {
      // React removes a portal child with container.removeChild(child) in the
      // commit phase, which no error boundary catches, so the child has to still
      // be inside that container.
      vi.useFakeTimers()
      const handle = open({title: 'A'})
      const layer = part('viewport-layer')
      const direct = render(<>{createPortal(<div>direct child</div>, layer)}</>)
      const child = screen.getByText('direct child')

      act(() => handle.close())
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(child.isConnected).toBe(true)
      expect(child.parentElement).toBe(layer)

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(child.parentElement).toBe(layer)
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

  // Portal libraries treat a container they are handed as their own: an empty
  // one gets deleted and re-hung off <body>, outside the top-layer <dialog>,
  // where the browser paints it under the sheet and its dim.
  describe('layer self-healing', () => {
    // jsdom delivers MutationObserver callbacks as microtasks; one macrotask hop
    // flushes them.
    const flushMO = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

    it('each layer carries a permanent invisible sentinel, so it never looks empty', () => {
      open({title: 'A'})
      for (const name of ['anchor-layer', 'viewport-layer']) {
        const sentinel = part(name).querySelector<HTMLElement>(
          ':scope > [data-sheet-part="layer-sentinel"]',
        )
        expect(sentinel).not.toBeNull()
        // Inline, so it holds with no stylesheet loaded.
        expect(sentinel!.style.display).toBe('none')
        expect(sentinel!.getAttribute('aria-hidden')).toBe('true')
      }
    })

    it('a layer moved to <body> is re-seated into the card, content and all', async () => {
      open({
        title: 'A',
        content: () => (
          <SheetPortal>
            <button type="button">Option</button>
          </SheetPortal>
        ),
      })
      const layer = part('anchor-layer')
      document.body.appendChild(layer)
      await flushMO()
      expect(layer.parentElement).toBe(part('card'))
      expect(part('card').lastElementChild).toBe(layer)
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

    it('the guard disconnects with the sheet, so a layer moved after teardown stays put', async () => {
      vi.useFakeTimers()
      const handle = open({title: 'A'})
      const layer = part('anchor-layer')
      act(() => {
        handle.close()
      })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      vi.useRealTimers()
      document.body.appendChild(layer)
      await flushMO()
      expect(layer.parentElement).toBe(document.body)
      layer.remove()
    })
  })

  describe('useSheetLayout()', () => {
    it('gives slot content the sheet nodes, its phase and its closing flag', () => {
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
  })
})
