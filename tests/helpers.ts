import {vi} from 'vitest'

/**
 * What the core asked Element.animate() for, read back through the recording
 * stub in setup.ts. Every leg is two keyframes plus a timing function.
 */
interface RecordedAnimation {
  frames: Array<Record<string, string>>
  effect: {getTiming: () => {duration: number; fill?: string; easing?: string}}
  finish: () => void
}
export function motionOf(el: Element): RecordedAnimation | undefined {
  const list = (el as unknown as {getAnimations?: () => RecordedAnimation[]})
    .getAnimations?.()
  return list?.[list.length - 1]
}
/** Duration in ms of the animation currently running on `el`, or NaN. */
export function motionMs(el: Element): number {
  return motionOf(el)?.effect.getTiming().duration ?? NaN
}
/** The value of `prop` at the first and last keyframe. */
export function motionRange(el: Element, prop: string): [string, string] | undefined {
  const f = motionOf(el)?.frames
  if (!f?.length) return undefined
  return [f[0]![prop]!, f[f.length - 1]![prop]!]
}
/** Lands the animation on `el`, the test-time stand-in for it finishing. */
export function finishMotion(el: Element): void {
  motionOf(el)?.finish()
}

/** The timing function the animation on `el` rides. */
export function easingOf(el: Element): string {
  return motionOf(el)?.effect.getTiming().easing ?? ''
}

/**
 * True when the timing function on `el` can leave the 0-1 range, i.e. pass its
 * target and come back: a cubic bezier with a control point outside the unit box.
 */
export function overshoots(el: Element): boolean {
  const m = /cubic-bezier\(([^)]+)\)/.exec(easingOf(el))
  if (!m) return false // linear and the named keywords are all monotone
  const p = m[1]!.split(',').map(Number)
  const y1 = p[1]!
  const y2 = p[3]!
  return y1 > 1 || y1 < 0 || y2 > 1 || y2 < 0
}

/**
 * How far through its journey the timing function on `el` is at `frac` of the
 * clock, 0 to 1. Non-bezier easings report `frac` unchanged.
 */
export function paceAt(el: Element, frac: number): number {
  const m = /cubic-bezier\(([^)]+)\)/.exec(easingOf(el))
  if (!m) return frac
  const c = m[1]!.split(',').map(Number)
  const x1 = c[0]!
  const y1 = c[1]!
  const x2 = c[2]!
  const y2 = c[3]!
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  let t = frac
  for (let i = 0; i < 24; i++) {
    const x = ((ax * t + bx) * t + cx) * t - frac
    const d = (3 * ax * t + 2 * bx) * t + cx
    if (Math.abs(x) < 1e-7) break
    t -= x / (d || 1e-7)
  }
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  return ((ay * t + by) * t + cy) * t
}

// jsdom has no matchMedia (so makeIsMobile reports desktop) and reports 0 for
// every layout dimension. The stubs below are opt-in per file, installed in
// beforeEach and restored in afterEach, so desktop-path tests stay on it.

interface MediaState {
  mobile: boolean
  reducedMotion: boolean
}

export interface MockMatchMedia {
  setMobile: (v: boolean) => void
  setReducedMotion: (v: boolean) => void
  restore: () => void
}

