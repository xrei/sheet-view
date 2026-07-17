import {createSheetCore} from 'sheet-view'

const sheets = createSheetCore()

// A crisp vector × for the close button — inherits currentColor, centered by the
// button's flexbox. Replaces the default glyph.
function closeIcon() {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '15')
  svg.setAttribute('height', '15')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(NS, 'path')
  path.setAttribute('d', 'M4 4 L12 12 M12 4 L4 12')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linecap', 'round')
  svg.append(path)
  return svg
}

function openThemed() {
  sheets.open({
    title: 'Themed',
    // `style` sets --sheet-* tokens on the root dialog, so they reach every part —
    // including the backdrop, which a card class can't touch.
    style: {
      '--sheet-surface': '#14121c',
      '--sheet-text': '#f4f0ff',
      '--sheet-handle': 'rgba(255, 255, 255, 0.3)',
      '--sheet-backdrop': 'rgb(20 6 40 / 0.6)',
    },
    closeIcon: closeIcon(),
    content: () => {
      const body = document.createElement('div')
      body.className = 'demo-body'
      body.textContent =
        'This one sheet is re-themed through the style prop — while the rest of the page stays light.'
      return body
    },
  })
}

export function mount(root) {
  const button = document.createElement('button')
  button.className = 'demo-btn'
  button.textContent = 'Open a themed sheet'
  button.addEventListener('click', openThemed)
  root.append(button)
  return () => sheets.closeAll()
}
