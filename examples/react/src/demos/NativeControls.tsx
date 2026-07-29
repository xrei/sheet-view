import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

// Native popups are rendered by the OS, not by the page, so they are unaffected by
// the modal top layer and need nothing from the library. The one case a page cannot
// fix is UI it does not own — see the "third-party overlays" limitation in the docs.
export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Native controls',
            size: 'md',
            content: (
              <div className="demo-body">
                <p>
                  A <code>&lt;select&gt;</code>, a date input and a datalist combobox.
                  Every popup here is native UI — it opens over the sheet with no
                  portalling, no layer and no positioning code.
                </p>
                <label className="demo-label">
                  Country
                  <select className="demo-input" defaultValue="th">
                    <option value="th">Thailand</option>
                    <option value="vn">Vietnam</option>
                    <option value="id">Indonesia</option>
                    <option value="ph">Philippines</option>
                  </select>
                </label>
                <label className="demo-label">
                  Departure
                  <input className="demo-input" type="date" />
                </label>
                <label className="demo-label">
                  Airline
                  <input className="demo-input" list="demo-airlines" />
                  <datalist id="demo-airlines">
                    <option value="Thai Airways" />
                    <option value="Bangkok Airways" />
                    <option value="Vietnam Airlines" />
                  </datalist>
                </label>
              </div>
            ),
          })
        }
      >
        Open a sheet with native inputs
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
