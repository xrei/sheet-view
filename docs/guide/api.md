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
    <div data-sheet-part="anchor-layer">…</div>   <!-- layers.anchored: dropdowns -->
  </div>
  <div data-sheet-part="toplayer">        <!-- above the card, viewport-fixed -->
    <div data-sheet-part="viewport-layer">…</div> <!-- layers.viewport: toasts -->
  </div>
</dialog>
```

The default header expands to `icon` + `title` + close:

```html
<div data-sheet-part="default-header">
  <span data-sheet-part="icon">…</span>  <!-- your `icon`, collapsed while empty -->
  <h2 data-sheet-part="title">…</h2>
  <button data-sheet-part="close">×</button>
</div>
```

The two layers are where app-authored popovers go — see
[Popovers](./popovers).

## `createSheetCore(options?)`

Creates a framework-agnostic core. Returns `{open, closeAll, subscribe, getSnapshot}`.
`sheet-view` also exports `sheetCore` — a shared singleton core, for an app that only
needs one stack. The React `sheets` facade is bound to it.

| Option         | Type      | Default   | Notes                                                             |
| -------------- | --------- | --------- | ----------------------------------------------------------------- |
| `closeMs`      | `number`  | `320`     | Exit budget for a button/backdrop/Escape/programmatic close.      |
| `dragCloseMs`  | `number`  | `220`     | Exit budget for a drag-close (transform off a frozen scroller).   |
| `enterMs`      | `number`  | `400`     | Mobile entrance duration — the JS mirror of `--sheet-enter-duration`. |
| `openSettleMs` | `number`  | `enterMs` | Delay after open before drag-to-close arms.                       |
| `breakpoint`   | `number`  | `768`     | Viewport width (px) below which the mobile slide-up layout applies. |
| `zoomLock`     | `boolean` | `false`   | Pins `maximum-scale=1` while open to block iOS focus zoom. Off by default — a WCAG 1.4.4 trade-off. |
| `closeLabel`   | `string`  | `'Close'` | Default accessible label for close buttons in this instance.      |

`closeMs` / `dragCloseMs` should be **≥** the exit durations in CSS
(`--sheet-exit-duration`, `--sheet-backdrop-duration`), or a close is cut short.

`enterMs` retunes the entrance from one number: it writes the private
`--_sheet-enter-ms` that `--sheet-enter-duration` falls back to, and it defaults
`openSettleMs` to the same value, so the card slide, the dim fade, and the moment the
drag arms stay in step. Setting the CSS token instead still wins over `enterMs` —
see [Theming → Motion](./theming#motion).

## `open(props)`

Returns a stable `SheetHandle`. All props are optional.

| Prop            | Type                    | Notes                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| `title`         | `string`                | Default-header title (ignored when `headerSlot` is set). **Omit it and no default header is built at all** — and so no close button. |
| `icon`          | `SheetSlot`             | Leading glyph before the title. Requires `title`; ignored with `headerSlot`. Not `aria-hidden` — mark a decorative icon yourself. |
| `size`          | `'sm' \| 'md' \| 'lg' \| 'xl'` | Mobile height + desktop width. Default `'lg'`. Both are tokens — see [Sizing](./theming#sizing). |
| `content`       | `SheetSlot`             | The scrollable body.                                         |
| `footer`        | `SheetSlot`             | Pinned footer; collapses when empty.                        |
| `headerSlot`    | `SheetSlot`             | Replaces the default title/close row.                       |
| `overlaySlot`   | `SheetSlot`             | Decorations anchored to the card, free to extend past edges. |
| `focusOnOpen`   | `boolean`               | Autofocus a field; keyboard-safe entrance on mobile.        |
| `ariaLabel`     | `string`                | Accessible name. Without it the `title` names the dialog — via `aria-labelledby` for the default header, or as `aria-label` when `headerSlot` owns the row. |
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
  slots: {header; icon; content; footer; overlay; toplayer} // DOM nodes to portal into
  layers: {anchored; viewport} // mount points for dropdowns / toasts
  phase: () => 'entering' | 'settled' | 'closing'
  onPhase: (listener: (phase) => void) => () => void // change-only; returns an unsubscribe
}
```

`layers` and `phase` are the popover surface: where to mount a panel, and when
viewport-coordinate measurements are stable. See [Popovers](./popovers).

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
| `<SheetPortal/>`      | mount popovers (dropdowns, toasts) in the right layer.         |
| `useSheetLayout()`    | this sheet's card / scrollers / layers / motion phase.            |
| `useSheetPortalTarget()` | the node to portal into — never `null`. For `container=` props. |
| `useSheetTopLayer()`  | the raw `toplayer` node. Superseded by `useSheetPortalTarget`.     |

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

### `<SheetHost instance?={sheets} onSlotError?={fn} />`

Mount once near the app root. Renders the facade's open sheets, portaling each slot's
`ReactNode` into the core's DOM. `instance` defaults to the shared `sheets`; pass a
`createSheets(...)` facade to render an isolated one.

