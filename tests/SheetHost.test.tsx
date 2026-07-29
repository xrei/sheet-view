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

  it('a React icon renders in the default header, before the title', () => {
    open({
      title: 'Filters',
      icon: () => <svg data-testid="glyph" />,
      content: () => <p>Body</p>,
    })
    const header = document.querySelector('.sv-sheet__default-header')!
    const icon = document.querySelector('[data-sheet-part="icon"]')!
    expect(header.firstElementChild).toBe(icon)
    expect(icon.querySelector('[data-testid="glyph"]')).not.toBeNull()
    // The whole point: an icon no longer costs you the close button.
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('the icon node keeps its identity across update() (stable portal container)', () => {
    // Load-bearing. mountSlots rebuilds the default header on EVERY update(), so
    // if the icon node is ever created inside buildDefaultHeader instead of being
    // moved into it, React's portal container silently detaches and the icon
    // vanishes on the first update() — with no error anywhere. Do not "simplify"
    // the node back into the header builder.
    const handle = open({
      title: 'A',
      icon: () => <span>★</span>,
      content: () => <p>Body</p>,
    })
    const before = document.querySelector('[data-sheet-part="icon"]')

    act(() => {
      handle.update({title: 'B'})
    })

    expect(document.querySelector('[data-sheet-part="icon"]')).toBe(before)
    expect(screen.getByText('★')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('icon is ignored when headerSlot takes over the row', () => {
    open({
      title: 'A',
      icon: () => <span>★</span>,
      headerSlot: () => <h1>Custom header</h1>,
      content: () => <p>Body</p>,
    })
    expect(screen.queryByText('★')).toBeNull()
    expect(screen.getByText('Custom header')).toBeInTheDocument()
  })

  it('a JSX closeIcon fills the close button and keeps the whole default header', () => {
    // The gap this closes: a JSX close glyph used to force headerSlot, which costs
    // the button's label, its aria-disabled state and its 44×44 hit target.
    open({
      title: 'Filters',
      closeIcon: () => <svg data-testid="x-glyph" />,
      content: () => <p>Body</p>,
    })
    const btn = screen.getByLabelText('Close')
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(btn.contains(glyph)).toBe(true)
    expect(glyph.querySelector('[data-testid="x-glyph"]')).not.toBeNull()
    // Everything else in the row survives — that is the point of not using headerSlot.
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(document.querySelector('[data-sheet-part="default-header"]')).not.toBeNull()
  })

  it('the close glyph node keeps its identity across update()', () => {
    // Same load-bearing invariant as the icon node above: the header row is rebuilt
    // on every update(), so this node must be MOVED into it, never created there.
    const handle = open({
      title: 'A',
      closeIcon: () => <span>✕</span>,
      content: () => <p>Body</p>,
    })
    const before = document.querySelector('[data-sheet-part="close-icon"]')

    act(() => {
      handle.update({title: 'B'})
    })

    expect(document.querySelector('[data-sheet-part="close-icon"]')).toBe(before)
    expect(screen.getByText('✕')).toBeInTheDocument()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('closeIcon is ignored when headerSlot takes over the row', () => {
    open({
      title: 'A',
      closeIcon: () => <span>✕</span>,
      headerSlot: () => <h1>Custom header</h1>,
      content: () => <p>Body</p>,
    })
    expect(screen.queryByText('✕')).toBeNull()
    expect(screen.getByText('Custom header')).toBeInTheDocument()
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
