import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: 'neutral',
  plugins: [
    {
      // Re-assert "use client" on the React chunk — Rolldown can hoist away the
      // source-level directive, and RSC / Next App Router need it present.
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
  ],
})
