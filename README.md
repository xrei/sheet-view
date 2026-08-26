# sheet-view

[![npm version](https://img.shields.io/npm/v/sheet-view.svg)](https://www.npmjs.com/package/sheet-view)
[![min+gzip](https://img.shields.io/badge/min%2Bgzip-7.8%20kB-brightgreen.svg)](https://bundlephobia.com/package/sheet-view)
[![license](https://img.shields.io/npm/l/sheet-view.svg)](./LICENSE)

A headless bottom-sheet / modal built out of parts the browser already has.
Native `<dialog>.showModal()` gives modality, the focus trap, Escape and focus
restore. CSS `scroll-snap` gives the drag-to-close gesture. `dvh` handles iOS
keyboard sizing. A framework-agnostic **core** owns the DOM and the lifecycle. A
thin **React adapter** portals your content into it.

- **Truly headless** — ship the small required structural stylesheet, add the
  optional default theme, or bring your own CSS. Style it with CSS custom
  properties.
- **Framework-agnostic core** — the vanilla core imports no React at all. The
  React adapter lives at `sheet-view/react`.
- **Native a11y for free** — `showModal()` gives you the focus trap, the inert
  background, Escape handling and focus restore.
- **Tiny** — 7.8 kB min+gzip for the core, 9.5 kB with the React adapter, and no
  runtime dependencies.
- **TypeScript-first** — types ship in the box. ESM only.

## Install

```sh
npm i sheet-view
```

React is an optional peer dependency. Only `sheet-view/react` needs it.

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

A slot takes a `Node`, a `string`, or a `(ctx) => Node | string` function. Run
`pnpm docs:dev` for live demos of the core and the React adapter.

## CSS: required base + optional theme

Positioning and the scroll-snap container need real CSS to work, so the styles
come in two parts:

| Import                  | Required? | What it is                                                             |
| ----------------------- | --------- | ---------------------------------------------------------------------- |
| `sheet-view/base.css`   | **Yes**   | Structure and motion: layout, scroll-snap, sizing, desktop centering, the entrance and exit animations. |
| `sheet-view/theme.css`  | No        | The default skin: surface, radius, shadow, backdrop colour, handle, and so on. |
| `sheet-view/styles.css` | —         | Convenience: `base.css` + `theme.css` in one import.                   |

`base.css` is **unlayered** on purpose. That way a stray utility class in your
app cannot override the rules the gesture depends on. `theme.css` sits inside
`@layer sheet-view`, so your own styles always win over it.

**Motion is in `base.css`, not in the theme.** It is a mechanism, not a skin. The
open path never animates the scroll, because iOS Safari will not animate
`scrollTo()` inside a mandatory-snap scroller. So the CSS keyframes *are* the
entrance, and a sheet with no theme still slides in correctly. The durations are
tokens, so you can retune the motion or turn it off without a specificity fight:
`--sheet-enter-duration: 0s`.

> **Next.js Pages Router:** global CSS may only be imported from `pages/_app.js`
> — import `base.css`/`theme.css` there. The App Router allows importing them
> anywhere.

### Theming with tokens

`theme.css` reads `--sheet-*` custom properties, each with a sensible fallback.
Set any of them on `:root`, on `[data-sheet-part='root']`, or on any ancestor to
restyle the sheet without touching the file. Your values apply in both light and
dark:

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
- **Sizing** (from `base.css`): `--sheet-width-sm|md|lg|xl` (`400/560/800/1000px`,
  desktop), `--sheet-height-sm|md|lg|xl` (`auto/65dvh/…`, mobile),
  `--sheet-inset` (`40px`) and `--sheet-inset-desktop` (`64px`), which are the gap
  kept between the card and the viewport edge, and `--sheet-header-gap` (`16px`).
  There are also `--sheet-width` and `--sheet-height` with **no** suffix. They
  override every bucket at once, and they are the way to set an arbitrary size.
  See [Sizing](https://xrei.github.io/sheet-view/guide/theming#sizing).
- **Skin:** `--sheet-title-size`, `--sheet-title-weight`, `--sheet-close-size`,
  `--sheet-close-radius`, `--sheet-handle-radius`, `--sheet-handle-opacity`,
  `--sheet-header-padding`
- **Motion** (from `base.css`): `--sheet-enter-duration` (`507ms`),
  `--sheet-enter-duration-focus` (75 % of it — the shorter `focusOnOpen` rise),
  `--sheet-exit-duration` (`517ms`), and three easing tokens,
  `--sheet-enter-easing`, `--sheet-exit-easing` and `--sheet-flick-easing`. Each
  easing token is a `cubic-bezier` by default. Every animation is two keyframes
  joined by one of those curves. They are `cubic-bezier` rather than a `linear()`
  stop list because WebKit does not run `linear()` on the compositor. One
  entrance or exit drives the card, the dims and the stacked sheets below on the
  same duration and the same curve.

To style one **instance**, pass `className` or `style` to `open()`. `style` sets
tokens on the root, so it reaches every part — including the backdrop, which a
card class cannot reach:

```js
sheets.open({
  title: 'Filters',
  className: 'promo',
  style: {'--sheet-surface': '#14121c', '--sheet-backdrop': 'rgb(0 0 0 / 0.7)'},
})
```

#### Light & dark

The default skin follows the **host page's** `color-scheme`, not the OS. The
sheet inherits `color-scheme` from your root and picks its palette from that:

- Set `color-scheme: dark` (or `light dark`) on `:root` and the sheet renders
  dark, in step with your page and its native form controls.
- A page that sets nothing (or `color-scheme: light`) gets a light sheet, even on
  a device set to dark.
- Your own `--sheet-*` values always win, in either scheme.

### Styling hooks

Every part of the sheet DOM carries a stable attribute you can target from your
own CSS:

- `[data-sheet-part="root|backdrop|scroll|spacer|panel|card|scrim|handle|header|content|footer|overlay|anchor-layer|toplayer|viewport-layer|default-header|icon|title|close|close-icon"]`
- `[data-sheet-state="opening|open|closing"]` on the root
- `[data-sheet-size="sm|md|lg|xl"]` on the card
- `[data-sheet-focus-open]` on the root — present when the sheet was opened with
  `focusOnOpen`
- `[data-sheet-settled]` on the root — added once the entrance is over and the
  drag is live. That is the moment the dim stops transitioning and starts
  following the finger.
- matching `.sv-sheet__*` classes, if you prefer class selectors

The docs have an anatomy demo that colour-codes each of these parts. Run
`pnpm docs:dev` to see it.

**Stability.** Four surfaces are semver-stable: the `open()` props, the public
`--sheet-*` tokens, the `data-sheet-*` attributes, and the slot nodes. Internal
`--_sheet-*` tokens and the DOM depth between slots may change in any release.

## API

### `sheets.open(props)` → handle

| Prop                            | Type                                       | Notes                                                        |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `key`                           | `string`                                   | Dedupe scope for a singleton sheet.                          |
| `strategy`                      | `'reuse' \| 'replace' \| 'update'`         | Only used with `key`. Default `'reuse'`.                     |
| `title`                         | `string`                                   | Text for the default header (ignored if `headerSlot` is set). **Leave it out and there is no default header at all** — and so no close button. |
| `icon`                          | `ReactNode \| (ctx) => ReactNode`          | Glyph in front of the title. Needs `title`; ignored with `headerSlot`. It is not `aria-hidden`, so mark a decorative icon yourself. |
| `size`                          | `'sm' \| 'md' \| 'lg' \| 'xl'`             | Default `'lg'`. The width and height for each bucket are tokens — see [Sizing](https://xrei.github.io/sheet-view/guide/theming#sizing). |
| `focusOnOpen`                   | `boolean`                                  | A field takes focus on open, so the sheet opens keyboard-safe on mobile. |
| `content` / `headerSlot` / `footer` / `overlaySlot` | `ReactNode \| (ctx) => ReactNode` | Slot content. (`Node \| string \| fn` in the core.)          |
| `closeDisabled`                 | `boolean`                                  | Blocks X, backdrop, Escape and drag; fires `onCloseAttempt` instead. |
| `closeHidden`                   | `boolean`                                  | Leaves the default header's close button out.                |
| `closeLabel`                    | `string`                                   | Accessible label for the close button. Default `'Close'`.    |
| `closeIcon`                     | `ReactNode \| (ctx) => ReactNode`          | Glyph inside the close button, in place of `×`. The button itself stays ours, so you keep the label, `aria-disabled` and the 44×44 hit target. Needs `title`; ignored with `headerSlot` or `closeHidden`. |
| `ariaLabel`                     | `string`                                   | Accessible name. Without it, `title` names the dialog — through `aria-labelledby` for the default header, or as `aria-label` when `headerSlot` owns the row. |
| `cardClassName`                 | `string`                                   | Extra classes on the card.                                   |
| `className`                     | `string`                                   | Class(es) on the **root** dialog.                            |
| `style`                         | `Record<string, string>`                   | Inline styles and tokens on the root — reaches every part.    |
| `onClose` / `onCloseAttempt` / `onExited` | `() => void`                     | Lifecycle callbacks.                                         |

In React, `open()` returns `{id, close(), update(nextProps)}`. The core's
`open()` returns those three plus `slots`, `layers`, `phase()` and `onPhase()`,
which are what an external renderer mounts into.

`close()` closes the sheet even when `closeDisabled` is set — that is the
programmatic override. `update()` merges in new props and re-applies them:
slots, `size`, `cardClassName` and the accessible name.

**Keyed strategies:** `reuse` returns the existing handle and does nothing else;
`replace` closes the old sheet and opens a fresh one; `update` merges the props
into the live sheet.

### Also on `sheets`

- `sheets.closeAll()` — starts closing every open sheet. On the core too.
- `sheets.hasLocked()` — `true` while any open sheet has `closeDisabled`. Handy
  for a `beforeunload` guard. React adapter only.

### `<SheetHost instance?={sheets} onSlotError?={fn} />`

Mount it once at the app root. It portals React slot content into the core's
DOM. If a slot throws, the damage stops there: that slot renders nothing and
logs to `console.error`, while the sheet and your app stay mounted.
`onSlotError(error, info, slot)` is a reporting hook for Sentry. It is not a
place to render a fallback.

### Popovers — `<SheetPortal>`, `useSheetLayout()`, `useSheetPortalTarget()`

For dropdowns, select menus and pickers anchored to a trigger inside a sheet.
`<SheetPortal>` mounts them somewhere they are not clipped, where they ride the
card, and where a click does not dismiss the sheet. `useSheetLayout()` hands you
the nodes to measure and clip against. The library ships no positioning code, so
your floating-ui / Popper / Radix code keeps working.

```jsx
<SheetPortal>
  <div style={{position: 'absolute', top, left}}>…</div>
</SheetPortal>

<SheetPortal layer="viewport">   {/* toasts: above the card, viewport-fixed */}
  <Toast />
</SheetPortal>
```

For the full contract, the positioning rules and the paint-order guarantee, see
**[Popovers](https://xrei.github.io/sheet-view/guide/popovers)**.

### Multiple instances

`createSheetCore(options?)` builds an isolated core. `createSheets(core?)` wraps
one for React, so to tune a React instance you pass a core you made yourself:

```js
const mySheets = createSheets(createSheetCore({closeMs: 300}))
```

`<SheetHost instance={mySheets} />`, `<SheetPortal instance={mySheets}>` and
`useSheetPortalTarget({instance: mySheets})` bind to a specific instance. The
last two only matter outside a slot, because inside one the sheet is already
known from context.

Core options: `closeMs`, `dragCloseMs`, `enterMs`, `openSettleMs`, `breakpoint`,
`zoomLock`, `closeLabel`.

`closeMs` and `dragCloseMs` (both `517`) cover the whole exit. The card's
animation, the promotion of the sheet underneath, and the delay before the DOM is
removed all read the one number, so nothing can drift out of step.

`enterMs` is the JS-side mirror of `--sheet-enter-duration`. It retunes the mobile
entrance *and* the default for `openSettleMs` (when the drag arms) from one
number, so the card and the dim cannot drift apart. A CSS override of the public
token still wins over it. Left unset, both fall back to `507`.

`breakpoint` (default `768`) is the width below which a sheet opens in mobile
mode.

`zoomLock` (default `false`) pins `maximum-scale=1` while a sheet is open. Leave
it off: disabling zoom is a WCAG 1.4.4 failure, and the base theme already stops
iOS focus-zoom by keeping sheet inputs at 16 px or larger.

## Testing

jsdom ships `HTMLDialogElement` without `showModal()`, `show()` or `close()`, so
any test that opens a sheet throws `showModal is not a function`. Install the
shim once, in your setup file:

```js
// vitest.setup.js / jest.setup.js
import {installDialogShim} from 'sheet-view/testing'

installDialogShim()
```

You can call it more than once safely. It checks each member on its own, and it
does nothing at all in a real browser — so the same setup file works under vitest
browser mode or Playwright.

Some things it does **not** emulate, on purpose: the top layer, focus trapping,
`inert`, focus restore and `requestClose()`. jsdom cannot host those, and faking
them gives you tests that pass against a fiction. Escape is not translated
either. Dispatch `cancel` yourself, which is what the browser actually does:

```js
fireEvent(dialog, new Event('cancel', {cancelable: true}))
```

If you would rather press Escape in tests, opt in with
`installDialogShim({cancelOnEscape: true})`. It treats the last `dialog[open]` as
the topmost one, which is only an approximation — jsdom has no top-layer stack.

> **Don't hand-roll this.** A shim that patches `showModal()` but not `close()`
> looks fine until the sheet closes. The core releases its scroll lock on the
> native `close` event, so without it the page stays frozen for the rest of the
> test file.

## Notes & known limitations

- **`open()` is client-only.** `open()` touches `document`, so call it in the
  browser, not during SSR. `<SheetHost>` itself is SSR-safe and renders nothing
  on the server.
- **Drag-to-dismiss starts from the header or the grabber.** The content area
  uses `overscroll-behavior: contain`, so scrolling a long body never dismisses
  the sheet. That is deliberate — a long read should not end in an accidental
  close.
- **iOS keyboard and `100dvh`.** `dvh` does not shrink when the keyboard appears,
  so a pinned `footer` can end up behind it while a field has focus.
  `focusOnOpen` fixes the moment of opening. For a footer that follows the
  keyboard, drive it from `visualViewport`.
- **Trigger-button `:hover` on iOS.** iOS applies `:hover` on tap and keeps it
  until you tap another element. So a swipe-closed sheet leaves the button that
  opened it highlighted, and tapping empty space does not clear it. Put your own
  `:hover` styles behind `@media (hover: hover)`; the built-in theme already does.
- **Overlays the page does not own** (password-manager autofill).
  `showModal()` makes everything outside the dialog inert, and an extension
  injects its dropdown into the page, not into your dialog. It draws above the
  sheet but cannot be clicked. The pointer falls through to whatever sits
  beneath it, and if that is the dim, the sheet closes. This is how the top layer
  is specified ([whatwg/html#9936](https://github.com/whatwg/html/issues/9936)),
  and a page cannot override it: you cannot move someone else's DOM inside your
  dialog. Some password managers detect a modal dialog and work around it, others
  do not. The browser's own built-in autofill (mobile, Chrome's manager, Safari)
  is native UI and is not affected.

  **This is not a limit on your own popovers.** The only rule is "is the DOM
  inside the `<dialog>`", and your dropdowns are DOM you control. Mount them with
  `<SheetPortal>` and they paint above the card, stay clickable, and do not
  dismiss the sheet. See
  [Popovers](https://xrei.github.io/sheet-view/guide/popovers).
- **`strategy: 'replace'`.** The replaced sheet closes silently: `onExited`
  fires, `onClose` does not. A native close — a `<form method="dialog">` submit,
  or a browser force-close — tears down cleanly and fires both.
- **The raw top layer is `pointer-events: none`.** You only reach it by going
  around the mount points and appending to `slots.toplayer` yourself. Children
  there must set `pointer-events: auto` **on the panel itself**. A full-bleed
  wrapper that does it instead swallows backdrop-dismiss and drag-to-close.
  `<SheetPortal layer="viewport">` and `layers.viewport` handle this for you.
  (`overlaySlot` is not affected: it is `display: contents`, so its children are
  interactive as they are.)
- **A slot that throws is contained to that slot.** It renders nothing and logs
  to `console.error`. The sheet and the rest of your app stay mounted, so the
  default header's close button still works. That slot stays blank until the
  sheet closes — there is no retry. Pass `onSlotError` to `<SheetHost>` to
  forward it to Sentry.
- **Crossing the breakpoint.** The mobile/desktop decision is made once, at
  `open()`. A sheet stays visible through a rotate or a split-view change, but
  the drag gesture only binds on open. A sheet opened on desktop and then
  narrowed is not draggable until you reopen it.
- **Scrollbar compensation.** While a sheet is open, it reserves the width of the
  classic scrollbar as `body` padding, so the page does not shift. If you would
  rather not reserve that gap, set `scrollbar-gutter: stable` on `html`. The gap
  measures as zero and nothing is added.

## Browser support

All modern browsers with `<dialog>.showModal()` and CSS `scroll-snap`.
