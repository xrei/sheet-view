import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Features, transform} from 'lightningcss'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const src = join(root, 'src', 'styles')
const dist = join(root, 'dist')

const files = ['base.css', 'theme.css', 'styles.css']

await mkdir(dist, {recursive: true})

// dist ships minified css; the unminified sources also publish under src/.
//
// `targets` is the supported floor, stated so lightningcss cannot emit syntax
// newer than it. Nothing here is downlevelled: every feature the sources use
// already ships in all three.
const v = (major, minor = 0) => (major << 16) | (minor << 8)
const targets = {
  safari: v(18, 2),
  ios_saf: v(18, 2),
  chrome: v(127),
  firefox: v(139),
}

const sizes = []
for (const f of files) {
  const source = await readFile(join(src, f), 'utf8')
  const {code, warnings} = transform({
    filename: f,
    code: Buffer.from(source),
    minify: true,
    targets,
    // light-dark() ships verbatim: lightningcss's polyfill rewrites it onto
    // --lightningcss-light / --lightningcss-dark vars the host page never
    // defines. It is inside the browser floor above, so nothing needs polyfilling.
    exclude: Features.LightDark,
  })
  for (const w of warnings) {
    console.warn(`copy-css: ${f}: ${w.message}`)
  }
  await writeFile(join(dist, f), code)
  sizes.push(`${f} ${(source.length / 1024).toFixed(1)}→${(code.length / 1024).toFixed(1)}kB`)
}

console.log(`copy-css (minified): ${sizes.join(', ')} → dist/`)
