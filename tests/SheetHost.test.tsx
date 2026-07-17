import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'

import {SheetHost} from '../src/react/SheetHost'
import {createSheets} from '../src/react/sheets'
import type {SheetPublicHandle, SheetReactProps, Sheets} from '../src/react/sheets'

const dialog = () => document.querySelector('dialog.sv-sheet')

describe('SheetHost', () => {
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

  it('renders the default header title, body content, and close button', () => {
    open({title: 'My title', content: () => <p>Body text</p>})
    expect(screen.getByText('My title')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('renders nothing when no sheet is open', () => {
    expect(dialog()).toBeNull()
  })

  it('close button fires onClose', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape (dialog cancel) fires onClose', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    fireEvent(dialog()!, new Event('cancel', {cancelable: true}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop press + click (outside the card) fires onClose', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    fireEvent.pointerDown(dialog()!)
    fireEvent.click(dialog()!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('press inside the card does not close', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    const body = screen.getByText('Body')
    fireEvent.pointerDown(body)
    fireEvent.click(body)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a press that starts inside the card never dismisses, even if the click lands outside', () => {
    // Reproduces the "Clear/More" bug: a content button re-renders and detaches
    // before the click bubbles to the dialog, so the click target is outside
    // the card. Deciding at pointerdown (press started inside) prevents the
    // spurious dismiss.
    const onClose = vi.fn()
    open({
      title: 'A',
      content: () => <button type="button">Clear</button>,
      onClose,
    })
    fireEvent.pointerDown(screen.getByText('Clear'))
    fireEvent.click(dialog()!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closeDisabled blocks the close button and Escape, firing onCloseAttempt', () => {
    const onClose = vi.fn()
    const onCloseAttempt = vi.fn()
    open({
      title: 'A',
      content: () => <p>Body</p>,
      closeDisabled: true,
      onClose,
      onCloseAttempt,
    })

    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent(dialog()!, new Event('cancel', {cancelable: true}))

    expect(onClose).not.toHaveBeenCalled()
    expect(onCloseAttempt).toHaveBeenCalledTimes(2)
  })

  it('closeHidden omits the X entirely (forced sheet), keeping the title', () => {
    open({title: 'Log in', content: () => <p>Body</p>, closeHidden: true})
    expect(screen.getByText('Log in')).toBeInTheDocument()
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('renders a footer slot', () => {
    open({
      title: 'A',
      content: () => <p>Body</p>,
      footer: () => <button type="button">Apply</button>,
    })
    expect(screen.getByText('Apply')).toBeInTheDocument()
  })

  it('a custom headerSlot replaces the default header', () => {
    open({
      ariaLabel: 'Custom sheet',
      headerSlot: () => <h1>Custom header</h1>,
      content: () => <p>Body</p>,
    })
    expect(screen.getByText('Custom header')).toBeInTheDocument()
    expect(document.querySelector('.sv-sheet__default-header')).toBeNull()
  })

  it('content receives a {close} ctx it can call', () => {
    const onClose = vi.fn()
    open({
      title: 'A',
      onClose,
      content: ({close}) => (
        <button type="button" onClick={close}>
          Done
        </button>
      ),
    })
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handle.update patches closeDisabled live', () => {
    const onClose = vi.fn()
    const onCloseAttempt = vi.fn()
    const handle = open({
      title: 'A',
      content: () => <p>Body</p>,
      onClose,
      onCloseAttempt,
    })

    act(() => handle.update({closeDisabled: true}))
    fireEvent.click(screen.getByLabelText('Close'))

    expect(onClose).not.toHaveBeenCalled()
    expect(onCloseAttempt).toHaveBeenCalledTimes(1)
  })
})
