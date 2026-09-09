# Getting started

`sheet-view` is a headless bottom-sheet / modal built on the native `<dialog>`
element and CSS scroll-snap. The core is framework-agnostic; a thin React adapter
ships at `sheet-view/react`.

## Install

```sh
npm i sheet-view
```

## No bundler (plain HTML, CDN)

Nothing in `dist/` reads a host global. Every entry point loads as-is: from a
`<script type="module">`, from a CDN, and in bare Node, Deno, Bun and edge
runtimes.

`dist/sheet-view.min.js` is the core in one self-contained file, with nothing
left to resolve:

```html
<!-- REQUIRED: structure and motion -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sheet-view/dist/base.css" />
<!-- OPTIONAL: the default skin -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sheet-view/dist/theme.css" />

<script type="module">
  import {sheetCore} from 'https://cdn.jsdelivr.net/npm/sheet-view/dist/sheet-view.min.js'

  sheetCore.open({title: 'Hello', size: 'sm', content: () => 'A plain-DOM sheet body.'})
</script>
```

Swap the URL for `./node_modules/sheet-view/dist/sheet-view.min.js` to serve your
own copy, and pin a version (`sheet-view@<version>`) for anything real.
`dist/sheet-view.js` is the same build unminified.

The standalone carries the core alone. `sheet-view/react` imports bare `react`,
`react-dom` and `react/jsx-runtime`, which over a CDN needs an
[import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap).

::: warning Load it one way only
The locks nest across copies by design, but two copies still mean two
independent sheet stacks. Pick the standalone file or the bundled import.
:::

## Styles

Positioning and the scroll-snap container need real CSS to work, so the styles come
in two parts — a small required structural sheet and an optional default skin:

```js
import 'sheet-view/base.css' // REQUIRED — structure + motion (layout, scroll-snap, animations)
import 'sheet-view/theme.css' // OPTIONAL — the default skin (colours, radius, shadow)
```

- `base.css` is deliberately **unlayered** so its gesture-critical rules can't be
  overridden by a stray utility class. It also owns the **motion**: the entrance is a
  mechanism, not a skin, so a themeless sheet still slides in — retune it with
  [motion tokens](./theming#motion).
- `theme.css` is wrapped in `@layer sheet-view` so your own styles always win.
- `sheet-view/styles.css` imports both in one line.

> **Next.js Pages Router:** global CSS may only be imported from `pages/_app.js`.
> The App Router allows importing it anywhere.

## The two layers

`sheet-view` exports the **engine**: `createSheetCore()` for your own instance, plus a
shared `sheetCore` singleton. `sheet-view/react` wraps that engine in a **facade** that
widens slots to `ReactNode` — `sheets` is ready to use over the shared core, and
`createSheets(core?)` builds your own.

| Import | From | What it is |
| --- | --- | --- |
| `createSheetCore(options?)` | `sheet-view` | the engine — your own instance, with options |
| `sheetCore` | `sheet-view` | the shared engine singleton |
| `sheets` | `sheet-view/react` | ready-made facade over `sheetCore` |
| `createSheets(core?)` | `sheet-view/react` | your own facade (an isolated sheet stack) |
| `<SheetHost instance={…}/>` | `sheet-view/react` | renders a facade's sheets; omit `instance` for the default `sheets` |
| `<SheetPortal/>` | `sheet-view/react` | mounts popovers (dropdowns, toasts) in the right layer |
| `useSheetLayout()` | `sheet-view/react` | this sheet's card / scrollers / layers / motion phase |
| `useSheetPortalTarget()` | `sheet-view/react` | the node to portal into — never `null` |
| `installDialogShim()` | `sheet-view/testing` | makes `<dialog>` work under jsdom, for tests |

## Vanilla

```js
import {createSheetCore} from 'sheet-view'

const sheets = createSheetCore()

sheets.open({
  title: 'Hello',
  content: () => {
    const p = document.createElement('p')
    p.textContent = 'Drag me down, press Escape, or click the backdrop.'
    return p
  },
})
```

`open()` returns a handle: `{id, close, update, slots, layers, phase, onPhase}`.
Slots accept a DOM node, a string, or a factory `(ctx) => node` receiving
`{close, update}`.

## React

Mount `<SheetHost/>` once near the root, then drive it imperatively:

```tsx
import {SheetHost, sheets} from 'sheet-view/react'
import 'sheet-view/styles.css'

export function App() {
  return (
    <>
      <button onClick={() => sheets.open({title: 'Hello', content: <p>Hi there</p>})}>
        Open
      </button>
      <SheetHost />
    </>
  )
}
```

All six slots — `headerSlot`, `icon`, `closeIcon`, `content`, `footer`, `overlaySlot` —
widen to `ReactNode`. Everything else (`title`, `size`, `closeLabel`, …) is the same as
the vanilla core.

## Isolated instances

The default `sheets` facade is enough for most apps. Create your own when you need
custom timings or a different breakpoint, or to isolate a micro-frontend: `createSheets`
takes a core you build with `createSheetCore`, and `<SheetHost instance={…}/>` renders it:

```tsx
import {createSheetCore} from 'sheet-view'
import {createSheets, SheetHost} from 'sheet-view/react'

const mySheets = createSheets(createSheetCore({closeMs: 400, breakpoint: 640}))

function App() {
  return (
    <>
      <YourApp />
      <SheetHost instance={mySheets} />
    </>
  )
}

// open from anywhere, against your own stack:
mySheets.open({title: 'Filters', content: <Filters />})
```

Next: [Theming](/guide/theming) · [API reference](/guide/api) · [Live demos](/examples).
