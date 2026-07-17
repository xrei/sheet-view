# API reference

## Anatomy

Compose a sheet by passing **slots** to `open()` — each slot fills one part.

::: code-group

```js [Vanilla]
import {createSheetCore} from 'sheet-view'

const sheets = createSheetCore()

sheets.open({
  title: 'Title', //             header  — title + close button (or use headerSlot)
  content: (ctx) => node, //     content — the scrollable body
  footer: (ctx) => node, //      footer  — pinned actions        (omit → no footer)
  overlaySlot: (ctx) => node, // overlay — decorations that spill past the card edge
})
// every slot receives ctx = { close, update }
```

```tsx [React]
import {SheetHost, sheets} from 'sheet-view/react'

// 1. Mount the host once, near your app root:
function App() {
  return (
    <>
      <YourApp />
      <SheetHost />
    </>
  )
}

// 2. Open sheets imperatively — every slot is a render prop:
sheets.open({
  title: 'Title', //                  header  — title + close button
  content: ({close}) => <Body />, //  content — the scrollable body
  footer: ({close}) => <Actions />, // footer  — pinned actions
  overlaySlot: () => <Badge />, //    overlay — decorations past the card edge
})
```

:::

Those slots render into this DOM — target the `data-sheet-part` hooks (or the
`.sv-sheet__*` classes) for styling:

```html
<dialog class="sv-sheet" data-sheet-state="open">
  <div data-sheet-part="backdrop"></div>  <!-- the dim behind the card -->
  <!-- scroll / spacer / panel: the scroll-snap wrappers that power drag-to-close -->
  <div class="sv-sheet__card">             <!-- the visible surface -->
    <div class="sv-sheet__handle"></div>   <!-- mobile drag pill -->
    <div data-sheet-part="header">…</div>  <!-- title + close, or your headerSlot -->
    <div data-sheet-part="content">…</div> <!-- the scrollable body -->
    <div data-sheet-part="footer">…</div>  <!-- pinned actions -->
    <div data-sheet-part="overlay">…</div> <!-- decorations, free to overflow -->
  </div>
</dialog>
```

## `createSheetCore(options?)`

Creates a framework-agnostic core. Returns `{open, closeAll, subscribe, getSnapshot}`.
`sheet-view` also exports `sheetCore` — a shared singleton core, for an app that only
needs one stack. The React `sheets` facade is bound to it.

| Option         | Type      | Default   | Notes                                                             |
| -------------- | --------- | --------- | ----------------------------------------------------------------- |
| `closeMs`      | `number`  | `320`     | Exit budget for a button/backdrop/Escape/programmatic close.      |
| `dragCloseMs`  | `number`  | `220`     | Exit budget for a drag-close (transform off a frozen scroller).   |
| `openSettleMs` | `number`  | `400`     | Delay after open before drag-to-close arms.                       |
| `breakpoint`   | `number`  | `768`     | Viewport width (px) below which the mobile slide-up layout applies. |
| `zoomLock`     | `boolean` | `false`   | Pins `maximum-scale=1` while open to block iOS focus zoom. Off by default — a WCAG 1.4.4 trade-off. |
| `closeLabel`   | `string`  | `'Close'` | Default accessible label for close buttons in this instance.      |

`closeMs` / `dragCloseMs` should be **≥** your theme's exit-transition durations.

## `open(props)`

Returns a stable `SheetHandle`. All props are optional.

| Prop            | Type                    | Notes                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| `title`         | `string`                | Default-header title (ignored when `headerSlot` is set).     |
| `size`          | `'sm' \| 'md' \| 'lg' \| 'xl'` | Mobile height + desktop width. Default `'lg'`.        |
| `content`       | `SheetSlot`             | The scrollable body.                                         |
| `footer`        | `SheetSlot`             | Pinned footer; collapses when empty.                        |
| `headerSlot`    | `SheetSlot`             | Replaces the default title/close row.                       |
| `overlaySlot`   | `SheetSlot`             | Decorations anchored to the card, free to extend past edges. |
| `focusOnOpen`   | `boolean`               | Autofocus a field; keyboard-safe entrance on mobile.        |
| `ariaLabel`     | `string`                | Accessible name. Without it, the visible `title` names the dialog via `aria-labelledby`. |
| `closeLabel`    | `string`                | Accessible label for the close button. Default `'Close'`.   |
| `closeIcon`     | `SheetSlot`             | Custom glyph/SVG in place of `×` (a11y name stays `closeLabel`). |
| `closeDisabled` | `boolean`               | Blocks X/backdrop/Escape/drag; fires `onCloseAttempt`.      |
| `closeHidden`   | `boolean`               | Omits the default close button (a forced sheet).            |
| `cardClassName` | `string`                | Class(es) on the card element.                              |
| `className`     | `string`                | Class(es) on the **root** dialog.                           |
| `style`         | `Record<string,string>` | Inline styles/tokens on the root — reaches every part.      |
| `key`           | `string`                | Dedupe scope for a singleton sheet.                         |
| `strategy`      | `'reuse' \| 'replace' \| 'update'` | With `key`. Default `'reuse'`.                  |
| `onClose`       | `() => void`            | Fired when a close is requested (not for a blocked/silent close). |
| `onCloseAttempt`| `() => void`            | Fired when a close is blocked by `closeDisabled`.           |
| `onExited`      | `() => void`            | Fired after the exit animation, before DOM removal.         |