Each slot is wrapped in its own error boundary. A slot that throws renders nothing and
logs to `console.error`, while the sheet and your app stay mounted — per-slot, so a
crashing `content` still leaves the header's close button usable. `onSlotError(error,
info, slot)` forwards it to your reporter; it does not render a fallback (that is
app-level policy, and the failed slot is simply empty).

### Popovers

`<SheetPortal>`, `useSheetLayout()` and `useSheetPortalTarget()` place app-authored
dropdowns, menus, pickers and toasts inside an open sheet. The library ships the mount
points, the non-clipping guarantee, a paint-order contract and a motion-phase signal —
positioning stays yours, so your floating-ui / Popper / Radix code keeps working.

Full contract, positioning rules and pitfalls: **[Popovers](./popovers)**.

### `useSheetTopLayer(instance?)` → `HTMLElement | null`

The raw `toplayer` node of the topmost open sheet, or `null` when none is open. Prefer
`useSheetPortalTarget({layer: 'viewport'})`: this node is `pointer-events: none`, so
anything portaled in must re-arm pointer events **on the panel itself** — a full-bleed
wrapper that does it disables drag-to-close.

### React specifics

- **`title` with a custom `headerSlot`.** Passing `headerSlot` makes the adapter drop
  `title` from the rendered row — your header fully replaces the default title/close
  row, so the two can't collide. The name is **not** dropped, though: `title` becomes
  the dialog's `aria-label`, so the sheet still has an accessible name. Keep it
  matching the heading you render, or pass `ariaLabel` — a visible name that differs
  from the accessible one is a WCAG 2.5.3 (label in name) failure.
- **Wanting only an icon?** Use `icon`, not `headerSlot`. `headerSlot` costs you the
  close button too — its label, its `aria-disabled` behaviour and its 44×44 hit target
  all become yours to rebuild.
- **`'aria-label'`** is a deprecated alias for `ariaLabel`, kept only for parity. Use
  `ariaLabel`.

## Testing

```ts
import {installDialogShim} from 'sheet-view/testing'

interface InstallDialogShimOptions {
  cancelOnEscape?: boolean // translate an Escape keydown into `cancel`. Default false.
}
interface DialogShim {
  installed: readonly ('open' | 'showModal' | 'show' | 'close')[] // what it patched
  restore: () => void
}
function installDialogShim(options?: InstallDialogShimOptions): DialogShim
```

jsdom ships `HTMLDialogElement` without `showModal()`, `show()` or `close()`, so any
test that opens a sheet throws `showModal is not a function`. Call the shim once in your
setup file:

```js
// vitest.setup.js
import {installDialogShim} from 'sheet-view/testing'

installDialogShim()
```

Idempotent, guarded per member, and a silent no-op in a real browser — so the same setup
file works under vitest browser mode or Playwright too.

**Not emulated, deliberately:** the top layer, focus trapping, `inert`, focus
restoration, `requestClose()`. jsdom can't host those, and faking them produces tests
that pass against a fiction. `close()` dispatches its event synchronously (browsers queue
it), which keeps teardown ordering deterministic.

Escape isn't translated either — dispatch `cancel`, which is what the UA does:

```js
fireEvent(dialog, new Event('cancel', {cancelable: true}))
```

Opt in with `installDialogShim({cancelOnEscape: true})` if you'd rather press Escape. It
treats the last `dialog[open]` as topmost, which is an approximation — jsdom has no
top-layer stack. Call `restore()` if your setup file is shared across suites without
isolation, or its `document` listener leaks.

::: danger Don't hand-roll it
A shim that patches `showModal()` but not `close()` looks fine until the sheet closes:
the core releases its scroll lock on the native `close` event, so without it the page
stays frozen for the rest of the file.
:::

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
- **Third-party overlays the page doesn't own** (password-manager autofill).
  `showModal()` makes everything outside the dialog inert, and an extension injects its
  dropdown into the page, not into your dialog. It draws above the sheet but can't be
  clicked; the pointer falls through to whatever sits beneath it — and if that's the
  dim, the sheet closes. This is per-spec top-layer behaviour
  ([whatwg/html#9936](https://github.com/whatwg/html/issues/9936)), and a page can't
  override it: you cannot move someone else's DOM inside your dialog. Bitwarden and
  1Password detect modal dialogs and work around it; iCloud Passwords currently
  doesn't. Built-in browser autofill (mobile, Chrome's own manager, Safari) is native
  UI and unaffected.

  This is **not** a limit on your own popovers — the rule is only "is the DOM inside
  the `<dialog>`", and your dropdowns are DOM you control. See
  [Popovers](./popovers).
- **`strategy: 'replace'`.** The replaced sheet closes silently — `onExited` fires,
  `onClose` does not. A native close (a `<form method="dialog">` submit, or a browser
  force-close) tears down cleanly and fires both.
- **The raw top layer is `pointer-events: none`.** Children portaled in via
  `useSheetTopLayer()` must re-arm pointer events **on the panel itself** — a
  full-bleed wrapper that does it swallows backdrop-dismiss and drag-to-close.
  `<SheetPortal layer="viewport">` handles it. (`overlaySlot` is unaffected: it is
  `display: contents`, and its children are interactive as-is.)
- **A slot that throws is contained to that slot.** It renders nothing and logs to
  `console.error`; the sheet and your app stay mounted. The slot stays blank until the
  sheet closes — there is no retry. Forward it with `<SheetHost onSlotError>`.
- **Breakpoint crossing.** The mobile/desktop decision is made once, at `open()`. A
  sheet stays visible across a rotate or split-view change, but the drag gesture binds
  only on open — a sheet opened on desktop and then narrowed isn't draggable until
  it's reopened.
- **Scrollbar compensation.** While open, the sheet reserves the classic scrollbar's
  width as `body` padding so the page doesn't shift. If you'd rather not reserve the
  gap, set `scrollbar-gutter: stable` on `html` — the gap becomes zero and nothing is
  added.
