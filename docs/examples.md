# Live demos

Every demo runs the real built package. Each panel is one small source file, shown
whole below its preview. The basics live here; stacks, rewrites and popovers are
on [Complex examples](./complex).

## Anatomy

One sheet with every structural part colour-coded, so you can see the pieces before
wiring one up.

<AnatomyDemo />

## Vanilla

The framework-agnostic core on plain DOM — no React, no framework at all.

### Basic

<DemoPanel>
<template #preview>

<VanillaDemo demo="basic" />

</template>

<<< ../examples/vanilla/demos/basic.js

</DemoPanel>

### Themed

Per-instance theming: `style` sets `--sheet-*` tokens on the root, so they reach
every part — including the backdrop, which a card class can't reach.

<DemoPanel>
<template #preview>

<VanillaDemo demo="themed" />

</template>

<<< ../examples/vanilla/demos/themed.js

</DemoPanel>

## React

The `sheet-view/react` adapter — `createSheets()` plus `<SheetHost/>`, slots widened
to `ReactNode`.

### Basic

<DemoPanel>
<template #preview>

<ReactDemo demo="basic" />

</template>

<<< ../examples/react/src/demos/Basic.tsx

</DemoPanel>

### Footer

A pinned footer over a scrolling body, plus both default-header glyphs supplied as
plain JSX — `icon` before the title and `closeIcon` inside the close button. The button
itself stays library-owned, so its label, its disabled state and its 44×44 hit target
come for free.

<DemoPanel>
<template #preview>

<ReactDemo demo="footer" />

</template>

<<< ../examples/react/src/demos/Footer.tsx

</DemoPanel>

### Form & native controls

A real `<form>` inside the modal sheet, and the library is not involved at any
point. `autocomplete` attributes let password managers offer autofill;
`focusOnOpen` keeps the entrance keyboard-safe on mobile while the email field
autofocuses. The `<select>` and date popups are OS-rendered, so the modal top
layer doesn't apply to them — no portalling, no positioning code. Built-in
browser autofill works; extension-injected dropdowns can't be clicked over a
modal dialog — see [Notes & limitations](/guide/api#notes-limitations).

<DemoPanel>
<template #preview>

<ReactDemo demo="form" />

</template>

<<< ../examples/react/src/demos/Form.tsx

</DemoPanel>

Everything past the basics — [Complex examples](./complex): stacked sheets,
keyed re-opens, in-place rewrites, anchored dropdowns, and a toast above the
modal.
