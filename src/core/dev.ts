// Module-scoped declare (this project has no @types/node) shadowing the global,
// so the bare identifier below compiles.
declare const process: {env: Record<string, string | undefined>}

// Bare `process.env.NODE_ENV` — NOT globalThis.process — so a bundler's define
// replacement (Vite / webpack / esbuild all match only the bare member chain)
// can inline it and dead-code-eliminate the dev branches from production builds.
// The try/catch is the bundler-less safety net: with no bundler the identifier
// throws ReferenceError in a browser (the vanilla example loads dist raw), and
// with no bundler there is no production build either, so staying in dev mode
// there is the correct answer.
function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return true
  }
}

/** Warns about a misuse the library can detect but not fix. Silent in production. */
export function devWarn(message: string): void {
  if (isDev()) console.warn(`[sheet-view] ${message}`)
}
