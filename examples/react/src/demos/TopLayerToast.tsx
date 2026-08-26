import {useEffect, useState} from 'react'
import {createSheets, SheetHost, SheetPortal} from 'sheet-view/react'

const sheets = createSheets()

const toast = (text: string): void =>
  void window.dispatchEvent(new CustomEvent('demo-toast', {detail: text}))

// <SheetPortal layer="viewport"> puts the toast in the sheet's top layer, above the
// modal. No `?? document.body` fallback and no `pointer-events: auto` re-arm: the
// portal resolves a target either way, and its wrapper is display:contents, so it
// re-arms clicks for the toast without covering the viewport: backdrop-dismiss and
// drag-to-close still work with a toast on screen.
function Toasts() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const show = (e: Event): void => {
      setMsg((e as CustomEvent<string>).detail)
      setTimeout(() => setMsg(null), 2200)
    }
    window.addEventListener('demo-toast', show)
    return () => window.removeEventListener('demo-toast', show)
  }, [])
  if (!msg) return null
  // `instance` matters here and only here: this component sits at the app root, not
  // inside a slot, so there is no sheet in context to read it from.
  return (
    <SheetPortal layer="viewport" instance={sheets}>
      <div className="demo-toast">{msg}</div>
    </SheetPortal>
  )
}

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Toast above sheet',
            size: 'md',
            content: (
              <div className="demo-body">
                <button
                  className="demo-btn"
                  onClick={() => toast('Rendered above the sheet ✨')}
                >
                  Show toast
                </button>
                <p>
                  With the toast up, press the dim or drag the sheet down — both still
                  dismiss it.
                </p>
              </div>
            ),
          })
        }
      >
        Open
      </button>
      <Toasts />
      <SheetHost instance={sheets} />
    </>
  )
}
