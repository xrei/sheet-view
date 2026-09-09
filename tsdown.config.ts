import {defineConfig, type UserConfig} from 'tsdown'

// Re-assert "use client" on the React chunk — Rolldown can hoist away the
// source-level directive, and RSC / Next App Router need it present.
const useClient: NonNullable<UserConfig['plugins']> = [
  {
    name: 'sheet-view:use-client',
    renderChunk(code, chunk) {
      const isReactEntry =
        chunk.name === 'react' || /(^|\/)react\.[cm]?js$/.test(chunk.fileName)
      if (!isReactEntry) return null
      if (code.startsWith(`'use client'`) || code.startsWith(`"use client"`)) {
        return null
      }
      return {code: `'use client';\n${code}`, map: null}
    },
  },
]

// `__DEV__` is substituted here, never read from the host environment: dist
// has to load from a bare <script type="module">, a CDN and an edge runtime,
// none of which define one. Warnings ship in every build. Flip this to a pair
// of configs with `false`/`true` if that ever costs more than it catches.
const shared = {
  format: ['esm'],
  platform: 'neutral',
  define: {__DEV__: 'true'},
  sourcemap: true,
  clean: true,
} satisfies UserConfig

export default defineConfig([
  {
    ...shared,
    name: 'bundler',
    entry: {
      index: 'src/index.ts',
      react: 'src/react.ts',
      testing: 'src/testing.ts',
    },
    dts: true,
    plugins: useClient,
  },
  // Self-contained single file for the no-bundler path: node_modules via a
  // <script type="module">, or a CDN. Core only: the React entry needs `react`
  // at runtime, which means an import map either way.
  {
    ...shared,
    name: 'browser',
    entry: {'sheet-view': 'src/index.ts'},
    dts: false,
    hash: false,
  },
  {
    ...shared,
    name: 'browser-min',
    entry: {'sheet-view.min': 'src/index.ts'},
    dts: false,
    hash: false,
    minify: true,
  },
])
