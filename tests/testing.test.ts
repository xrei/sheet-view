import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {installDialogShim} from '../src/testing'

// tests/setup.ts installs the shim for the whole run, so the members under test
// are the shim's. Tests of the installation itself strip a member first, then
// put the prototype back.
type ProtoBag = Record<string, unknown>

function removeMembers(...keys: string[]): () => void {
  const proto = HTMLDialogElement.prototype as unknown as ProtoBag
  const saved = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  )
  for (const key of keys) delete proto[key]
  return () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(proto, key, descriptor)
      else delete proto[key]
    }
  }
}

describe('installDialogShim', () => {
  const cleanups: Array<() => void> = []

  const dialog = (): HTMLDialogElement => {
    const el = document.createElement('dialog')
    document.body.append(el)
    cleanups.push(() => el.remove())
    return el
  }

  afterEach(() => {
    for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]!()
    cleanups.length = 0
  })

  it('installs showModal/show/close on a bare jsdom dialog', () => {
    const restoreProto = removeMembers('showModal', 'show', 'close')
    const shim = installDialogShim()
    cleanups.push(restoreProto, shim.restore)

    expect([...shim.installed].sort()).toEqual(['close', 'show', 'showModal'])

    const el = dialog()
    el.showModal()
    expect(el.open).toBe(true)
    el.close()
    expect(el.open).toBe(false)
  })

  it('installs only the members that are missing', () => {
    const restoreProto = removeMembers('close')
    const shim = installDialogShim()
    cleanups.push(restoreProto, shim.restore)

    expect(shim.installed).toEqual(['close'])
    expect(typeof HTMLDialogElement.prototype.close).toBe('function')
  })

  it('leaves a fully reflecting `open` accessor alone (jsdom >= 29)', () => {
    const restoreProto = removeMembers('showModal')
    const shim = installDialogShim()
    cleanups.push(restoreProto, shim.restore)

    expect(shim.installed).not.toContain('open')
  })

  it('close() dispatches a close event', () => {
    const el = dialog()
    const onClose = vi.fn()
    el.addEventListener('close', onClose)
    el.showModal()
    el.close()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('close() on an already-closed dialog dispatches nothing', () => {
    const el = dialog()
    const onClose = vi.fn()
    el.addEventListener('close', onClose)
    el.close()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restore() puts the prototype back exactly', () => {
    const before = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'close',
    )
    const restoreProto = removeMembers('close')
    const shim = installDialogShim()
    expect(typeof HTMLDialogElement.prototype.close).toBe('function')

    shim.restore()
    expect(
      Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
    ).toBeUndefined()

    restoreProto()
    expect(
      Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
    ).toEqual(before)
  })

  describe('cancelOnEscape', () => {
    it('dispatches a cancelable cancel on the topmost open dialog, then closes it', () => {
      const shim = installDialogShim({cancelOnEscape: true})
      cleanups.push(shim.restore)

      const first = dialog()
      const second = dialog()
      first.showModal()
      second.showModal()

      const onFirst = vi.fn()
      const onSecond = vi.fn()
      first.addEventListener('cancel', onFirst)
      second.addEventListener('cancel', onSecond)

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))

      expect(onSecond).toHaveBeenCalledTimes(1)
      expect(onFirst).not.toHaveBeenCalled()
      expect(second.open).toBe(false)
      expect(first.open).toBe(true)
    })

    it('leaves the dialog open when the cancel is preventDefault()ed', () => {
      const shim = installDialogShim({cancelOnEscape: true})
      cleanups.push(shim.restore)

      const el = dialog()
      el.showModal()
      el.addEventListener('cancel', (e) => e.preventDefault())

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      expect(el.open).toBe(true)
    })

    it('restore() removes the document listener', () => {
      const shim = installDialogShim({cancelOnEscape: true})
      shim.restore()

      const el = dialog()
      el.showModal()
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      expect(el.open).toBe(true)
    })
  })
})

describe('a sheet under the shim', () => {
  let core: SheetCore

  beforeEach(() => {
    core = createSheetCore()
  })

  afterEach(() => {
    core.__resetForTests()
    vi.useRealTimers()
  })

  it('drops the entry and releases the scroll lock when the dialog closes natively', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    const html = document.documentElement
    expect(html.hasAttribute('data-sheet-scroll-lock')).toBe(true)

    const el = document.querySelector('dialog.sv-sheet') as HTMLDialogElement
    el.close()
    vi.advanceTimersByTime(600)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(html.hasAttribute('data-sheet-scroll-lock')).toBe(false)
  })
})
