import {defineConfig} from 'vitepress'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'

const dist = (file: string): string =>
  fileURLToPath(new URL(`../../dist/${file}`, import.meta.url))

export default defineConfig({
  vite: {
    resolve: {
      alias: [
        {find: 'sheet-view/react', replacement: dist('react.js')},
        {find: 'sheet-view/base.css', replacement: dist('base.css')},
        {find: 'sheet-view/theme.css', replacement: dist('theme.css')},
        {find: 'sheet-view/styles.css', replacement: dist('styles.css')},
        {find: /^sheet-view$/, replacement: dist('index.js')},
      ],
    },
    server: {fs: {allow: ['..']}},
    plugins: [react({include: /\.(jsx|tsx)$/})],
  },
  title: 'sheet-view',
  description:
    'A headless, native-dialog bottom sheet for the web — vanilla core + React adapter.',
  base: '/sheet-view/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      {text: 'Guide', link: '/guide/getting-started'},
      {text: 'Theming', link: '/guide/theming'},
      {text: 'API', link: '/guide/api'},
      {text: 'Examples', link: '/examples'},
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          {text: 'Getting started', link: '/guide/getting-started'},
          {text: 'Theming', link: '/guide/theming'},
          {text: 'API reference', link: '/guide/api'},
        ],
      },
      {
        text: 'Live demos',
        items: [{text: 'Vanilla & React', link: '/examples'}],
      },
    ],
    outline: 'deep',
    search: {provider: 'local'},
    socialLinks: [{icon: 'github', link: 'https://github.com/xrei/sheet-view'}],
  },
})
