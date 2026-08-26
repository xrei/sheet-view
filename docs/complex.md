# Complex examples

The edge cases: deep stacks, keyed re-opens, in-place rewrites and popovers inside
the modal top layer. Every demo runs the real built package; each panel is one small
source file, shown whole below its preview.

## Stacked sheets

`open()` is a push — each call opens a new sheet over the current one, to any depth.
The stacking is the native `showModal()` top layer, so it needs no z-index and no
coordination: the top sheet holds the focus trap, Escape closes it alone, focus
returns to the button that opened it, and the sheets underneath stay inert until
they're on top again.

Rendering keeps a bounded deck: the covered card recedes behind the top sheet with
a strip of it peeking above, the one below that parks fully occluded, and
everything deeper keeps its state but stops painting its card — a frame costs the
same at depth 12 as at depth 2. Dragging the top sheet reveals the cards beneath
in real time. Each dim is bounded by the card it shades — one dim over the page,
one over each visible card — so the shade stays constant however deep the stack
goes, and never piles up toward black.
The depth cap in this demo is a UX choice, not a performance one; see
[`data-sheet-stack`](./guide/api#notes-limitations).

<DemoPanel>
<template #preview>

<ReactDemo demo="stacked" />

</template>

<<< ../examples/react/src/demos/Stacked.tsx

</DemoPanel>

## Keyed + update

<DemoPanel>
<template #preview>

<ReactDemo demo="keyed" />

</template>

<<< ../examples/react/src/demos/KeyedUpdate.tsx

</DemoPanel>

## Rewrite an open sheet

The `{update}` ctx (or the handle's `update()`) merges new props into the open
sheet in place: title, size, per-instance tokens, even the whole body — same
dialog, no re-entrance animation.

<DemoPanel>
<template #preview>

<ReactDemo demo="rewrite" />

</template>

<<< ../examples/react/src/demos/Rewrite.tsx

</DemoPanel>

## Anchored dropdown

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

## Toast above the sheet

`<SheetPortal layer="viewport">` puts a toast in the sheet's top layer, above the
modal — and keeps backdrop-dismiss and drag-to-close working underneath it.

<DemoPanel>
<template #preview>

<ReactDemo demo="toast" />

</template>

<<< ../examples/react/src/demos/TopLayerToast.tsx

</DemoPanel>
