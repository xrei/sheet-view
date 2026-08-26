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
  `--sheet-exit-easing`, `--sheet-flick-easing`
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

Both entrances are CSS **animations**, not state-driven transitions, and the card and
the dim share one animation on one token. That is deliberate: a transition needs a
before-change style, so it can only start on the frame *after* JS stamps
`data-sheet-state="open"` — enough for the surface to land visibly ahead of its dim.
Both widths slide the card up: a viewport on mobile, and on desktop exactly far
enough that the centred card starts with its top edge on the bottom edge of the
screen. Nested sheets travel the same distance as the first one. The dim fades in
beside it, and a desktop card never changes opacity — a nested one would show the
card below straight through itself.

Two things keep that motion on the compositor: the card declares
`will-change: transform`, so its layer is not created during the first frame of
the animation, and the theme's backdrop blur is not gated on the open state,
which lands one frame *into* the entrance and made the compositor rebuild the
backdrop's render surface mid-flight. If a large window on a weak GPU still drops
frames, `--sheet-backdrop-blur: 0px` removes the most expensive thing the theme
does.

| Token                          | Default                     | Drives                                        |
| ------------------------------ | --------------------------- | --------------------------------------------- |
| `--sheet-enter-duration`       | `507ms`                     | Every entrance: card, dim, and the recede of the sheet below — one timeline |
| `--sheet-enter-easing`         | `cubic-bezier(0.3, 0.54, 0.05, 0.995)` | The entrance curve, and the one a desktop exit rides back out on |
| `--sheet-enter-duration-focus` | 75 % of the enter duration  | The shorter `focusOnOpen` rise-in             |
| `--sheet-exit-duration`        | `517ms`                     | The exit rules still declared in CSS: the reduced-motion dim, and a nested backdrop taking over the page dim. The card and its dim leave on `closeMs` |
| `--sheet-exit-easing`          | `cubic-bezier(0.295, 0.46, 0.06, 0.99)` | Every mobile departure: the exit, the snap-back, and those same CSS rules |
| `--sheet-flick-easing`         | `cubic-bezier(0.32, 0.73, 0.04, 1)` | The same, for a fast release (≥1 px/ms) in either direction |

Durations are the whole flight, tail included — the visible motion is over well
before the number is up, so these read longer than the animation feels. The odd
values are the ones that were tuned on hardware, not round numbers someone
picked.

**Every animation is two keyframes joined by one of these curves** — a start
pose, an end pose, and a timing function that carries the entire shape between
them. `@keyframes sv-sheet-rise` / `sv-sheet-fade` here, `element.animate()` in
the core for anything with a distance only JS knows. The curves are
`cubic-bezier` rather than a `linear()` stop list, and that is not a style
choice: WebKit does not run `linear()` timing functions on the compositor, so a
motion written that way ticks on the main thread behind your app's renders and
visibly stutters (Blink accelerates both, so it looks fine in Chrome). Override
a token to swap the curve; override the keyframes to change the poses.

Every control point of all three curves sits inside the unit square, so none of
them can leave `[0, 1]`. A card cannot travel past its resting line and come
back, and a dim cannot be asked for opacity `1.02`. If you replace a token, a
curve that reaches outside that box is what puts a bounce in.

`--sheet-exit-duration` is a **duration, not a speed**: every departure takes it
in full, whether the card has 60 px left to travel or 820. The speed is what
varies, proportionally, and the sheet always takes the same time to come to
rest.

```css
:root {
  --sheet-enter-duration: 0s; /* no entrance at all */
}
```

**Every exit is JS, on both widths**, card + dim on one duration and one curve.
Mobile takes the card off the scroller and slides it out on a transform; desktop
slides it off the bottom edge, back down the distance it rose through. A button
close, a backdrop press, a drag-commit and the snap-back all run the identical
mechanism on the identical clock. Distance decides how *fast* it goes, never how
*long* it takes. Release momentum picks the *curve* and the destination: a fast
release (≥1 px/ms) moves one position in its direction of travel and rides
`--sheet-flick-easing`, which is stiffer at the start, so a flick is further
along at the same instant. It differs from a slow release by pace, never by
duration.

The exit cannot be a CSS transition, and that is not a preference either: a
transition never starts on a property a CSS **animation** is currently animating,
and the entrance is exactly that. A close inside the entrance window got the half
of the exit the entrance wasn't touching and none of the rest, so the same click
played two different exits depending on how long the sheet had been open.

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

## Styling hooks

Every part of the sheet DOM carries a stable attribute you can target from your CSS:

- `[data-sheet-part="root|backdrop|scroll|spacer|panel|card|scrim|handle|header|content|footer|overlay|anchor-layer|toplayer|viewport-layer|default-header|icon|title|close|close-icon"]`
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
