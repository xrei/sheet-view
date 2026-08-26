import {withBase} from 'vitepress'
import type {SheetContext, SheetCore} from 'sheet-view'

// The hero's "Open a sheet" action: one real sheet over the homepage, so the
// first click on the site is the product itself, not a page about it.
let ready: Promise<SheetCore> | null = null

const load = () =>
  (ready ??= Promise.all([
    import('sheet-view'),
    import('sheet-view/base.css'),
    import('sheet-view/theme.css'),
  ]).then(([{createSheetCore}]) => createSheetCore()))

// Colour is inherited: the card sets the theme's on-surface text colour, so
// the copy is dark on the light surface and light on the dark one.
const line = (text: string, lead: boolean): HTMLElement => {
  const p = document.createElement('p')
  p.style.cssText = `margin:0;line-height:1.6;font-weight:${lead ? '500' : '400'}`
  p.textContent = text
  return p
}

const content = (): HTMLElement => {
  const body = document.createElement('div')
  body.style.cssText =
    'display:flex;flex-direction:column;gap:14px;padding:16px'
  body.append(
    line('Hello!', true),
  )
  const code = document.createElement('code')
  code.style.cssText =
    'align-self:flex-start;margin-top:2px;padding:8px 14px;border-radius:8px;background:var(--vp-c-default-soft);color:inherit;font-family:var(--vp-font-family-mono);font-size:13px'
  code.textContent = 'npm i sheet-view'
  body.append(code)
  return body
}

const footer = (ctx: SheetContext): HTMLElement => {
  const row = document.createElement('div')
  row.style.cssText =
    'display:flex;gap:10px;justify-content:flex-end;padding:12px'
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = 'Close'
  close.style.cssText =
    'padding:9px 20px;border-radius:20px;background:var(--vp-c-default-soft);color:inherit;font-weight:600'
  close.addEventListener('click', () => ctx.close())
  const start = document.createElement('a')
  start.href = withBase('/guide/getting-started')
  start.textContent = 'Get started'
  start.style.cssText =
    'padding:9px 20px;border-radius:20px;background:var(--vp-button-brand-bg);color:var(--vp-button-brand-text);font-weight:600;text-decoration:none;transition:background-color 0.25s'
  // The router swaps the page under the modal; the sheet has to leave with it.
  start.addEventListener('click', () => ctx.close())
  // Same states as VPButton, so this and the hero button are identical.
  start.addEventListener('mouseenter', () => {
    start.style.background = 'var(--vp-button-brand-hover-bg)'
  })
  start.addEventListener('mouseleave', () => {
    start.style.background = 'var(--vp-button-brand-bg)'
  })
  row.append(close, start)
  return row
}

export async function openTrySheet(): Promise<void> {
  const sheets = await load()
  const handle = sheets.open({
    key: 'hero-try',
    strategy: 'update',
    title: 'Live sheet',
    size: 'sm',
    style: {'--sheet-width': '560px'},
    content,
    footer,
  })
  // The deep link puts #open-sheet in the URL; a closed sheet drops it again.
  handle.onPhase((phase) => {
    if (phase === 'closing' && location.hash === '#open-sheet') {
      history.replaceState(history.state, '', location.pathname + location.search)
    }
  })
}
