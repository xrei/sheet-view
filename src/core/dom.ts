import type {SheetContext, SheetOpenProps, SheetSlot} from './types'
import type {SheetDOM} from './internal'

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  }
  return node
}

function resolveSlot(slot: SheetSlot, ctx: SheetContext): Node | null {
  if (slot == null) return null
  const value = typeof slot === 'function' ? slot(ctx) : slot
  if (value == null) return null
  if (value instanceof Node) return value
  if (typeof value === 'string') {
    const span = document.createElement('span')
    span.textContent = value
    return span
  }
  return null
}

// A nullish slot with no fallback leaves the node UNTOUCHED: an external
// renderer may own it, and clearing would wipe its content on update.
export function mountSlot(
  target: HTMLElement,
  slot: SheetSlot,
  ctx: SheetContext,
  fallback?: () => Node,
): void {
  if (slot != null) {
    target.replaceChildren(resolveSlot(slot, ctx) ?? document.createTextNode(''))
  } else if (fallback) {
    target.replaceChildren(fallback())
  }
}

export interface DefaultHeaderOptions {
  title: string
  /**
   * The stable icon node from `SheetSlots`, moved here, never created here:
   * this whole header is rebuilt on every `update()`, so a node created inside
   * would be a fresh element each time and an external renderer would keep
   * writing into the detached previous one.
   */
  icon: HTMLElement
  /** The stable close-glyph node from `SheetSlots`, moved here, like `icon`. */
  closeIcon: HTMLElement
  onClose: () => void
  closeMuted: boolean
  closeHidden: boolean
  closeLabel: string
}

export function buildDefaultHeader(opts: DefaultHeaderOptions): HTMLElement {
  const header = createEl('div', 'sv-sheet__default-header', {
    'data-sheet-part': 'default-header',
  })
  const h2 = createEl('h2', 'sv-sheet__title', {'data-sheet-part': 'title'})
  h2.textContent = opts.title ?? ''
  // Sibling of the <h2>, not a child, so an announced icon can't leak into the
  // dialog's accessible name via aria-labelledby.
  header.append(opts.icon, h2)
  if (!opts.closeHidden) {
    const closeBtn = createEl('button', 'sv-sheet__close', {
      type: 'button',
      'aria-label': opts.closeLabel,
      'data-sheet-part': 'close',
      ...(opts.closeMuted ? {'aria-disabled': 'true'} : {}),
    })
    // The glyph is a moved node, never text set here: the default × comes from
    // `.sv-sheet__close-icon:empty::before`, so it yields the instant anything
    // lands in the node, with no window where both are visible.
    closeBtn.append(opts.closeIcon)
    closeBtn.addEventListener('click', () => opts.onClose())
    header.append(closeBtn)
  }
  return header
}

// Custom props (`--x`) pass through; other keys are camelCase→kebab-normalized
// because setProperty only accepts dash-case (`setProperty('backgroundColor',
// …)` is a silent no-op). Clears `prevKeys` first so update() can't leak a
// removed key; returns the keys it set for the next update to clear.
export function applyRootStyle(
  dialog: HTMLElement,
  style: Record<string, string> | undefined,
  prevKeys: readonly string[] = [],
): string[] {
  for (const key of prevKeys) dialog.style.removeProperty(key)
  if (!style) return []
  const applied: string[] = []
  for (const [k, v] of Object.entries(style)) {
    const prop = k.startsWith('--')
      ? k
      : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    dialog.style.setProperty(prop, v)
    applied.push(prop)
  }
  return applied
}

