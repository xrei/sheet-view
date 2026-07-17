// Demo utilities for the anatomy reference — not part of sheet-view.

export const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

// A demo button. Uses a class (not a bare `button {}`) so importing the demo into
// another page can't be hijacked and can't leak onto the host's buttons.
export const btn = (label, onclick) =>
  el('button', {type: 'button', className: 'demo-btn', textContent: label, onclick})

// --- Anatomy building blocks ------------------------------------------------

// A chip naming a data-sheet-part, baked into the slots we build here (content,
// footer). Card, header, overlay, and backdrop are labelled from CSS.
const chip = (part) => el('span', {className: `part-chip part-chip--${part}`, textContent: part})

export function anatomyContent() {
  const wrap = el('div', {className: 'anatomy-content'})
  wrap.append(chip('content'))
  wrap.append(
    el('p', {
      innerHTML:
        'This green region is <code>content</code> — the scrollable body. It ' +
        'scrolls on its own when it overflows, while the header and footer stay put.',
    }),
  )
  for (let i = 1; i <= 10; i++) {
    wrap.append(el('p', {textContent: `Body paragraph ${i}. Keep scrolling — the header and footer don't move.`}))
  }
  return wrap
}

export function anatomyFooter({close}) {
  return el('div', {className: 'anatomy-footer'}, chip('footer'), btn('Close', () => close()))
}

// A decoration in the overlay slot — sits past the card's top-right corner.
export const anatomyOverlay = () => el('div', {className: 'overlay-badge', textContent: 'overlay'})

// The colour → part legend for the anatomy section.
export function buildLegend() {
  const item = (color, name, desc) =>
    el(
      'li',
      {},
      el('span', {className: 'swatch', style: `background:${color}`}),
      el('code', {textContent: name}),
      el('span', {className: 'desc', textContent: desc}),
    )
  return el(
    'div',
    {className: 'legend'},
    el(
      'ul',
      {},
      item('#7c3aed', 'card', 'The visible surface that holds every slot.'),
      item('#2563eb', 'header', 'Title + close button, or your own headerSlot.'),
      item('#16a34a', 'content', 'The scrollable body.'),
      item('#d97706', 'footer', 'Pinned actions; hidden when empty.'),
      item('#db2777', 'overlay', 'Decorations anchored to the card, free to extend past its edges.'),
      item('rgba(0, 0, 0, 0.45)', 'backdrop', 'The dim behind the card.'),
    ),
    el('p', {
      className: 'note',
      innerHTML:
        'On mobile the card also shows a <code>handle</code> (the drag pill), and rides ' +
        '<code>scroll</code> / <code>spacer</code> / <code>panel</code> — the scroll-snap ' +
        'wrappers that power drag-to-close. <code>toplayer</code> is an empty layer above ' +
        'everything for global overlays (toasts).',
    }),
  )
}
