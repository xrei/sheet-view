import {copyFile, mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const src = join(root, 'src', 'styles')
const dist = join(root, 'dist')

const files = ['base.css', 'theme.css', 'styles.css']

await mkdir(dist, {recursive: true})
await Promise.all(
  files.map((f) => copyFile(join(src, f), join(dist, f))),
)

console.log(`copy-css: ${files.join(', ')} → dist/`)
