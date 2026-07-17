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

### Toast above the sheet

`useSheetTopLayer()` returns the top sheet's top-layer node — portal a toast into it
and it paints above the modal.

<DemoPanel>
<template #preview>

<ReactDemo demo="toast" />

</template>

<<< ../examples/react/src/demos/TopLayerToast.tsx

</DemoPanel>
