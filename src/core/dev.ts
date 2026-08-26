// Module-scoped declare (this project has no @types/node) shadowing the global,
// so the bare identifier below compiles.
declare const process: {env: Record<string, string | undefined>}

/**
 * True outside production builds. A top-level const over the bare
 * `process.env.NODE_ENV` chain (NOT globalThis.process), because that is the
 * one shape bundlers fold all the way: define replacement turns the read into
 * a literal, cross-module constant propagation inlines it into every
 * `if (DEV)` guard, and the dead branch drops out of production bundles with
 * its warning string. Vite, webpack, and esbuild (platform: browser) all
 * substitute NODE_ENV out of the box; loading dist raw with no bundler at all
 * is unsupported — this read is what throws there.
 */
export const DEV: boolean = process.env.NODE_ENV !== 'production'

/**
 * Warns about a misuse the library can detect but not fix. Every call site
 * must sit behind `if (DEV)` — the guard, not this function, is what lets a
 * production build drop the message string.
 */
export function devWarn(message: string): void {
  console.warn(`[sheet-view] ${message}`)
}
