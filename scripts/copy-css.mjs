import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Features, transform} from 'lightningcss'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const src = join(root, 'src', 'styles')
const dist = join(root, 'dist')

const files = ['base.css', 'theme.css', 'styles.css']

await mkdir(dist, {recursive: true})

// dist ships MINIFIED css — the sources are heavily commented (the comments are
// the documentation of the cascade contract) and a CDN / bundler-less consumer
// shouldn't pay for that. The commented originals still publish under src/.
//
// `targets` = the README's documented floor (Safari 15.4 / Chrome 108 / FF 101,
// the dvh baseline). Without targets, minification rewrites media queries into
// MQ4 range syntax ((width<=767px)), which Safari <16.4 won't parse — silently
// raising the floor and dropping every mobile rule there.
const v = (major, minor = 0) => (major << 16) | (minor << 8)
const targets = {
  safari: v(15, 4),
  ios_saf: v(15, 4),
  chrome: v(108),
  firefox: v(101),
}

const sizes = []
for (const f of files) {
  const source = await readFile(join(src, f), 'utf8')
  const {code, warnings} = transform({
    filename: f,
    code: Buffer.from(source),
    minify: true,
    targets,
    // theme.css already carries its own prefers-color-scheme fallback for
    // light-dark(); lightningcss's polyfill would rewrite it onto
    // --lightningcss-* vars the HOST page never defines, breaking the
    // follow-the-host color scheme everywhere, not just in old browsers.
    exclude: Features.LightDark,
  })
  for (const w of warnings) {
    console.warn(`copy-css: ${f}: ${w.message}`)
  }
  await writeFile(join(dist, f), code)
  sizes.push(`${f} ${(source.length / 1024).toFixed(1)}→${(code.length / 1024).toFixed(1)}kB`)
}

console.log(`copy-css (minified): ${sizes.join(', ')} → dist/`)
