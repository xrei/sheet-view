import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Basic sheet',
            size: 'md',
            content: (
              <div className="demo-body">
                {Array.from({length: 10}, (_, i) => (
                  <p key={i}>
                    Paragraph {i + 1}. A React body portaled into the core's DOM — the
                    content area scrolls on its own.
                  </p>
                ))}
              </div>
            ),
          })
        }
      >
        Open a sheet
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
