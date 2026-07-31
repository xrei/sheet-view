import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Original title',
            size: 'md',
            content: ({update}) => (
              <div className="demo-body">
                <p>
                  Each button rewrites the open sheet in place — same dialog, no
                  re-entrance animation. The leading icon and the close glyph are
                  moved into the rebuilt header, not recreated, so they survive
                  every rewrite.
                </p>
                <div className="demo-row">
                  <button
                    className="demo-btn"
                    onClick={() => update({title: 'Rewritten title'})}
                  >
                    Change title
                  </button>
                  <button className="demo-btn" onClick={() => update({size: 'xl'})}>
                    Grow the card
                  </button>
                  <button
                    className="demo-btn"
                    onClick={() => update({style: {'--sheet-width': '860px'}})}
                  >
                    Widen the desktop card
                  </button>
                  <button
                    className="demo-btn"
                    onClick={() =>
                      update({
                        content: (
                          <div className="demo-body">
                            {Array.from({length: 20}, (_, i) => (
                              <p key={i}>
                                Long-body line {i + 1} — the body swapped out from
                                under the open sheet.
                              </p>
                            ))}
                          </div>
                        ),
                      })
                    }
                  >
                    Swap the body
                  </button>
                </div>
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
