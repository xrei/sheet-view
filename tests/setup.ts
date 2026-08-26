import {afterEach} from 'vitest'
import {cleanup} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import {installDialogShim} from '../src/testing'

// jsdom ships HTMLDialogElement without showModal/show/close, and the core opens
// sheets via showModal(). The shim is the published one from src, so the suite
// needs no build. cancelOnEscape stays off: tests dispatch `cancel` on the dialog
// directly.
installDialogShim()

// jsdom ships no Element.prototype.scrollTo at all, so a bare call throws rather
// than doing nothing. Instant, since jsdom cannot animate; tests that care spy
// over it.
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollTo(
    this: Element,
    ...args: [ScrollToOptions?] | [number, number]
  ): void {
    const opts = typeof args[0] === 'object' ? args[0] : {top: args[1], left: args[0]}
    if (opts?.top != null) this.scrollTop = opts.top
    if (opts?.left != null) this.scrollLeft = opts.left
  }
}

// jsdom has no Web Animations API, and the core drives every sheet animation
// through Element.animate(). This is a recording stub, not an implementation: it
// never advances, it keeps the keyframes and options so tests can assert what the
// core asked for. `finish()` stands in for the animation landing.
interface StubAnimation {
  playState: string
  onfinish: (() => void) | null
  effect: {getTiming: () => KeyframeAnimationOptions}
  frames: Keyframe[]
  cancel: () => void
  finish: () => void
}
if (typeof Element.prototype.animate !== 'function') {
  const running = new WeakMap<Element, StubAnimation[]>()
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(this: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) {
      const anim: StubAnimation = {
        playState: 'running',
        onfinish: null,
        effect: {getTiming: () => opts},
        frames: [...frames],
        cancel(): void {
          anim.playState = 'idle'
        },
        finish(): void {
          anim.playState = 'finished'
          anim.onfinish?.()
        },
      }
      const list = running.get(this) ?? []
      list.push(anim)
      running.set(this, list)
      return anim as unknown as Animation
    },
  })
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    writable: true,
    value(this: Element) {
      return (running.get(this) ?? []).filter((a) => a.playState === 'running')
    },
  })
}

afterEach(() => {
  cleanup()
})
