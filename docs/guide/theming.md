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

- `[data-sheet-part="root|backdrop|scroll|panel|card|handle|header|content|footer|overlay|toplayer|default-header|title|close"]`
- `[data-sheet-state="opening|open|closing"]` on the root
- `[data-sheet-size="sm|md|lg|xl"]` on the card
- `[data-sheet-focus-open]` on the root — present when opened with `focusOnOpen`
- mirrored `.sv-sheet__*` classes, if you prefer class selectors

## Stability

Four surfaces are semver-stable: the `open()` props, the public `--sheet-*` tokens,
the `data-sheet-*` attributes, and the slot nodes. Internal `--_sheet-*` tokens and the
DOM depth between slots may change in any release.
