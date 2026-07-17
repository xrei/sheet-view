import {createSheetCore} from 'sheet-view'

const sheets = createSheetCore()

function openBasic() {
  sheets.open({
    title: 'Basic sheet',
    content: () => {
      const body = document.createElement('div')
      body.className = 'demo-body'
      body.textContent = 'The core takes plain DOM nodes — no framework, no JSX.'
      return body
    },
  })
}

export function mount(root) {
  const button = document.createElement('button')
  button.className = 'demo-btn'
  button.textContent = 'Open a sheet'
  button.addEventListener('click', openBasic)
  root.append(button)
  return () => sheets.closeAll()
}
