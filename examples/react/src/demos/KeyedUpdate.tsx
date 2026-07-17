import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()
let count = 0

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() => {
          count += 1
          sheets.open({
            key: 'keyed',
            strategy: 'update', // re-render the same keyed sheet in place, no stacking
            title: `Keyed + update (#${count})`,
            size: 'sm',
            content: (
              <div className="demo-body">
                <p>Click again — same sheet, updated in place. Update count: {count}.</p>
              </div>
            ),
          })
        }}
      >
        Open / update
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
