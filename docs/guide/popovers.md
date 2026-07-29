# Popovers inside a sheet

Dropdowns, select menus, date pickers, autocomplete panels, tooltips, context menus —
anything anchored to a trigger inside a sheet. This page is the contract: where to
mount it, what the library guarantees, and what stays yours.

## The one rule

A sheet is a native `<dialog>` opened with `showModal()`, which makes **everything
outside the dialog inert**. So whether a popover works over a sheet has nothing to do
with it being a dropdown, and everything to do with one question:

> **Is its DOM inside the `<dialog>`?**

Inside: it paints above the card, it is clickable, it is focusable. Outside — anything
portaled to `document.body`, for instance — it is inert, and no amount of `z-index`
changes that.

Your own popovers are DOM you control, so you get to choose. The library gives you the
nodes to choose from. (The case a page genuinely cannot fix is UI it does *not* own, such
as a password manager's injected autofill — see
[third-party overlays](./api#notes-limitations).)

## Choosing a layer

```js
import {SheetPortal} from 'sheet-view/react'
```

**1. Anchored to something inside the sheet** — a select, a combobox, a picker, a
tooltip on a field. Use the default layer:

```jsx
<SheetPortal>
  <div style={{position: 'absolute', top, left}}>…</div>
</SheetPortal>
```

It mounts inside the card. That buys you three things at once: it is **unclipped** (the
card has no `overflow`, deliberately), it **rides the card** through the entrance, a
drag-to-close and the exit — so there is nothing to reposition during any of them — and a
click in it **never dismisses the sheet**.

**2. Anchored to the viewport** — toasts, a command palette, a nested confirm:

```jsx
<SheetPortal layer="viewport">
  <div style={{position: 'fixed', top: 16}}>…</div>
</SheetPortal>
```

It mounts in the sheet's top layer: above the card, viewport-fixed, and it does not
follow the card.

**3. Never use `position: fixed` inside the card.** The card is a fixed-positioning
containing block *only while it is animating*, so a fixed descendant re-resolves its
coordinates when the entrance ends and visibly jumps. Use layer 2 instead.

**4. The `popover` attribute is not recommended.** A `[popover]` element inside the dialog does work — it is in
the top layer and it is not inert — but it needs Safari 17 where the library's floor is
15.4, and it buys nothing over layer 2.

::: warning Children must be positioned
Both layers are `display: contents` — they generate no box, which is what stops them
swallowing backdrop-dismiss and drag-to-close. A *statically* positioned child therefore
becomes a flex item of the card and adds a row to it. Give your panel `position:
absolute` (layer 1) or `fixed` (layer 2).
:::

## Positioning is yours

The library ships no positioning: no `placement`, no flip logic, no dependency. Your
existing floating-ui / Popper / Radix / Downshift code works inside a sheet — that is the
point. What the library owes you is the mount point, the non-clipping guarantee, and the
nodes to measure against.

`useSheetLayout()` hands you those, from anywhere inside your slot content (React context
flows through portals):

```js
const layout = useSheetLayout()
// layout.card    → your offsetParent. position: relative, never clips.
// layout.scroll  → the clip boundary, for whatever does your collision handling.
// layout.content → the body scroller, a scroll ancestor of your trigger.
// layout.phase   → 'entering' | 'settled' | 'closing'
// layout.isClosing
```

Three rules follow from where the panel is mounted, whatever ends up positioning it:

- **Measure against the card, not the viewport.** The trigger's rect and the card's rect
  carry the same card transform, so their difference stays correct even mid-entrance.
  Viewport coordinates are only stable once `phase === 'settled'`.
- **Clip against `layout.scroll`.** The nearest clipping ancestor of a trigger in the body
  is the body itself, so a "keep it inside the boundary" pass would squeeze the panel into
  the content area instead of letting it spill past the card. And a panel spilling *below*
  the card on mobile creates scrollable overflow inside the drag scroller, which perturbs
  the snap — flipping against `scroll` is what avoids both.
- **Recompute on `layout.content` scroll.** That is the only motion you have to track. The
  drag scroller needs nothing, because the panel is inside the card and rides along with
  it; so does the entrance and the exit.

The [anchored dropdown demo](../examples#anchored-dropdown) is a complete worked example
of all three, in about twenty lines of `getBoundingClientRect` and no dependencies.

## Paint order

Inside an open sheet the order is fixed, and it is **not** z-index dependent:

```
backdrop  <  card ( header · content · footer · overlay · anchored )  <  toplayer ( viewport )
```

The card and the top layer are both stacking contexts (`isolation: isolate`), so a
`z-index` you set inside a slot orders **your** elements against each other and can never
cross a sheet-part boundary. Within the card, the anchor layer is the last child, so it
paints above every other part with no `z-index` at all. This holds identically at rest
and while the sheet animates.

::: tip Consequence
The card is therefore also a *backdrop root*: a `backdrop-filter` on an element inside
the card samples only what is painted inside the card, not the page behind the sheet.
The sheet's own dim is outside the card and unaffected.
:::

## Dismissal

A press dismisses the sheet only when it lands on one of five structurally empty nodes:
the **dialog**, the **backdrop**, the **scroll** container, the **spacer**, or the
**panel**. Everything else — the card, your slot content, both mount layers — never
dismisses. The verdict is taken at `pointerdown`, so a menu that unmounts itself on click
cannot be mistaken for an outside click.

One interaction to plan for: a press on the dim closes your dropdown **and** the sheet,
because the dim is a dismiss surface. If your dropdown should swallow that first press,
render its scrim into the anchor layer — a press there is inside the card, so it closes
only your panel.

## Escape hatches

`useSheetPortalTarget()` returns the node instead of a component, for libraries that take
a `container` / `portalTarget` prop:

```jsx
<Select portalTarget={useSheetPortalTarget()} />
<Toaster container={useSheetPortalTarget({layer: 'viewport'})} />
```

It never returns `null` — it resolves this sheet, then the topmost sheet, then
`document.body` — so there is no fallback to write. Note that it keeps resolving a
*closing* sheet's node: "which node" and "should I still render" are separate questions,
and flipping the target mid-exit would reparent your content and restart its animations.
Ask `useSheetLayout().isClosing` for the second question, or let `<SheetPortal>` handle it
(it unmounts on close unless you pass `keepOnClose`).

Below `<SheetPortal>` and `useSheetPortalTarget()` sits the raw top-layer node,
`useSheetLayout().slots.toplayer` (`handle.slots.toplayer` in vanilla). You
almost certainly don't want it: it is `pointer-events: none`, so anything you portal in has
to re-arm pointer events on the panel itself, and a full-bleed wrapper that does it wrongly
disables drag-to-close. `layers.viewport` exists to spare you exactly that.

## Vanilla

Everything above is core, not React. `open()`'s handle carries the same nodes:

```js
const sheet = sheets.open({title: 'Sort'})
sheet.layers.anchored.append(panel) // panel must be position: absolute
sheet.layers.viewport.append(toast) // toast must be position: fixed

sheet.phase() // 'entering' | 'settled' | 'closing'
const off = sheet.onPhase((phase) => {
  if (phase === 'settled') reposition()
})
```
