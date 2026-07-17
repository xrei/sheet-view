import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {SheetHost} from '../src/react/SheetHost'
import {createSheets} from '../src/react/sheets'
import type {SheetPublicHandle, SheetReactProps, Sheets} from '../src/react/sheets'

// Resolves the dialog's accessible name from either aria-label or aria-labelledby
// so assertions survive the #11 switch from label to labelledby.
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

// Focus-trap, inert background, and focus restoration are provided natively by
// <dialog>.showModal() (verified in the browser example — jsdom stubs showModal
// and cannot emulate focus). These tests cover the accessibility contract the
// library itself owns: a real dialog element, an accessible name, a keyboard-
// operable close affordance, and keyboard (Escape) dismissal.
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

  it('renders a native <dialog> (source of focus-trap / inert / Escape)', () => {
    open({title: 'A', content: () => <p>Body</p>})
    const el = dialog()
    expect(el).toBeInstanceOf(HTMLDialogElement)
  })

  it('labels the dialog by its visible title via aria-labelledby', () => {
    open({title: 'Settings', content: () => <p>Body</p>})
    const dlg = dialog()!
    const h2 = document.querySelector('[data-sheet-part="title"]') as HTMLElement
    expect(h2.id).toBeTruthy()
    expect(dlg).toHaveAttribute('aria-labelledby', h2.id)
    expect(dlg).not.toHaveAttribute('aria-label') // labelledby, not a dup label
    expect(accessibleName(dlg)).toBe('Settings')
  })

  it('an explicit ariaLabel overrides the title for the accessible name', () => {
    open({title: 'Settings', ariaLabel: 'Account settings', content: () => <p>Body</p>})
    expect(dialog()).toHaveAttribute('aria-label', 'Account settings')
    expect(dialog()).not.toHaveAttribute('aria-labelledby')
  })

  it('warns in dev when a sheet is opened with no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    open({content: () => <p>Body</p>}) // no title, no ariaLabel
    expect(warn).toHaveBeenCalledTimes(1)
    expect(accessibleName(dialog()!)).toBe('')
    warn.mockRestore()
  })

  it('the close affordance is a real, labelled, keyboard-operable button', () => {
    open({title: 'A', content: () => <p>Body</p>})
    const close = screen.getByLabelText('Close')
    expect(close.tagName).toBe('BUTTON')
    expect(close).toHaveAttribute('type', 'button')
  })

  it('a disabled-close dead-end marks the button aria-disabled', () => {
    open({title: 'A', content: () => <p>Body</p>, closeDisabled: true})
    expect(screen.getByLabelText('Close')).toHaveAttribute('aria-disabled', 'true')
  })

  it('Escape (native cancel) requests close for keyboard users', () => {
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
})
