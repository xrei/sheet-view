import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createSheetCore} from '../src/core/sheetCore'
import type {SheetCore} from '../src/core/types'
import {installDialogShim} from '../src/testing'

// tests/setup.ts already installed the shim for the whole run, so the members
// under test are OURS. Behaviour tests exercise that live copy; the installation
// mechanics tests have to strip members first, then put the prototype back.
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

  it('is idempotent — a second call installs nothing', () => {
    const shim = installDialogShim()
    cleanups.push(shim.restore)
    expect(shim.installed).toEqual([])
  })

  it('patches each member independently, so a partial dialog implementation is still repaired', () => {
    // The frozen-page guard: a jsdom that grows showModal() but not close() must
    // still get close(), or the core never sees the event that unlocks the page.
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

  it('installs `open` when it is missing a setter', () => {
    const proto = HTMLDialogElement.prototype as unknown as ProtoBag
    const saved = Object.getOwnPropertyDescriptor(proto, 'open')
    // `set: undefined` is load-bearing — defineProperty retains descriptor fields
    // it isn't given, so omitting it would keep jsdom's real setter.
    Object.defineProperty(proto, 'open', {
      configurable: true,
      set: undefined,
      get(this: HTMLDialogElement) {
        return this.hasAttribute('open')
      },
    })
    const shim = installDialogShim()
    cleanups.push(
      () => {
        if (saved) Object.defineProperty(proto, 'open', saved)
        else delete proto['open']
      },
      shim.restore,
    )

    expect(shim.installed).toContain('open')
    const el = dialog()
    el.open = true
    expect(el.hasAttribute('open')).toBe(true)
  })

  it('close() dispatches a close event — the signal that releases the scroll lock', () => {
    const el = dialog()
    const onClose = vi.fn()
    el.addEventListener('close', onClose)
    el.showModal()
    el.close()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('close() on an already-closed dialog is a no-op and dispatches nothing', () => {
    const el = dialog()
    const onClose = vi.fn()
    el.addEventListener('close', onClose)
    el.close()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('close(value) records returnValue', () => {
    const el = dialog()
    el.showModal()
    el.close('accepted')
    expect(el.returnValue).toBe('accepted')
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

    it('honours preventDefault() — the sheet core blocks Escape that way', () => {
      const shim = installDialogShim({cancelOnEscape: true})
      cleanups.push(shim.restore)

      const el = dialog()
      el.showModal()
      el.addEventListener('cancel', (e) => e.preventDefault())

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      expect(el.open).toBe(true)
    })

    it('is off by default, so an Escape keydown does nothing', () => {
      const el = dialog()
      el.showModal()
      const onCancel = vi.fn()
      el.addEventListener('cancel', onCancel)

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      expect(onCancel).not.toHaveBeenCalled()
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

  it('tears down and releases the page when the dialog closes natively', () => {
    vi.useFakeTimers()
    core.open({title: 'A'})
    expect(document.documentElement.style.overflow).toBe('clip')

    // The native close path the shim's `close` event drives — omit that event in
    // a hand-rolled shim and the page stays locked forever.
    const el = document.querySelector('dialog.sv-sheet') as HTMLDialogElement
    el.close()
    vi.advanceTimersByTime(320)

    expect(core.getSnapshot()).toHaveLength(0)
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
  })
})
