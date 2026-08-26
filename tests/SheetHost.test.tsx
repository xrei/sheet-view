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

  it('renders the default header title, body content and close button', () => {
    open({title: 'My title', content: () => <p>Body text</p>})
    expect(screen.getByText('My title')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('renders no dialog until a sheet opens', () => {
    expect(dialog()).toBeNull()
  })

  it('the close button fires onClose', () => {
    const onClose = vi.fn()
    open({title: 'A', content: () => <p>Body</p>, onClose})
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeDisabled blocks the close button and cancel, firing onCloseAttempt for each', () => {
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

  it('closeHidden drops the close button and keeps the title', () => {
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

  it('a React icon renders first in the default header, alongside the close button', () => {
    open({
      title: 'Filters',
      icon: () => <svg data-testid="glyph" />,
      content: () => <p>Body</p>,
    })
    const header = document.querySelector('.sv-sheet__default-header')!
    const icon = document.querySelector('[data-sheet-part="icon"]')!
    expect(header.firstElementChild).toBe(icon)
    expect(icon.querySelector('[data-testid="glyph"]')).not.toBeNull()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('the icon node keeps its identity across update()', () => {
    // mountSlots rebuilds the default header on every update(), so the icon node
    // is moved into it, never created there: a node created there detaches
    // React's portal container silently.
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

  it('a JSX closeIcon fills the close button and keeps the rest of the default header', () => {
    open({
      title: 'Filters',
      closeIcon: () => <svg data-testid="x-glyph" />,
      content: () => <p>Body</p>,
    })
    const btn = screen.getByLabelText('Close')
    const glyph = document.querySelector('[data-sheet-part="close-icon"]')!
    expect(btn.contains(glyph)).toBe(true)
    expect(glyph.querySelector('[data-testid="x-glyph"]')).not.toBeNull()
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(document.querySelector('[data-sheet-part="default-header"]')).not.toBeNull()
  })

  it('the close glyph node keeps its identity across update()', () => {
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

  it('the slot ctx close() fires onClose', () => {
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

  it('the slot ctx update() accepts ReactNode slots and swaps title and content', () => {
    // The ctx update is the facade's: the core resolves a ReactNode to nothing
    // and replaceChildren()s the slot empty, wiping the DOM React renders into.
    open({
      title: 'A',
      content: ({update}) => (
        <button
          onClick={() =>
            update({content: <p>Swapped body</p>, title: 'Rewritten'})
          }
        >
          Swap
        </button>
      ),
    })

    fireEvent.click(screen.getByText('Swap'))

    expect(screen.getByText('Swapped body')).toBeInTheDocument()
    expect(screen.queryByText('Swap')).toBeNull()
    expect(screen.getByText('Rewritten')).toBeInTheDocument()
  })
})
