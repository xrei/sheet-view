import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Forced sheet',
            size: 'sm',
            closeDisabled: true, // blocks the X, backdrop, Escape, and drag
            content: ({close}) => (
              <div className="demo-body">
                <p>Backdrop, Escape, and the X are blocked. Only this button closes it.</p>
                <button className="demo-btn" onClick={close}>
                  Unlock &amp; close
                </button>
              </div>
            ),
          })
        }
      >
        Open
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
