# sheet-view

[![npm version](https://img.shields.io/npm/v/sheet-view.svg)](https://www.npmjs.com/package/sheet-view)
[![min+gzip](https://img.shields.io/badge/min%2Bgzip-3.9%20kB-brightgreen.svg)](https://bundlephobia.com/package/sheet-view)
[![license](https://img.shields.io/npm/l/sheet-view.svg)](./LICENSE)

A headless bottom-sheet / modal built on browser-native primitives: native
`<dialog>.showModal()` for modality, focus-trap, Escape, and focus-restore; CSS
`scroll-snap` for the drag-to-close gesture; `dvh` for iOS keyboard sizing. A
framework-agnostic **core** owns the DOM and lifecycle; a thin **React adapter**
portals your content into it.

- **Truly headless** — ship a tiny required structural stylesheet, an optional
  default theme, or bring your own. Style via CSS custom properties.
- **Framework-agnostic core** — the vanilla core imports zero React. A React
  adapter lives at `sheet-view/react`.
- **Native a11y for free** — `showModal()` provides the focus-trap, inert
  background, Escape handling, and focus restoration.
- **Tiny** — 3.9 kB min+gzip for the core, 4.7 kB with the React adapter, zero
  runtime dependencies. Smaller than a bare Radix dialog with no sheet
  behaviour at all.
- **TypeScript-first** — types ship out of the box. ESM-only.

## Install

```sh
npm i sheet-view
```

React is an optional peer dependency — only `sheet-view/react` needs it.

## Quick start (React)

```tsx
import {sheets, SheetHost} from 'sheet-view/react'
import 'sheet-view/base.css' // REQUIRED structural styles
import 'sheet-view/theme.css' // OPTIONAL default theme

// Mount once at the app root, inside your providers:
function App() {
  return (
    <>
      <YourApp />
      <SheetHost />
    </>
  )
}

// Open a sheet from anywhere — no hooks, no context:
function openSettings() {
  sheets.open({
    title: 'Settings',
    size: 'md',
    content: ({close}) => <SettingsForm onDone={close} />,
  })
}
```

## Quick start (vanilla, no framework)

```js
import {createSheetCore} from 'sheet-view'
import 'sheet-view/base.css'
import 'sheet-view/theme.css'

const sheets = createSheetCore()

sheets.open({
  title: 'Hello',
  size: 'sm',
  content: () => {
    const el = document.createElement('div')
    el.textContent = 'A plain-DOM sheet body.'
    return el
  },
})
```

Slots accept a `Node`, a `string`, or a `(ctx) => Node | string` factory. Run
`pnpm docs:dev` for live demos of the core and the React adapter.

## CSS: required base + optional theme

Positioning and the scroll-snap container need real CSS to work, so the styles come
in two parts:

| Import                  | Required? | What it is                                                        |
| ----------------------- | --------- | ----------------------------------------------------------------- |
| `sheet-view/base.css`   | **Yes**   | Structure: layout, scroll-snap, sizing, desktop centering.        |
| `sheet-view/theme.css`  | No        | The default skin: surface, radius, shadow, backdrop, handle, etc. |
| `sheet-view/styles.css` | —         | Convenience: `base.css` + `theme.css` in one import.              |

`base.css` is deliberately **unlayered** so its gesture-critical rules can't be
overridden by a stray consumer utility class. `theme.css` is wrapped in
`@layer sheet-view` so your own styles always win.

> **Next.js Pages Router:** global CSS may only be imported from `pages/_app.js`
> — import `base.css`/`theme.css` there. The App Router allows importing them
> anywhere.

### Theming with tokens

`theme.css` reads `--sheet-*` custom properties with sensible fallbacks. Override
any of them on `:root`, `[data-sheet-part='root']`, or any ancestor to restyle the
sheet without touching the file. Overrides apply in both light and dark:

```css
:root {
  --sheet-surface: #14121c; /* card background */
  --sheet-text: #ffffff; /* text colour */
  --sheet-radius: 24px; /* mobile card top radius */
  --sheet-backdrop: rgb(0 0 0 / 0.6); /* dim colour */
}
```

- **Colours:** `--sheet-surface`, `--sheet-text`, `--sheet-handle`,
  `--sheet-border`, `--sheet-border-subtle`, `--sheet-hover`, `--sheet-backdrop`
- **Geometry:** `--sheet-radius`, `--sheet-radius-desktop`, `--sheet-shadow`,
  `--sheet-shadow-mobile`, `--sheet-backdrop-blur`
- **Skin:** `--sheet-title-size`, `--sheet-title-weight`, `--sheet-close-size`,
  `--sheet-close-radius`, `--sheet-handle-radius`, `--sheet-handle-opacity`,
  `--sheet-header-padding`

Per **instance**, pass `className` / `style` to `open()`. `style` sets tokens on the
root, so it reaches every part — including the backdrop, which a card class can't
reach:

```js
sheets.open({
  title: 'Filters',
  className: 'promo',
  style: {'--sheet-surface': '#14121c', '--sheet-backdrop': 'rgb(0 0 0 / 0.7)'},
})
```

#### Light & dark

The default skin follows the **host page's** `color-scheme`, not the OS — the sheet
inherits `color-scheme` from your root and resolves its palette against it:

- Declare `color-scheme: dark` (or `light dark`) on `:root` and the sheet renders
  dark, in step with your page and its native form controls.
- A page that declares nothing (or `color-scheme: light`) gets a light sheet, even on
  a device set to dark.
- Your own `--sheet-*` overrides always win, in either scheme.

> On browsers without CSS `light-dark()` (Safari <17.5, Chrome <123, Firefox <120)
> the palette falls back to the OS `prefers-color-scheme`, so a light page on a dark
> device can still get a dark sheet. Set `color-scheme` explicitly, or override the
> tokens, to pin the palette.

### Styling hooks

Every part of the sheet DOM carries a stable attribute you can target from your
own CSS:

- `[data-sheet-part="root|backdrop|scroll|spacer|panel|card|handle|header|content|footer|overlay|toplayer|default-header|title|close"]`
- `[data-sheet-state="opening|open|closing"]` on the root
- `[data-sheet-size="sm|md|lg|xl"]` on the card
- `[data-sheet-focus-open]` on the root — present when opened with `focusOnOpen`
- mirrored `.sv-sheet__*` classes, if you prefer class selectors

The docs' anatomy demo colour-codes each of these parts — run `pnpm docs:dev` to
see it.

**Stability.** Four surfaces are semver-stable: the `open()` props, the public
`--sheet-*` tokens, the `data-sheet-*` attributes, and the slot nodes. Internal
`--_sheet-*` tokens and the DOM depth between slots may change in any release.

## API

### `sheets.open(props)` → handle

| Prop                            | Type                                       | Notes                                                        |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `key`                           | `string`                                   | Dedupe scope for a singleton sheet.                          |
| `strategy`                      | `'reuse' \| 'replace' \| 'update'`         | Only with `key`. Default `'reuse'`.                          |
| `title`                         | `string`                                   | Default-header text (ignored if `headerSlot` is set).        |
| `size`                          | `'sm' \| 'md' \| 'lg' \| 'xl'`             | Default `'lg'`.                                              |
| `focusOnOpen`                   | `boolean`                                  | A field autofocuses on open — opens keyboard-safe on mobile. |
| `content` / `headerSlot` / `footer` / `overlaySlot` | `ReactNode \| (ctx) => ReactNode` | Slot content. (`Node \| string \| fn` in the core.)          |
| `closeDisabled`                 | `boolean`                                  | Blocks X / backdrop / Escape / drag; fires `onCloseAttempt`. |
| `closeHidden`                   | `boolean`                                  | Omits the default-header close button.                       |
| `closeLabel`                    | `string`                                   | Accessible label for the close button. Default `'Close'`.    |
| `closeIcon`                     | `ReactNode \| (ctx) => ReactNode`          | Custom glyph/SVG in place of `×`; the a11y name stays `closeLabel`. |
| `ariaLabel`                     | `string`                                   | Accessible name. Without it, a `title` labels the dialog via `aria-labelledby`. |
| `cardClassName`                 | `string`                                   | Extra classes on the card.                                   |
| `className`                     | `string`                                   | Class(es) on the **root** dialog.                            |
| `style`                         | `Record<string, string>`                   | Inline styles/tokens on the root — reaches every part.       |
| `onClose` / `onCloseAttempt` / `onExited` | `() => void`                     | Lifecycle callbacks.                                         |

Returns `{id, close(), update(nextProps)}`. `close()` closes the sheet even when
`closeDisabled` is set (the programmatic override). `update()` merges in new props
and re-applies them — slots, `size`, `cardClassName`, and the accessible name.

**Keyed strategies:** `reuse` returns the existing handle (no-op); `replace`
closes the old sheet and opens fresh; `update` merges props into the live sheet.

### Also on `sheets`

- `sheets.closeAll()` — start closing every open sheet.
- `sheets.hasLocked()` — `true` while any open sheet has `closeDisabled` (handy
  for a `beforeunload` guard).

### `<SheetHost instance?={sheets} />`

Mounted once at the app root; portals React slot content into the core's DOM.

### `useSheetTopLayer(instance?)` → `HTMLElement | null`

The top-layer node of the topmost open sheet (or `null`). Portal global overlays
(toasts, tooltips) into it so they paint above the modal. See the React example.

### Multiple instances

`createSheets()` (React) and `createSheetCore(options?)` (core) build isolated
instances. `<SheetHost instance={mySheets} />` and
`useSheetTopLayer(mySheets)` bind to a specific one. Core options: `closeMs`,
`dragCloseMs`, `openSettleMs`, `breakpoint`, `zoomLock`, `closeLabel`.

`closeMs`/`dragCloseMs` are the exit-animation budgets before the DOM is removed —
keep them **≥** your theme's exit-transition durations (the defaults, 320/220 ms,
clear the built-in 250 ms desktop transition), or a close will be cut short.
`zoomLock` (default `false`) pins `maximum-scale=1` while a sheet is open; leave it
off — disabling zoom is a WCAG 1.4.4 failure, and the base theme already prevents
iOS focus-zoom by keeping sheet inputs ≥16 px.

## Notes & known limitations

- **Client-only `open()`.** `open()` touches `document`; call it in the browser,
  not during SSR. `<SheetHost>` itself is SSR-safe (renders nothing on the server).
- **Drag-to-dismiss is from the header / grabber.** The content area uses
  `overscroll-behavior: contain`, so scrolling a long body never dismisses the
  sheet. This is deliberate — a long read shouldn't end in an accidental close.
- **iOS keyboard & `100dvh`.** `dvh` doesn't shrink when the keyboard appears, so a
  pinned `footer` can sit behind it while a field is focused. `focusOnOpen` fixes
  the open seam; for a keyboard-following footer, drive it from `visualViewport`.
- **Trigger-button `:hover` on iOS.** iOS applies `:hover` on tap and keeps it until
  another element is tapped — so a swipe-closed sheet leaves the button that opened
  it highlighted (tapping empty space doesn't clear it). Gate your own `:hover`
  styles behind `@media (hover: hover)`; the built-in theme already does.
- **Password-manager extensions.** `showModal()` makes everything outside the
  dialog inert — including the autofill dropdowns that extensions inject into the
  page. The dropdown draws above the sheet but can't be clicked; the pointer falls
  through to whatever sits beneath it. This is per-spec top-layer behaviour
  ([whatwg/html#9936](https://github.com/whatwg/html/issues/9936)), and a page
  can't override it. Bitwarden and 1Password detect modal dialogs and work around
  it; iCloud Passwords currently doesn't. Built-in browser autofill (mobile,
  Chrome's own manager, Safari) is native UI and unaffected.
- **`strategy: 'replace'`.** The replaced sheet closes silently — `onExited` fires,
  `onClose` does not. A native close (a `<form method="dialog">` submit, or a
  browser force-close) tears down cleanly and fires both.
- **`overlaySlot` / top layer are `pointer-events: none`.** Interactive children
  portaled into them must set `pointer-events: auto` on themselves.
- **Breakpoint crossing.** The mobile/desktop decision is made once, at `open()`.
  A sheet stays visible across a rotate or split-view change, but the drag gesture
  binds only on open — a sheet opened on desktop and then narrowed isn't draggable
  until it's reopened.
- **Scrollbar compensation.** While open, the sheet reserves the classic
  scrollbar's width as `body` padding so the page doesn't shift. If you'd rather not
  reserve the gap, set `scrollbar-gutter: stable` on `html` — the gap becomes zero
  and nothing is added.

## Browser support

Requires `<dialog>.showModal()`, CSS `scroll-snap`, and `dvh` — Safari 15.4+,
modern Chrome, and Firefox.
