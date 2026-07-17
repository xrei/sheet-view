import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'With a footer',
            size: 'md',
            content: (
              <div className="demo-body">
                <p>The footer stays pinned while the body scrolls.</p>
              </div>
            ),
            footer: ({close}) => (
              <div className="demo-actions">
                <button className="demo-btn" onClick={close}>
                  Apply &amp; close
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
