import {describe, expect, it} from 'vitest'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

// The core must be framework-agnostic: a non-React consumer importing
// `sheet-view` must never pull React into their bundle. These guards fail loudly
// if a React import ever leaks into the core — the whole point of the split.
// vitest runs from the package root, so cwd is the project directory.
const root = process.cwd()
const REACT_IMPORT = /(from|import)\s*\(?\s*['"]react(-dom)?(\/[^'"]*)?['"]/

describe('framework-agnostic core', () => {
  it('no core source file imports react / react-dom', () => {
    const coreDir = join(root, 'src', 'core')
    for (const file of readdirSync(coreDir)) {
      if (!file.endsWith('.ts')) continue
      const code = readFileSync(join(coreDir, file), 'utf8')
      expect(REACT_IMPORT.test(code), `src/core/${file} must not import react`).toBe(
        false,
      )
    }
  })

  it('no built chunk except react.js imports react (requires a prior build)', () => {
    const dist = join(root, 'dist')
    if (!existsSync(dist)) {
      // dist is only present after `pnpm build`; skip in a source-only test run.
      return
    }
    const offenders: string[] = []
    for (const file of readdirSync(dist)) {
      if (!file.endsWith('.js')) continue
      if (file === 'react.js') continue // the adapter is the ONLY react consumer
      const code = readFileSync(join(dist, file), 'utf8')
      if (REACT_IMPORT.test(code)) offenders.push(file)
    }
    expect(offenders, 'these dist chunks leaked a react import').toEqual([])
  })
})
