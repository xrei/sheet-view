# Live demos

Every demo runs the real built package. Each panel is one small source file, shown
whole below its preview.

## Anatomy

One sheet with every structural part colour-coded, so you can see the pieces before
wiring one up.

<AnatomyDemo />

## Vanilla

The framework-agnostic core on plain DOM — no React, no bundler.

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

### Form & autofill

A real `<form>` with `autocomplete` attributes, so password managers can offer
autofill inside the modal sheet. `focusOnOpen` keeps the entrance keyboard-safe
on mobile while the email field autofocuses. Built-in browser autofill works;
extension-injected dropdowns can't be clicked over a modal dialog — see
[Notes & limitations](/guide/api#notes-limitations).

<DemoPanel>
<template #preview>

<ReactDemo demo="form" />

</template>

<<< ../examples/react/src/demos/Form.tsx

</DemoPanel>

### Forced

A `closeDisabled` sheet: the X, backdrop, Escape, and drag are all blocked.

<DemoPanel>
<template #preview>

<ReactDemo demo="forced" />

</template>

<<< ../examples/react/src/demos/Forced.tsx

</DemoPanel>

### Keyed + update

<DemoPanel>
<template #preview>

<ReactDemo demo="keyed" />

</template>

<<< ../examples/react/src/demos/KeyedUpdate.tsx

</DemoPanel>

### Stacked sheets

`open()` is a push — each call opens a new sheet over the current one, to any depth.
The stacking is the native `showModal()` top layer, so it needs no z-index and no
coordination: the top sheet holds the focus trap, Escape closes it alone, focus
returns to the button that opened it, and the sheets underneath stay inert until
they're on top again.

<DemoPanel>
<template #preview>

<ReactDemo demo="stacked" />

</template>

<<< ../examples/react/src/demos/Stacked.tsx

</DemoPanel>

### Rewrite an open sheet

The `{update}` ctx (or the handle's `update()`) merges new props into the open
sheet in place: title, size, per-instance tokens, even the whole body — same
dialog, no re-entrance animation.

<DemoPanel>
<template #preview>

<ReactDemo demo="rewrite" />

</template>

<<< ../examples/react/src/demos/Rewrite.tsx

</DemoPanel>

### Anchored dropdown

A panel anchored to a trigger inside the scrolling body. `<SheetPortal>` mounts it in
the card's anchor layer, so it escapes the body's clip, follows the card through the
entrance and the drag, and selecting an option doesn't dismiss the sheet. Positioning
is the app's — this one uses ~20 lines of `getBoundingClientRect`; use a positioning library in
a real app. See [Popovers](./guide/popovers).

<DemoPanel>
<template #preview>

<ReactDemo demo="anchored" />

</template>

<<< ../examples/react/src/demos/AnchoredSelect.tsx

</DemoPanel>

### Native controls

`<select>`, date inputs and datalists need nothing from the library — their popups are
OS-rendered, so the modal top layer doesn't apply to them.

<DemoPanel>
<template #preview>

<ReactDemo demo="native" />

</template>

<<< ../examples/react/src/demos/NativeControls.tsx

</DemoPanel>

### Toast above the sheet

`<SheetPortal layer="viewport">` puts a toast in the sheet's top layer, above the
modal — and keeps backdrop-dismiss and drag-to-close working underneath it.

<DemoPanel>
<template #preview>

<ReactDemo demo="toast" />

</template>

<<< ../examples/react/src/demos/TopLayerToast.tsx

</DemoPanel>
