# Theming

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

## Tokens

- **Colours:** `--sheet-surface`, `--sheet-text`, `--sheet-handle`, `--sheet-border`,
  `--sheet-border-subtle`, `--sheet-hover`, `--sheet-backdrop`
- **Geometry:** `--sheet-radius`, `--sheet-radius-desktop`, `--sheet-shadow`,
  `--sheet-shadow-mobile`, `--sheet-backdrop-blur`
- **Skin:** `--sheet-title-size`, `--sheet-title-weight`, `--sheet-close-size`,
  `--sheet-close-radius`, `--sheet-handle-radius`, `--sheet-handle-opacity`,
  `--sheet-header-padding`
- **Motion** (defined in `base.css`): `--sheet-enter-duration`,
  `--sheet-enter-easing`, `--sheet-enter-duration-focus`, `--sheet-exit-duration`,
  `--sheet-backdrop-duration`
- **Sizing** (defined in `base.css`): `--sheet-width`, `--sheet-width-sm|md|lg|xl`,
  `--sheet-height`, `--sheet-height-sm|md|lg|xl`, `--sheet-inset`,
  `--sheet-inset-desktop`, `--sheet-header-gap`

## Sizing

`size` picks a bucket; the bucket's dimensions are tokens. Like motion, they live in the
**required** `base.css` — a sheet's dimensions are structural, not a skin.

| Token                    | Default                     | Drives                                     |
| ------------------------ | --------------------------- | ------------------------------------------ |
| `--sheet-width-sm`       | `400px`                     | Desktop card width, `size: 'sm'`           |
| `--sheet-width-md`       | `560px`                     | Desktop card width, `size: 'md'`           |
| `--sheet-width-lg`       | `800px`                     | Desktop card width, `size: 'lg'`           |
| `--sheet-width-xl`       | `1000px`                    | Desktop card width, `size: 'xl'`           |
| `--sheet-height-sm`      | `auto`                      | Mobile card height, `size: 'sm'`           |
| `--sheet-height-md`      | `65dvh`                     | Mobile card height, `size: 'md'`           |
| `--sheet-height-lg`      | `100dvh − --sheet-inset`    | Mobile card height, `size: 'lg'`           |
| `--sheet-height-xl`      | `100dvh − --sheet-inset`    | Mobile card height, `size: 'xl'`           |
| `--sheet-inset`          | `40px`                      | Mobile gap above the card (its max-height) |
| `--sheet-inset-desktop`  | `64px`                      | Desktop gap around the card (max width **and** height) |
| `--sheet-header-gap`     | `16px`                      | Default-header row gap: icon↔title↔close   |

Every width is clamped to `100vw − --sheet-inset-desktop`, and every mobile height to
`100dvh − --sheet-inset`, **inside the library**. Override the token and you keep the
clamp — which is the part that's easy to forget and breaks narrow desktop windows.

### An arbitrary size

`--sheet-width` and `--sheet-height`, with no suffix, sit in front of all four buckets:

```css
:root {
  --sheet-width: 672px; /* every desktop sheet, whatever its `size` */
}
```

::: warning These override every bucket
Once `--sheet-width` is set, all four `size` values render at that width, and `size` only
carries the mobile height (and vice-versa for `--sheet-height`). That's deliberate — it's
what stops `size: 'sm'` from degenerating into a meaningless carrier for a width
override — but it does mean the two are not per-bucket knobs.
:::

Per sheet, pass them through `style` — it applies to the root dialog, and custom
properties inherit down to the card:

```js
sheets.open({
  title: 'Wide report',
  size: 'md', // still picks the mobile height
  style: {'--sheet-width': '1180px'},
})
```

A full-bleed mobile sheet is one token:

```css
:root {
  --sheet-inset: 0px; /* card fills the viewport height on mobile */
}
```

## Motion

Motion lives in the **required** `base.css`, not in the optional theme — it's a
mechanism, not a skin. The open path deliberately never animates the scroll (iOS
Safari won't animate `scrollTo()` inside a `scroll-snap-type: mandatory` scroller —
it jumps), so the scroller opens *at* its resting snap point and the CSS keyframes
are the entrance. A sheet with `base.css` alone still slides in correctly.

