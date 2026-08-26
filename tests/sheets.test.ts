import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheets} from '../src/react/sheets'
import type {Sheets} from '../src/react/sheets'

describe('sheets (imperative facade)', () => {
  let sheets: Sheets
  const snap = () => sheets.__host.getSnapshot()
  const byKey = (key: string) => snap().find((e) => e.key === key)

  beforeEach(() => {
    vi.useFakeTimers()
    sheets = createSheets()
  })

  afterEach(() => {
    sheets.__resetForTests()
    vi.useRealTimers()
  })

  it('hasLocked() is true while any open sheet has closeDisabled', () => {
    expect(sheets.hasLocked()).toBe(false)
    const h = sheets.open({title: 'A', closeDisabled: true})
    expect(sheets.hasLocked()).toBe(true)
    h.update({closeDisabled: false})
    expect(sheets.hasLocked()).toBe(false)
  })

  it('keyed reuse is the default: same handle, props left as they were', () => {
    const a = sheets.open({key: 'x', title: 'A', closeDisabled: false})
    const b = sheets.open({key: 'x', title: 'B', closeDisabled: true})
    expect(b).toBe(a)
    expect(snap()).toHaveLength(1)
    expect(snap()[0]!.closeDisabled).toBe(false)
  })

  it('reusing a key after full removal opens a fresh sheet', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close()
    vi.advanceTimersByTime(600)
    expect(snap()).toHaveLength(0)

    const b = sheets.open({key: 'x', title: 'A'})
    expect(b.id).not.toBe(a.id)
    expect(snap()).toHaveLength(1)
  })

  it('a closing keyed entry is dead: open() creates a new sheet beside it', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close()
    expect(byKey('x')!.isClosing).toBe(true)

    const b = sheets.open({key: 'x', title: 'A'})
    expect(b.id).not.toBe(a.id)
    // The dying entry and the fresh one coexist until the exit animation ends.
    expect(snap()).toHaveLength(2)
  })

  it("strategy 'replace' closes the sheet holding the key and opens a new one", () => {
    const a = sheets.open({key: 'x', strategy: 'replace', title: 'A'})
    const b = sheets.open({key: 'x', strategy: 'replace', title: 'B'})
    expect(b.id).not.toBe(a.id)

    vi.advanceTimersByTime(600)
    expect(snap()).toHaveLength(1)
    expect(byKey('x')!.id).toBe(b.id)
    expect(byKey('x')!.isClosing).toBe(false)
  })

  it("strategy 'update' merges props and returns the same handle", () => {
    const a = sheets.open({key: 'x', title: 'A', closeDisabled: false})
    const b = sheets.open({key: 'x', strategy: 'update', closeDisabled: true})
    expect(b).toBe(a)
    expect(snap()).toHaveLength(1)
    expect(snap()[0]!.closeDisabled).toBe(true)
  })

  it('different keys are independent', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    const b = sheets.open({key: 'y', title: 'B'})
    expect(a.id).not.toBe(b.id)
    expect(snap()).toHaveLength(2)
  })

  it('the teardown of a dying entry leaves a key that a newer sheet owns alone', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close() // the key still points at the dying entry
    const b = sheets.open({key: 'x', title: 'B'})
    expect(b.id).not.toBe(a.id)

    vi.advanceTimersByTime(600)
    expect(byKey('x')?.id).toBe(b.id)
    expect(sheets.open({key: 'x'})).toBe(b)
  })

  it('without a key every open() creates a fresh sheet', () => {
    sheets.open({title: 'A'})
    sheets.open({title: 'A'})
    expect(snap()).toHaveLength(2)
  })
})