export function buildSheetDOM(props: SheetOpenProps): SheetDOM {
  const dialog = createEl(
    'dialog',
    `sv-sheet${props.className ? ` ${props.className}` : ''}`,
    {
      'data-sheet-part': 'root',
      'data-sheet-state': 'opening',
      ...(props.focusOnOpen ? {'data-sheet-focus-open': ''} : {}),
    })
  // The dialog's accessible name is wired after mount (syncDialogLabel) so a
  // default header can be referenced by aria-labelledby instead of duplicated.

  const backdrop = createEl('div', 'sv-sheet__backdrop', {
    'data-sheet-part': 'backdrop',
    'aria-hidden': 'true',
  })
  const scroll = createEl('div', 'sv-sheet__scroll', {
    'data-sheet-part': 'scroll',
  })
  const closedSpacer = createEl('div', 'sv-sheet__spacer', {
    'data-sheet-part': 'spacer',
    'aria-hidden': 'true',
  })
  const panel = createEl('div', 'sv-sheet__panel', {'data-sheet-part': 'panel'})

  const cardClass = `sv-sheet__card${
    props.cardClassName ? ` ${props.cardClassName}` : ''
  }`
  const card = createEl('div', cardClass, {
    'data-sheet-part': 'card',
    'data-sheet-size': props.size ?? 'lg',
  })

  const handle = createEl('div', 'sv-sheet__handle', {
    'data-sheet-part': 'handle',
    'aria-hidden': 'true',
  })
  const header = createEl('div', 'sv-sheet__header', {
    'data-sheet-part': 'header',
  })
  // Built here, not in buildDefaultHeader, so its identity survives every header
  // rebuild. `.sv-sheet__icon:empty` collapses it until something fills it.
  const icon = createEl('span', 'sv-sheet__icon', {'data-sheet-part': 'icon'})
  // Same for the close glyph, moved into each rebuilt button. Must be created
  // EMPTY: `:empty::before` is what paints the default ×.
  const closeIcon = createEl('span', 'sv-sheet__close-icon', {
    'data-sheet-part': 'close-icon',
  })
  const content = createEl('div', 'sv-sheet__content', {
    'data-sheet-part': 'content',
    'data-scrollable': 'true',
  })
  const footer = createEl('div', 'sv-sheet__footer', {
    'data-sheet-part': 'footer',
  })
  const overlay = createEl('div', 'sv-sheet__overlay', {
    'data-sheet-part': 'overlay',
  })
  const toplayer = createEl('div', 'sv-sheet__toplayer', {
    'data-sheet-part': 'toplayer',
  })

  // The card's own dim, ending at that card's edges, never the viewport, so
  // shade can't pile up across a deep stack. Painted above every card part
  // (base.css gives it the top z-index inside the card's stacking context);
  // opacity is owned by the core per stack role.
  const scrim = createEl('div', 'sv-sheet__scrim', {
    'data-sheet-part': 'scrim',
    'aria-hidden': 'true',
  })

  // `anchored` is the card's last child BEFORE the scrim, so it paints above
  // every other card part with no z-index; `viewport` lives in the top layer.
  const anchorLayer = createEl('div', 'sv-sheet__anchor-layer', {
    'data-sheet-part': 'anchor-layer',
  })
  const viewportLayer = createEl('div', 'sv-sheet__viewport-layer', {
    'data-sheet-part': 'viewport-layer',
  })

  // Some renderers delete a container once it has no children, then re-hang the
  // disconnected node off <body>. A permanent invisible child means "empty"
  // never happens; display:none is inline so the guarantee does not depend on a
  // stylesheet being loaded.
  const makeSentinel = (): HTMLElement => {
    const s = createEl('span', 'sv-sheet__layer-sentinel', {
      'data-sheet-part': 'layer-sentinel',
      'aria-hidden': 'true',
      hidden: '',
    })
    s.style.display = 'none'
    return s
  }
  const anchorSentinel = makeSentinel()
  const viewportSentinel = makeSentinel()
  anchorLayer.append(anchorSentinel)
  viewportLayer.append(viewportSentinel)

  card.append(handle, header, content, footer, overlay, anchorLayer, scrim)
  panel.append(card)
  scroll.append(closedSpacer, panel)
  toplayer.append(viewportLayer)
  dialog.append(backdrop, scroll, toplayer)

  return {
    dialog,
    backdrop,
    scroll,
    closedSpacer,
    panel,
    card,
    scrim,
    slots: {header, icon, closeIcon, content, footer, overlay, toplayer},
    layers: {anchored: anchorLayer, viewport: viewportLayer},
    sentinels: {anchored: anchorSentinel, viewport: viewportSentinel},
  }
}
