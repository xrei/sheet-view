import {describe, expect, it} from 'vitest'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

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

  it('no core or styles source names a UI framework, not even in a comment', () => {
    // No `solid`: it is also a border style, and a CSS file is full of them.
    const named = /\b(react|preact|vue|svelte|angular|jsx|reconciler)\b/i
    const allowed = /third-party|body-scroll-lock|headless ui/i
    const dirs = [join(root, 'src', 'core'), join(root, 'src', 'styles')]
    const offences: string[] = []
    for (const dir of dirs) {
      for (const file of readdirSync(dir)) {
        readFileSync(join(dir, file), 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (named.test(line) && !allowed.test(line)) {
              offences.push(`${file}:${i + 1} ${line.trim()}`)
            }
          })
      }
    }
    expect(offences).toEqual([])
  })

  it('no built chunk except react.js imports react', () => {
    const dist = join(root, 'dist')
    if (!existsSync(dist)) {
      // dist exists only after `pnpm build`; a source-only run has nothing to scan.
      return
    }
    const offenders: string[] = []
    for (const file of readdirSync(dist)) {
      if (!file.endsWith('.js')) continue
      if (file === 'react.js') continue
      const code = readFileSync(join(dist, file), 'utf8')
      if (REACT_IMPORT.test(code)) offenders.push(file)
    }
    expect(offenders, 'these dist chunks leaked a react import').toEqual([])
  })
})
