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

  it('open() returns a {id, close, update} handle', () => {
    const handle = sheets.open({title: 'A'})
    expect(handle).toMatchObject({
      id: expect.any(Number),
      close: expect.any(Function),
      update: expect.any(Function),
    })
  })

  it('handle.close() flips isClosing without removing immediately', () => {
    const handle = sheets.open({title: 'A'})
    handle.close()
    expect(snap()).toHaveLength(1)
    expect(snap()[0]!.isClosing).toBe(true)
  })

  it('handle.update() merges props onto the entry', () => {
    const handle = sheets.open({title: 'A', closeDisabled: false})
    handle.update({closeDisabled: true})
    expect(snap()[0]!.closeDisabled).toBe(true)
  })

  it('multiple opens get independent, unique ids', () => {
    const a = sheets.open({title: 'A'})
    const b = sheets.open({title: 'B'})
    expect(a.id).not.toBe(b.id)
    expect(snap()).toHaveLength(2)
  })

  it('closeAll() flags every open entry as closing', () => {
    sheets.open({title: 'A'})
    sheets.open({title: 'B'})
    sheets.closeAll()
    expect(snap().every((e) => e.isClosing)).toBe(true)
  })

  it('hasLocked() reflects a closeDisabled sheet', () => {
    expect(sheets.hasLocked()).toBe(false)
    const h = sheets.open({title: 'A', closeDisabled: true})
    expect(sheets.hasLocked()).toBe(true)
    h.update({closeDisabled: false})
    expect(sheets.hasLocked()).toBe(false)
  })

  it('works outside React — no hooks, callable from anywhere', () => {
    expect(() => sheets.open({title: 'A'})).not.toThrow()
    expect(snap()).toHaveLength(1)
  })

  it('keyed reuse (default) returns the same handle and does NOT update props', () => {
    const a = sheets.open({key: 'x', title: 'A', closeDisabled: false})
    const b = sheets.open({key: 'x', title: 'B', closeDisabled: true})
    expect(b).toBe(a)
    expect(snap()).toHaveLength(1)
    expect(snap()[0]!.closeDisabled).toBe(false)
  })

  it('reusing a key after full removal opens a fresh sheet', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close()
    vi.advanceTimersByTime(320)
    expect(snap()).toHaveLength(0)

    const b = sheets.open({key: 'x', title: 'A'})
    expect(b.id).not.toBe(a.id)
    expect(snap()).toHaveLength(1)
  })

  it('a mid-exit (closing) keyed entry is treated as dead — open creates a new one', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close()
    expect(byKey('x')!.isClosing).toBe(true)

    const b = sheets.open({key: 'x', title: 'A'})
    expect(b.id).not.toBe(a.id)
    // The dying entry plus the fresh one coexist until the exit animation ends.
    expect(snap()).toHaveLength(2)
  })

  it("strategy 'replace' closes the old keyed sheet and opens a new one", () => {
    const a = sheets.open({key: 'x', strategy: 'replace', title: 'A'})
    const b = sheets.open({key: 'x', strategy: 'replace', title: 'B'})
    expect(b.id).not.toBe(a.id)

    vi.advanceTimersByTime(320) // old entry's exit completes
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

  it('a late removal of a dead keyed slot does not clobber a fresh reuse', () => {
    const a = sheets.open({key: 'x', title: 'A'})
    a.close() // starts the 320ms exit; key still points at the dying entry
    const b = sheets.open({key: 'x', title: 'B'}) // dying entry is dead → fresh
    expect(b.id).not.toBe(a.id)

    // The dying entry's delayed teardown must NOT delete the key now owned by b.
    vi.advanceTimersByTime(320)
    expect(byKey('x')?.id).toBe(b.id)
    expect(sheets.open({key: 'x'})).toBe(b) // still live → reuse returns b
  })

  it('no key means no dedup — every call opens a fresh sheet', () => {
    sheets.open({title: 'A'})
    sheets.open({title: 'A'})
    expect(snap()).toHaveLength(2)
  })
})
