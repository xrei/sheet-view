import {vi} from 'vitest'

// Test infrastructure for the mobile/gesture and scroll-lock branches, which the
// existing suite never exercises: jsdom has no matchMedia (so makeIsMobile always
// reports desktop) and reports 0 for layout dimensions. Everything here is opt-in
// per file — install in beforeEach, restore in afterEach — so desktop-path tests
// stay on the desktop path.

interface MediaState {
  mobile: boolean
  reducedMotion: boolean
}

export interface MockMatchMedia {
  setMobile: (v: boolean) => void
  setReducedMotion: (v: boolean) => void
  restore: () => void
}

// Installs a live window.matchMedia. `.matches` is resolved from mutable state on
// every read, so a MediaQueryList captured at construction (makeIsMobile) reflects
// later flips. setMobile/setReducedMotion mutate state and dispatch a `change`
// event to matching listeners — but only when the resolved value actually flips,
// matching real MediaQueryList semantics.
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
      // The test environment defines `matchMedia` as an accessor pair on window
      // whose getter starts out undefined, so `window.matchMedia = mock` went
      // through its SETTER — and re-applying the saved descriptor would hand back
      // an accessor that still yields the mock. Drop the own property first, and
      // only rebuild it if there was a real value to put back. Without this the
      // mock leaks into every later suite in the file and silently puts them on
      // the mobile path.
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

// Overrides window/documentElement geometry (all 0 or unstubbable in jsdom).
// Returns a restore() that puts every patched property back.
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

// Stubs an element's offsetTop (always 0 in jsdom) and counts reads — lets a test
// assert the scroll hot-path reads layout once, not once per frame.
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
