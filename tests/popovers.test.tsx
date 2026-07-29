import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'

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
      const wrapper = part('viewport-layer').firstElementChild as HTMLElement
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