| Token                          | Default                          | Drives                                        |
| ------------------------------ | -------------------------------- | --------------------------------------------- |
| `--sheet-enter-duration`       | `400ms`                          | Mobile card slide-up **and** the dim's fade-in |
| `--sheet-enter-easing`         | `cubic-bezier(0.32, 0.72, 0, 1)` | The slide-up curve                            |
| `--sheet-enter-duration-focus` | 75 % of the enter duration       | The shorter `focusOnOpen` rise-in             |
| `--sheet-exit-duration`        | `250ms`                          | Desktop card exit **and** the mobile dim's fade-out |
| `--sheet-backdrop-duration`    | `250ms`                          | Desktop dim fade                              |

```css
:root {
  --sheet-enter-duration: 0s; /* no entrance at all */
}
```

On **mobile the exit is a scroll**, not a transition: the snap container glides back
to its closed point, on a timeline the browser owns. Only the dim is declarable there,
so it fades over `--sheet-exit-duration` — keep `closeMs` **≥** that, or the sheet is
removed mid-fade. A drag-close is the exception: it takes the card off the scroller and
runs card + dim on one `dragCloseMs` timeline.

The card and the dim read the same token, so they can't drift apart. From JS, use the
core's [`enterMs`](./api#createsheetcore-options) option instead of the token — it
also defaults `openSettleMs` (when the drag arms) to the same number. It's written as
a private inline fallback, so a CSS override of `--sheet-enter-duration` still wins.

`prefers-reduced-motion: reduce` replaces the slide/rise with a 200 ms cross-fade
(the sheet still appears — it just doesn't travel). Your token overrides are still
honoured there; `enterMs` deliberately isn't, so an app can't animate over the user's
preference.

## Per-instance overrides

Pass `className` / `style` to `open()`. `style` sets tokens on the root dialog, so it
reaches every part — including the backdrop, which a card class can't reach:

```js
sheets.open({
  title: 'Filters',
  className: 'promo',
  style: {'--sheet-surface': '#14121c', '--sheet-backdrop': 'rgb(0 0 0 / 0.7)'},
})
```

## Light & dark

The default skin follows the **host page's** `color-scheme`, not the OS — the sheet
inherits `color-scheme` from your root and resolves its palette against it:

- Declare `color-scheme: dark` (or `light dark`) on `:root` and the sheet renders dark,
  in step with your page and its native form controls.
- A page that declares nothing (or `color-scheme: light`) gets a light sheet, even on a
  device set to dark.
- Your own `--sheet-*` overrides always win, in either scheme.

::: warning Old browsers
On browsers without CSS `light-dark()` (Safari &lt;17.5, Chrome &lt;123, Firefox &lt;120)
the palette falls back to the OS `prefers-color-scheme`, so a light page on a dark
device can still get a dark sheet. Set `color-scheme` explicitly, or override the
tokens, to pin the palette.
:::

## Styling hooks

Every part of the sheet DOM carries a stable attribute you can target from your CSS:

- `[data-sheet-part="root|backdrop|scroll|spacer|panel|card|handle|header|content|footer|overlay|anchor-layer|toplayer|viewport-layer|default-header|icon|title|close"]`
- `[data-sheet-state="opening|open|closing"]` on the root
- `[data-sheet-size="sm|md|lg|xl"]` on the card
- `[data-sheet-focus-open]` on the root — present when opened with `focusOnOpen`
- `[data-sheet-settled]` on the root — set once the entrance is over and the drag is
  live (when the dim stops transitioning and starts tracking the finger)
- mirrored `.sv-sheet__*` classes, if you prefer class selectors

## Stability

Four surfaces are semver-stable: the `open()` props, the public `--sheet-*` tokens,
the `data-sheet-*` attributes, and the slot nodes. Internal `--_sheet-*` tokens and the
DOM depth between slots may change in any release.