// Installs a live window.matchMedia. `.matches` resolves from mutable state on
// every read, so a MediaQueryList captured once (makeIsMobile) reflects later
// flips. setMobile/setReducedMotion dispatch `change` only when the resolved
// value actually flips, as a real MediaQueryList does.
export function mockMatchMedia(initial: Partial<MediaState> = {}): MockMatchMedia {
  const state: MediaState = {
    mobile: initial.mobile ?? false,
    reducedMotion: initial.reducedMotion ?? false,
  }
  const resolve = (query: string): boolean => {
    if (query.includes('prefers-reduced-motion')) return state.reducedMotion
    if (query.includes('max-width')) return state.mobile
    return false
  }

  interface Entry {
    query: string
    listeners: Set<(e: MediaQueryListEvent) => void>
    last: boolean
  }
  const live: Entry[] = []

  const make = (query: string): MediaQueryList => {
    const entry: Entry = {query, listeners: new Set(), last: resolve(query)}
    live.push(entry)
    const mql = {
      get matches() {
        return resolve(query)
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') entry.listeners.add(cb)
      },
      removeEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') entry.listeners.delete(cb)
      },
      addListener: (cb: (e: MediaQueryListEvent) => void) => entry.listeners.add(cb),
      removeListener: (cb: (e: MediaQueryListEvent) => void) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
    }
    return mql as unknown as MediaQueryList
  }

  const emit = (): void => {
    for (const entry of live) {
      const now = resolve(entry.query)
      if (now === entry.last) continue
      entry.last = now
      const event = {matches: now, media: entry.query} as MediaQueryListEvent
      for (const cb of entry.listeners) cb(event)
    }
  }

  const savedDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  const savedValue = window.matchMedia
  window.matchMedia = vi.fn(make) as typeof window.matchMedia

  return {
    setMobile(v: boolean): void {
      state.mobile = v
      emit()
    },
    setReducedMotion(v: boolean): void {
      state.reducedMotion = v
      emit()
    },
    restore(): void {
      // The environment defines `matchMedia` as an accessor pair whose getter
      // starts out undefined, so the assignment above went through its setter and
      // re-applying the saved descriptor alone still yields the mock. Drop the own
      // property first, and rebuild it only if there was a real value to put back.
      delete (window as {matchMedia?: unknown}).matchMedia
      if (savedValue !== undefined) {
        if (savedDescriptor) {
          Object.defineProperty(window, 'matchMedia', savedDescriptor)
        }
        window.matchMedia = savedValue
      }
    },
  }
}

interface LayoutStub {
  innerWidth?: number
  innerHeight?: number
  scrollY?: number
  clientWidth?: number
  scrollHeight?: number
}

// Overrides window and documentElement geometry, all 0 or unstubbable in jsdom.
// The returned function puts every patched property back.
export function stubLayout(stub: LayoutStub): () => void {
  const restores: Array<() => void> = []

  const patchWindow = (key: keyof LayoutStub, value: number): void => {
    const saved = Object.getOwnPropertyDescriptor(window, key)
    Object.defineProperty(window, key, {configurable: true, writable: true, value})
    restores.push(() => {
      if (saved) Object.defineProperty(window, key, saved)
      else delete (window as Record<string, unknown>)[key]
    })
  }
  const patchDocEl = (key: 'clientWidth' | 'scrollHeight', value: number): void => {
    const el = document.documentElement
    Object.defineProperty(el, key, {configurable: true, get: () => value})
    restores.push(() => {
      delete (el as unknown as Record<string, unknown>)[key]
    })
  }

  if (stub.innerWidth !== undefined) patchWindow('innerWidth', stub.innerWidth)
  if (stub.innerHeight !== undefined) patchWindow('innerHeight', stub.innerHeight)
  if (stub.scrollY !== undefined) patchWindow('scrollY', stub.scrollY)
  if (stub.clientWidth !== undefined) patchDocEl('clientWidth', stub.clientWidth)
  if (stub.scrollHeight !== undefined) patchDocEl('scrollHeight', stub.scrollHeight)

  return () => {
    for (const r of restores) r()
  }
}

// Stubs an element's offsetTop (always 0 in jsdom) and counts reads of it.
export function stubOffsetTop(
  el: HTMLElement,
  px: number,
): {reads: () => number; restore: () => void} {
  let reads = 0
  const saved = Object.getOwnPropertyDescriptor(el, 'offsetTop')
  Object.defineProperty(el, 'offsetTop', {
    configurable: true,
    get() {
      reads++
      return px
    },
  })
  return {
    reads: () => reads,
    restore(): void {
      delete (el as unknown as Record<string, unknown>).offsetTop
      if (saved) Object.defineProperty(el, 'offsetTop', saved)
    },
  }
}
