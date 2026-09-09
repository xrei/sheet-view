import {defineConfig} from 'vitest/config'

export default defineConfig({
  // Tests import `src` directly. They need the same build-time constant
  // tsdown substitutes into the bundle.
  define: {__DEV__: 'true'},
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