`SheetSlot` = `Node | string | null | undefined | ((ctx) => Node | string | null)`,
where `ctx` is `{close, update}`.

### `SheetHandle`

```ts
interface SheetHandle {
  id: number
  close: () => void
  update: (next: Partial<SheetOpenProps>) => void // merges next props into the live sheet
  slots: {header; content; footer; overlay; toplayer} // DOM nodes to portal into
}
```

## React adapter

`sheet-view/react` wraps the core in an imperative facade whose slots accept
`ReactNode`. The adapter ships with `'use client'`, so it works in an RSC / App
Router app as-is.

```ts
import {SheetHost, sheets, createSheets, useSheetTopLayer} from 'sheet-view/react'
```

| Export                | What it is                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `sheets`              | the default facade, bound to the shared `sheetCore`.              |
| `createSheets(core?)` | build your own facade (defaults to a fresh `createSheetCore()`).  |
| `<SheetHost/>`        | mount once; portals slot content into open sheets.                |
| `useSheetTopLayer()`  | the top sheet's `toplayer` node, for toasts above the modal.      |

### `sheets` / `createSheets(core?)` → `Sheets`

| Method        | Notes                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `open(props?)`| opens a sheet; returns a `SheetPublicHandle`. Slots widen to `ReactSlot`.    |
| `closeAll()`  | starts closing every open sheet.                                            |
| `hasLocked()` | `true` while any open sheet has `closeDisabled` — for a `beforeunload` guard. |

`ReactSlot` = `ReactNode | ((ctx) => ReactNode)`, where `ctx` is `{close, update}` —
the same context the vanilla core hands its slot factories.

### `SheetPublicHandle`

```ts
interface SheetPublicHandle {
  id: number
  close: () => void
  update: (next: Partial<SheetReactProps>) => void
}
```

Unlike the vanilla `SheetHandle`, it has **no `slots`** — the adapter owns the portals,
so you never reach for the slot nodes yourself.

### `<SheetHost instance?={sheets} />`

Mount once near the app root. Renders the facade's open sheets, portaling each slot's
`ReactNode` into the core's DOM. `instance` defaults to the shared `sheets`; pass a
`createSheets(...)` facade to render an isolated one.

### `useSheetTopLayer(instance?)` → `HTMLElement | null`

The `toplayer` node of the topmost open sheet, or `null` when none is open. Portal
global overlays (toasts, tooltips) into it so they paint above the modal. Pass an
`instance` to read from a specific facade.

### React specifics

- **`title` with a custom `headerSlot`.** Passing `headerSlot` makes the adapter drop
  `title` — your header fully replaces the default title/close row, so the two can't
  collide.
- **`'aria-label'`** is a deprecated alias for `ariaLabel`, kept only for parity. Use
  `ariaLabel`.

## Notes & limitations

- **Client-only `open()`.** `open()` touches `document`; call it in the browser, not
  during SSR. `<SheetHost>` itself is SSR-safe (renders nothing on the server).
- **Drag-to-dismiss is from the header / grabber.** The content area uses
  `overscroll-behavior: contain`, so scrolling a long body never dismisses the sheet.
  This is deliberate — a long read shouldn't end in an accidental close.
- **iOS keyboard & `100dvh`.** `dvh` doesn't shrink when the keyboard appears, so a
  pinned `footer` can sit behind it while a field is focused. `focusOnOpen` fixes the
  open seam; for a keyboard-following footer, drive it from `visualViewport`.
- **Trigger-button `:hover` on iOS.** iOS applies `:hover` on tap and keeps it until
  another element is tapped — so a swipe-closed sheet leaves its trigger highlighted.
  Gate your own `:hover` styles behind `@media (hover: hover)`; the built-in theme does.
- **Password-manager extensions.** `showModal()` makes everything outside the dialog
  inert — including the autofill dropdowns that extensions inject into the page. The
  dropdown draws above the sheet but can't be clicked; the pointer falls through to
  whatever sits beneath it. This is per-spec top-layer behaviour
  ([whatwg/html#9936](https://github.com/whatwg/html/issues/9936)), and a page can't
  override it. Bitwarden and 1Password detect modal dialogs and work around it;
  iCloud Passwords currently doesn't. Built-in browser autofill (mobile, Chrome's own
  manager, Safari) is native UI and unaffected.
- **`strategy: 'replace'`.** The replaced sheet closes silently — `onExited` fires,
  `onClose` does not. A native close (a `<form method="dialog">` submit, or a browser
  force-close) tears down cleanly and fires both.
- **`overlaySlot` / top layer are `pointer-events: none`.** Interactive children
  portaled into them must set `pointer-events: auto` on themselves.
- **Breakpoint crossing.** The mobile/desktop decision is made once, at `open()`. A
  sheet stays visible across a rotate or split-view change, but the drag gesture binds
  only on open — a sheet opened on desktop and then narrowed isn't draggable until
  it's reopened.
- **Scrollbar compensation.** While open, the sheet reserves the classic scrollbar's
  width as `body` padding so the page doesn't shift. If you'd rather not reserve the
  gap, set `scrollbar-gutter: stable` on `html` — the gap becomes zero and nothing is
  added.
