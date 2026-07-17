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

// A nullish slot with no fallback is left UNTOUCHED — the React bridge owns that
// node and portals into it; clearing it would wipe that content on update.
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

export function buildDefaultHeader(
  title: string,
  closeFn: () => void,
  closeMuted: boolean,
  closeHidden: boolean,
  closeLabel = 'Close',
  closeIcon?: SheetSlot,
  ctx?: SheetContext,
): HTMLElement {
  const header = createEl('div', 'sv-sheet__default-header', {
    'data-sheet-part': 'default-header',
  })
  const h2 = createEl('h2', 'sv-sheet__title', {'data-sheet-part': 'title'})
  h2.textContent = title ?? ''
  header.append(h2)
  if (!closeHidden) {
    const closeBtn = createEl('button', 'sv-sheet__close', {
      type: 'button',
      'aria-label': closeLabel,
      'data-sheet-part': 'close',
      'data-sheet-close': '',
      ...(closeMuted ? {'aria-disabled': 'true'} : {}),
    })
    // A custom glyph (node/SVG/string) replaces the default ×; the button keeps
    // its aria-label, so the accessible name is unchanged.
    const icon = closeIcon != null && ctx ? resolveSlot(closeIcon, ctx) : null
    if (icon) closeBtn.append(icon)
    else closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => closeFn())
    header.append(closeBtn)
  }
  return header
}

// Apply consumer root styles/tokens to the dialog. Custom props (`--x`) pass
// through; other keys are camelCase→kebab-normalized because setProperty only
// accepts dash-case (`setProperty('backgroundColor', …)` is a silent no-op).
// Clears `prevKeys` first so update() can't leak a removed key; returns the keys
// it set for the next update to clear.
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
    },
  )
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

  card.append(handle, header, content, footer, overlay)
  panel.append(card)
  scroll.append(closedSpacer, panel)
  dialog.append(backdrop, scroll, toplayer)

  return {
    dialog,
    backdrop,
    scroll,
    closedSpacer,
    panel,
    card,
    slots: {header, content, footer, overlay, toplayer},
  }
}
