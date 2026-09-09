import {describe, expect, it} from 'vitest'
import {spawnSync} from 'node:child_process'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'

// vitest runs from the package root, which makes cwd the project directory.
const dist = join(process.cwd(), 'dist')

// A host global in a shipped file is what breaks a bundler-free load. Nothing
// substitutes it, and the module throws on evaluation.
const HOST_GLOBAL = /\bprocess\s*\.|\brequire\s*\(|\b__dirname\b|\b__filename\b/

/**
 * Only code decides these checks. Source JSDoc ships verbatim in the unminified
 * chunks, and a comment is free to name the globals it explains never reading.
 * Whole-line `//` only: dist is emitted one statement per line unminified and
 * on a single line minified, which makes any mid-line match a string.
 */
const code = (file: string): string =>
  readFileSync(join(dist, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

// Everything a consumer can load with no bundler and no import map.
const SELF_SUFFICIENT = ['index.js', 'testing.js', 'sheet-view.js', 'sheet-view.min.js']

// The single-file builds, addressed by URL from a CDN or node_modules.
const STANDALONE = ['sheet-view.js', 'sheet-view.min.js']

// dist exists only after `pnpm build`; a source-only run has nothing to scan.
describe.skipIf(!existsSync(dist))('dist loads without a bundler', () => {
  it('no shipped chunk reads a host global', () => {
    const offenders = readdirSync(dist)
      .filter((file) => file.endsWith('.js'))
      .filter((file) => HOST_GLOBAL.test(code(file)))
    expect(offenders, 'these chunks cannot load outside a bundler').toEqual([])
  })

  it.each(SELF_SUFFICIENT)('%s evaluates with `process` deleted', (file) => {
    const url = pathToFileURL(join(dist, file)).href
    const {status, stderr} = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `delete globalThis.process; await import(${JSON.stringify(url)})`,
      ],
      {encoding: 'utf8'},
    )
    expect(stderr.trim()).toBe('')
    expect(status).toBe(0)
  })

  // react.js cannot be load-tested the same way, because React itself reads
  // the env. The assertion is on what it asks the host to resolve.
  it('react.js imports nothing but react', () => {
    const bare = [...code('react.js').matchAll(/from\s*['"]([^'".][^'"]*)['"]/g)].map(
      (m) => m[1],
    )
    const allowed = new Set(['react', 'react-dom', 'react/jsx-runtime'])
    expect(bare.filter((id) => !allowed.has(id!))).toEqual([])
  })

  it.each(STANDALONE)('%s is one file with no imports', (file) => {
    expect(code(file), 'a standalone build must not resolve anything').not.toMatch(
      /\bfrom\s*['"]|\bimport\s*[('"]/,
    )
    expect(code(file)).toMatch(/\bexport\s*\{[^}]*createSheetCore/)
  })
})
