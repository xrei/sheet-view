/**
 * True outside production builds. A build-time constant, not a host-environment
 * read: `dist/` has to load from a plain `<script type="module">`, an edge
 * runtime and a CDN, where no such global exists.
 */
const DEV: boolean = __DEV__

/**
 * Warns about a misuse the library can detect but not fix.
 */
export function devWarn(message: string): void {
  if (DEV) console.warn(`[sheet-view] ${message}`)
}
