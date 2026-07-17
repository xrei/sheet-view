import {useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {createSheets, SheetHost, useSheetTopLayer} from 'sheet-view/react'

const sheets = createSheets()

const toast = (text: string): void =>
  void window.dispatchEvent(new CustomEvent('demo-toast', {detail: text}))

// Renders the toast INTO the top sheet's top-layer node, so it paints above the modal.
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
  const topLayer = useSheetTopLayer(sheets)
  if (!msg) return null
  return createPortal(<div className="demo-toast">{msg}</div>, topLayer ?? document.body)
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
                <button className="demo-btn" onClick={() => toast('Rendered above the sheet ✨')}>
                  Show toast
                </button>
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
