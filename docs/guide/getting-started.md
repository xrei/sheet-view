# Getting started

`sheet-view` is a headless bottom-sheet / modal built on the native `<dialog>`
element and CSS scroll-snap. The core is framework-agnostic; a thin React adapter
ships at `sheet-view/react`.

## Install

```sh
npm i sheet-view
```

## Styles

Positioning and the scroll-snap container need real CSS to work, so the styles come
in two parts — a small required structural sheet and an optional default skin:

```js
import 'sheet-view/base.css' // REQUIRED — structure (layout, scroll-snap, sizing)
import 'sheet-view/theme.css' // OPTIONAL — the default skin (colours, radius, shadow)
```

- `base.css` is deliberately **unlayered** so its gesture-critical rules can't be
  overridden by a stray utility class.
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
| `useSheetTopLayer()` | `sheet-view/react` | the node above the top sheet, for toasts |

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

`open()` returns a handle: `{id, close, update, slots}`. Slots accept a DOM node, a
string, or a factory `(ctx) => node` receiving `{close, update}`.

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

Slots widen to `ReactNode`; everything else (`title`, `size`, `closeLabel`, …) is the
same as the vanilla core.

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
