import {afterEach} from 'vitest'
import {cleanup} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// jsdom ships an empty HTMLDialogElement (no showModal/show/close, no reflecting
// `open`). The core opens sheets via showModal(), so shim the minimum it needs.
// Test-only — real browsers implement these natively. Escape→`cancel` is not
// shimmed; tests simulate it by dispatching a `cancel` event on the dialog.
if (
  typeof HTMLDialogElement !== 'undefined' &&
  !HTMLDialogElement.prototype.showModal
) {
  const proto = HTMLDialogElement.prototype
  Object.defineProperty(proto, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open')
    },
    set(this: HTMLDialogElement, value: boolean) {
      if (value) this.setAttribute('open', '')
      else this.removeAttribute('open')
    },
  })
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.show = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
})
