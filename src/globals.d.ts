/**
 * Build-time constant, substituted by the `define` option in the tsdown and
 * vitest configs. Never reachable at runtime: a shipped file that reads a host
 * global cannot load without a bundler.
 */
declare const __DEV__: boolean
