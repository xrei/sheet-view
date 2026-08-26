import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

// A UX cap, not a technical one: only the top two sheets ever render.
const MAX_DEPTH = 12

// open() is a push: each call opens a new sheet over the current one.
function openStacked(depth: number) {
  sheets.open({
    title: `Stacked sheet — depth ${depth}`,
    size: 'xl',
    content: ({close}) => (
      <div className="demo-body">
        <p>
          Depth {depth}. Escape closes this sheet only, and focus lands back on
          the button that opened it.
        </p>
        <div className="demo-row">
          {depth < MAX_DEPTH && (
            <button className="demo-btn" onClick={() => openStacked(depth + 1)}>
              Open depth {depth + 1}
            </button>
          )}
          <button className="demo-btn" onClick={close}>
            Close this one
          </button>
          <button className="demo-btn" onClick={() => sheets.closeAll()}>
            Close all
          </button>
        </div>
      </div>
    ),
  })
}

export function Demo() {
  return (
    <>
      <button className="demo-btn" onClick={() => openStacked(1)}>
        Open depth 1
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
