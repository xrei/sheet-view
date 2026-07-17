import type {FormEvent} from 'react'
import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

// A real <form> with autocomplete attributes, so password managers offer autofill.
function SignInForm({close}: {close: () => void}) {
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
      <button className="demo-btn" type="submit">
        Sign in
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
            title: 'Sign in',
            size: 'md',
            focusOnOpen: true,
            content: ({close}) => <SignInForm close={close} />,
          })
        }
      >
        Open a sign-in sheet
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
