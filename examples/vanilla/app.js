// Anatomy demo source for the docs site. The two documented sheet snippets live
// in ./demos/*.js; this file drives only the colour-coded anatomy reference.
import {createSheetCore} from 'sheet-view'
import {
  el,
  btn,
  anatomyContent,
  anatomyFooter,
  anatomyOverlay,
  buildLegend,
} from './dom.js'

const sheets = createSheetCore()

function openAnatomy() {
  sheets.open({
    title: 'Anatomy',
    size: 'md',
    cardClassName: 'anatomy',
    content: anatomyContent,
    footer: anatomyFooter,
    overlaySlot: anatomyOverlay,
  })
}

/** Anatomy: the colour-coded part diagram + its legend. Mounted by the docs island. */
export function mountAnatomy(root) {
  root.classList.add('sv-demo')
  root.append(
    el('div', {className: 'row'}, btn('Open the anatomy sheet', openAnatomy)),
    buildLegend(),
  )
  return () => sheets.closeAll()
}
