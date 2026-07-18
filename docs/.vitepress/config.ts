import {defineConfig} from 'vitepress'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {version} from '../../package.json'

// npm logo (simple-icons) for the social-links row
const npmIcon =
  '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>npm</title><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>'

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
      {
        text: `v${version}`,
        items: [
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/sheet-view',
          },
          {
            text: 'Release notes',
            link: 'https://github.com/xrei/sheet-view/releases',
          },
        ],
      },
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
    socialLinks: [
      {icon: 'github', link: 'https://github.com/xrei/sheet-view'},
      {
        icon: {svg: npmIcon},
        link: 'https://www.npmjs.com/package/sheet-view',
        ariaLabel: 'npm',
      },
    ],
  },
})
