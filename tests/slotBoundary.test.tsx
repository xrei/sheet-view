import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {act, render, screen} from '@testing-library/react'

import {SheetHost} from '../src/react/SheetHost'
import {createSheets} from '../src/react/sheets'
import type {SheetReactProps, Sheets} from '../src/react/sheets'

function Boom(): never {
  throw new Error('boom')
}

// React logs a caught error to console.error itself, on top of the library's own.
let errorSpy: ReturnType<typeof vi.spyOn>

describe('slot error containment', () => {
  let sheets: Sheets

  function open(props: SheetReactProps): void {
    act(() => {
      sheets.open(props)
    })
  }

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sheets = createSheets()
    render(
      <>
        <span>app chrome</span>
        <SheetHost instance={sheets} />
      </>,
    )
  })

  afterEach(() => {
    sheets.__resetForTests()
    errorSpy.mockRestore()
  })

  it('a throwing content slot leaves the app, the sheet and its close button mounted', () => {
    // 'app chrome' is a sibling of <SheetHost> at the app root: it goes with the
    // whole tree if the throw escapes.
    open({title: 'Filters', content: () => <Boom />})

    expect(screen.getByText('app chrome')).toBeInTheDocument()
    expect(document.querySelector('dialog.sv-sheet')).not.toBeNull()
    expect(document.querySelector('.sv-sheet__default-header')).not.toBeNull()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
    expect(document.querySelector('[data-sheet-part="content"]')!.textContent).toBe('')
  })

  it('a throwing slot factory is caught, like a throwing child component', () => {
    // The factory runs inside SlotRender, a child of the boundary.
    open({
      title: 'A',
      content: () => {
        throw new Error('factory boom')
      },
    })

    expect(screen.getByText('app chrome')).toBeInTheDocument()
    expect(document.querySelector('dialog.sv-sheet')).not.toBeNull()
  })

  it('a throwing footer leaves the content mounted', () => {
    open({
      title: 'A',
      content: () => <p>Body survives</p>,
      footer: () => <Boom />,
    })

    expect(screen.getByText('Body survives')).toBeInTheDocument()
    expect(document.querySelector('[data-sheet-part="footer"]')!.textContent).toBe('')
  })

  it('names the failed slot on console.error', () => {
    open({title: 'A', content: () => <Boom />})

    const ours = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes('[sheet-view]'),
    )
    expect(ours).toBeDefined()
    expect(String(ours![0])).toContain('"content" slot threw')
  })

  it('hands the error and the slot name to onSlotError', () => {
    const onSlotError = vi.fn()
    sheets.__resetForTests()
    sheets = createSheets()
    render(<SheetHost instance={sheets} onSlotError={onSlotError} />)

    open({title: 'A', content: () => <Boom />})

    expect(onSlotError).toHaveBeenCalledTimes(1)
    expect(onSlotError.mock.calls[0]![0]).toBeInstanceOf(Error)
    expect(onSlotError.mock.calls[0]![2]).toBe('content')
  })

  it('a later sheet gets a fresh boundary', () => {
    open({title: 'A', content: () => <Boom />})
    expect(document.querySelector('[data-sheet-part="content"]')!.textContent).toBe('')

    open({title: 'B', content: () => <p>Fine</p>})
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })
})
