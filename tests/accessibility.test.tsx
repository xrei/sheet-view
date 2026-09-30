import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {SheetHost} from '../src/react/SheetHost'
import {createSheets} from '../src/react/sheets'
import type {SheetPublicHandle, SheetReactProps, Sheets} from '../src/react/sheets'

const accessibleName = (el: HTMLElement): string => {
  const ref = el.getAttribute('aria-labelledby')
  if (ref) {
    return ref
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
  }
  return el.getAttribute('aria-label') ?? ''
}

// Focus trap, inert background and focus restoration come from
// <dialog>.showModal(), which jsdom only stubs. What is pinned here is the part
// the library owns: the element, its accessible name, the close affordance and
// Escape dismissal.
const dialog = () => document.querySelector('dialog.sv-sheet') as HTMLDialogElement | null

describe('accessibility', () => {
  let sheets: Sheets

  function open(props: SheetReactProps): void {
    act(() => {
      sheets.open(props)
    })
  }

  beforeEach(() => {
    sheets = createSheets()
    render(<SheetHost instance={sheets} />)
  })

  afterEach(() => {
    sheets.__resetForTests()
  })

  it('renders a native <dialog>', () => {
    open({title: 'A', content: () => <p>Body</p>})
    expect(dialog()).toBeInstanceOf(HTMLDialogElement)
  })

  it('labels the dialog by its visible title via aria-labelledby', () => {
    open({title: 'Settings', content: () => <p>Body</p>})
    const dlg = dialog()!
    const h2 = document.querySelector('[data-sheet-part="title"]') as HTMLElement
    expect(h2.id).toBeTruthy()
    expect(dlg).toHaveAttribute('aria-labelledby', h2.id)
    expect(dlg).not.toHaveAttribute('aria-label')
    expect(accessibleName(dlg)).toBe('Settings')
  })

  it('an explicit ariaLabel names the dialog instead of the title', () => {
    open({title: 'Settings', ariaLabel: 'Account settings', content: () => <p>Body</p>})
    expect(dialog()).toHaveAttribute('aria-label', 'Account settings')
    expect(dialog()).not.toHaveAttribute('aria-labelledby')
  })

  it('warns when a sheet opens with no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    open({content: () => <p>Body</p>})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(accessibleName(dialog()!)).toBe('')
    warn.mockRestore()
  })

  it('the close affordance is a real, labelled button', () => {
    open({title: 'A', content: () => <p>Body</p>})
    const close = screen.getByLabelText('Close')
    expect(close.tagName).toBe('BUTTON')
    expect(close).toHaveAttribute('type', 'button')
  })

  it('closeDisabled marks the close button aria-disabled', () => {
    open({title: 'A', content: () => <p>Body</p>, closeDisabled: true})
    expect(screen.getByLabelText('Close')).toHaveAttribute('aria-disabled', 'true')
  })

  it('a native cancel event (Escape) fires onClose', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    fireEvent(dialog()!, new Event('cancel', {cancelable: true}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('update() re-syncs the accessible name when the title changes', () => {
    let handle!: SheetPublicHandle
    act(() => {
      handle = sheets.open({title: 'A', content: () => <p>Body</p>})
    })
    expect(accessibleName(dialog()!)).toBe('A')

    act(() => {
      handle.update({title: 'B'})
    })
    expect(accessibleName(dialog()!)).toBe('B')
  })

  it('a custom headerSlot with a title names the dialog via aria-label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    open({
      title: 'Filters',
      headerSlot: () => <h1>Filters</h1>,
      content: () => <p>Body</p>,
    })
    const dlg = dialog()!
    expect(dlg).toHaveAttribute('aria-label', 'Filters')
    expect(dlg).not.toHaveAttribute('aria-labelledby')
    expect(accessibleName(dlg)).toBe('Filters')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('update() to a headerSlot keeps the name and renders no second header', () => {
    let handle!: SheetPublicHandle
    act(() => {
      handle = sheets.open({title: 'Original', content: () => <p>Body</p>})
    })
    act(() => {
      handle.update({headerSlot: () => <h1>Custom header</h1>})
    })

    expect(document.querySelectorAll('.sv-sheet__default-header')).toHaveLength(0)
    expect(screen.getByText('Custom header')).toBeInTheDocument()
    expect(accessibleName(dialog()!)).toBe('Original')
  })

  // jsdom's showModal() focuses nothing, so activeElement is body at the point
  // where the core places initial focus: the same landing a real browser gives
  // when it picks the snap scroller.
  describe('initial focus', () => {
    it('lands on the first tabbable in the card, the close button', () => {
      open({title: 'A', content: () => <p>Body</p>})
      expect(document.activeElement).toBe(screen.getByLabelText('Close'))
    })

    it('rests on the named dialog itself when nothing is tabbable', () => {
      open({title: 'A', closeHidden: true, content: () => <p>Body</p>})
      expect(dialog()).toHaveAttribute('tabindex', '-1')
      expect(document.activeElement).toBe(dialog())
    })

    it('skips a disabled control and a hidden subtree', () => {
      open({
        title: 'A',
        closeHidden: true,
        content: () => (
          <>
            <button disabled>Off</button>
            <div hidden>
              <button>Hidden</button>
            </div>
          </>
        ),
      })
      expect(document.activeElement).toBe(dialog())
    })

    it('does not fight autofocus', () => {
      open({
        title: 'A',
        focusOnOpen: true,
        content: () => <input aria-label="Email" autoFocus />,
      })
      expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    })

    it('moves off the snap scroller when the browser lands there', () => {
      const showModal = vi
        .spyOn(HTMLDialogElement.prototype, 'showModal')
        .mockImplementation(function (this: HTMLDialogElement) {
          this.setAttribute('open', '')
          const scroll = this.querySelector<HTMLElement>('.sv-sheet__scroll')!
          scroll.tabIndex = -1
          scroll.focus()
          expect(document.activeElement).toBe(scroll)
        })
      open({title: 'A', content: () => <p>Body</p>})
      expect(showModal).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(screen.getByLabelText('Close'))
      showModal.mockRestore()
    })

    it('update() that rebuilds the header keeps focus on the new close button', () => {
      let handle!: SheetPublicHandle
      act(() => {
        handle = sheets.open({title: 'A', content: () => <p>Body</p>})
      })
      const before = screen.getByLabelText('Close')
      expect(document.activeElement).toBe(before)
      act(() => {
        handle.update({title: 'B'})
      })
      const after = screen.getByLabelText('Close')
      expect(after).not.toBe(before)
      expect(document.activeElement).toBe(after)
    })
  })

  describe('keyboard scrolling', () => {
    const keydown = (target: Element, key: string): boolean => {
      const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})
      target.dispatchEvent(event)
      return event.defaultPrevented
    }

    it('scroll keys on the snap scroller and the dialog root are swallowed', () => {
      open({title: 'A', content: () => <p>Body</p>})
      const scroll = document.querySelector('.sv-sheet__scroll')!
      for (const key of ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']) {
        expect(keydown(scroll, key)).toBe(true)
        expect(keydown(dialog()!, key)).toBe(true)
      }
      expect(keydown(scroll, 'Tab')).toBe(false)
      expect(keydown(scroll, 'Escape')).toBe(false)
    })

    it('the same keys aimed at content pass through', () => {
      open({title: 'A', content: () => <input aria-label="Field" />})
      const field = screen.getByLabelText('Field')
      expect(keydown(field, 'Home')).toBe(false)
      expect(keydown(field, ' ')).toBe(false)
      expect(keydown(document.querySelector('.sv-sheet__content')!, 'PageUp')).toBe(false)
    })
  })

  it('a keyed update() that omits headerSlot keeps the custom header and takes the new title as the name', () => {
    act(() => {
      sheets.open({
        key: 'k',
        strategy: 'update',
        headerSlot: () => <h1>Custom header</h1>,
        content: () => <p>Body</p>,
      })
    })
    act(() => {
      sheets.open({key: 'k', strategy: 'update', title: 'Later title'})
    })

    expect(document.querySelectorAll('.sv-sheet__default-header')).toHaveLength(0)
    expect(screen.getByText('Custom header')).toBeInTheDocument()
    expect(accessibleName(dialog()!)).toBe('Later title')
  })
})
