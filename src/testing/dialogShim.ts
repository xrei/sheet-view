/** A `HTMLDialogElement.prototype` member the shim knows how to install. */
export type DialogShimPatch = 'open' | 'showModal' | 'show' | 'close'

export interface InstallDialogShimOptions {
  /**
   * Also translate an Escape keydown into a cancelable `cancel` on the topmost
   * open dialog. Off by default: jsdom has no top layer, so "topmost" is a guess
   * (the last `dialog[open]`). Prefer dispatching `cancel` yourself.
   */
  cancelOnEscape?: boolean
}

export interface DialogShim {
  /** Members this call actually installed. Empty when nothing was missing. */
  installed: readonly DialogShimPatch[]
  /** Undoes exactly what this call installed. Idempotent. */
  restore: () => void
}

// Module-level, so a second install() can't stack a second keydown listener.
let escapeListener: ((event: KeyboardEvent) => void) | null = null

const noop = (): void => {}

/**
 * Installs the minimum `<dialog>` surface jsdom lacks, so a sheet can open in a
 * test environment. In a real browser every member is already present and this
 * is a silent no-op.
 *
 * Guards are per-member: a jsdom that gains `showModal()` but not `close()` still
 * gets `close()` patched.
 */
export function installDialogShim(
  options: InstallDialogShimOptions = {}): DialogShim {
  if (typeof HTMLDialogElement === 'undefined') return {installed: [], restore: noop}

  const proto = HTMLDialogElement.prototype
  const installed: DialogShimPatch[] = []
  const undo: Array<() => void> = []

  const define = (key: DialogShimPatch, descriptor: PropertyDescriptor): void => {
    const previous = Object.getOwnPropertyDescriptor(proto, key)
    Object.defineProperty(proto, key, {configurable: true, ...descriptor})
    installed.push(key)
    undo.push(() => {
      if (previous) Object.defineProperty(proto, key, previous)
      else delete (proto as unknown as Record<string, unknown>)[key]
    })
  }

  // jsdom ≥ 29 reflects `open` correctly. This covers older jsdom and other DOM
  // shims that ship the element without the IDL attribute.
  const openDescriptor = Object.getOwnPropertyDescriptor(proto, 'open')
  if (
    !openDescriptor ||
    typeof openDescriptor.get !== 'function' ||
    typeof openDescriptor.set !== 'function'
  ) {
    define('open', {
      enumerable: true,
      get(this: HTMLDialogElement): boolean {
        return this.hasAttribute('open')
      },
      set(this: HTMLDialogElement, value: boolean) {
        if (value) this.setAttribute('open', '')
        else this.removeAttribute('open')
      },
    })
  }

  // Neither the top layer, the focus trap, nor inertness is emulated: jsdom
  // can't host them.
  if (typeof proto.showModal !== 'function') {
    define('showModal', {
      enumerable: true,
      writable: true,
      value: function showModal(this: HTMLDialogElement): void {
        this.setAttribute('open', '')
      },
    })
  }

  if (typeof proto.show !== 'function') {
    define('show', {
      enumerable: true,
      writable: true,
      value: function show(this: HTMLDialogElement): void {
        this.setAttribute('open', '')
      },
    })
  }

  if (typeof proto.close !== 'function') {
    define('close', {
      enumerable: true,
      writable: true,
      // Closing an already-closed dialog is a spec no-op: the early return keeps
      // a double close() from firing two `close` events. The event dispatches
      // synchronously where browsers queue it, so teardown ordering is testable.
      value: function close(this: HTMLDialogElement, returnValue?: string): void {
        if (!this.hasAttribute('open')) return
        if (returnValue !== undefined) {
          ;(this as HTMLDialogElement & {returnValue: string}).returnValue = returnValue
        }
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      },
    })
  }

  if (options.cancelOnEscape === true && escapeListener === null) {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      const topmost = open[open.length - 1]
      if (!topmost) return
      // dispatchEvent returns false once preventDefault() ran, which is how the
      // core blocks Escape.
      if (topmost.dispatchEvent(new Event('cancel', {cancelable: true}))) {
        topmost.close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    escapeListener = onKeyDown
    undo.push(() => {
      if (escapeListener !== onKeyDown) return
      document.removeEventListener('keydown', onKeyDown)
      escapeListener = null
    })
  }

  let restored = false
  return {
    installed,
    restore(): void {
      if (restored) return
      restored = true
      for (let i = undo.length - 1; i >= 0; i--) undo[i]!()
    },
  }
}
