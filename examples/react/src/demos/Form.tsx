import type {FormEvent} from 'react'
import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

// The select and date popups are rendered by the browser, not by the page, so
// the modal top layer does not apply to them: no portalling, no positioning code.
function BookingForm({close}: {close: () => void}) {
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    close()
  }
  return (
    <form className="demo-form" onSubmit={submit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" autoFocus required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
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
      <button className="demo-btn" type="submit">
        Book
      </button>
    </form>
  )
}

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Book a trip',
            size: 'md',
            focusOnOpen: true,
            content: ({close}) => <BookingForm close={close} />,
          })
        }
      >
        Open a booking sheet
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
