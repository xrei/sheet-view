import type {ReactElement} from 'react'
import {createSheets, SheetHost} from 'sheet-view/react'

const sheets = createSheets()

// Both header glyphs as plain JSX — the shape every icon library ships. They fill
// library-owned nodes, so the close button keeps its label, its disabled state and
// its 44×44 hit target. Nothing here replaces the header row.
const Sparkle = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
  </svg>
)

const Cross = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <path
      d="M4 4 L12 12 M12 4 L4 12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'With a footer',
            size: 'md',
            icon: <Sparkle />,
            closeIcon: <Cross />,
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
