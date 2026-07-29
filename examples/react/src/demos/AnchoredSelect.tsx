import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {createSheets, SheetHost, SheetPortal, useSheetLayout} from 'sheet-view/react'

const sheets = createSheets()

const OPTIONS = [
  'Newest first',
  'Oldest first',
  'Price: low to high',
  'Price: high to low',
  'Best rated',
]

const ROW = 36
const PANEL_HEIGHT = OPTIONS.length * ROW + 8

// A dropdown with ZERO positioning dependencies, to show what the library
// guarantees and what it leaves to you. Swap this math for a positioning library in a real
// app — the mount point and the dismiss behaviour are what matter here.
//
// ARIA is deliberately minimal: this demo is about positioning and dismissal, not
// about the listbox pattern. Use your design system's combobox for that.
function SortSelect() {
  const layout = useSheetLayout()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(OPTIONS[0])
  const [pos, setPos] = useState({top: 0, left: 0, width: 0})

  // Positioned against the CARD, not the viewport, because the panel is mounted
  // inside the card: both rects carry the same transform, so their difference is
  // right even mid-entrance. `scroll` is the clip boundary — flip against it, not
  // against the viewport, or the panel opens into a region the sheet cuts off.
  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger || !layout) return
    const t = trigger.getBoundingClientRect()
    const card = layout.card.getBoundingClientRect()
    const clip = layout.scroll.getBoundingClientRect()
    const flip = t.bottom + PANEL_HEIGHT > clip.bottom
    setPos({
      top: flip ? t.top - card.top - PANEL_HEIGHT - 4 : t.bottom - card.top + 4,
      left: t.left - card.left,
      width: t.width,
    })
  }, [layout])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  // Only the body scroll needs a listener. The drag scroller does NOT: the panel
  // lives inside the card, so a drag-to-close carries it along at finger speed
  // with no repositioning at all. That is the whole reason to mount it in the card.
  useEffect(() => {
    if (!open || !layout) return
    const {content} = layout
    content.addEventListener('scroll', place, {passive: true})
    window.addEventListener('resize', place)
    return () => {
      content.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [open, layout, place])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="demo-select"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <SheetPortal>
          <div
            className="demo-listbox"
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
            }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className="demo-option"
                data-selected={opt === value || undefined}
                onClick={() => {
                  // This unmounts the panel mid-click. Two things used to break
                  // here: the press was "outside the card" so it tore the whole
                  // sheet down, and the detached target made the click look like
                  // an outside click.
                  setValue(opt)
                  setOpen(false)
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </SheetPortal>
      )}
    </>
  )
}

export function Demo() {
  return (
    <>
      <button
        className="demo-btn"
        onClick={() =>
          sheets.open({
            title: 'Sort & filter',
            size: 'md',
            content: (
              <div className="demo-body">
                {Array.from({length: 8}, (_, i) => (
                  <p key={i}>
                    Paragraph {i + 1}. Scroll down — the trigger sits at the bottom of
                    this body, so its panel has to escape the content clip and flip
                    upward.
                  </p>
                ))}
                <label className="demo-label">
                  Sort by
                  <SortSelect />
                </label>
                <p>
                  Pick an option: the sheet stays open. Scroll this body with the panel
                  open: it follows. On a narrow window, drag the sheet down: it rides
                  along.
                </p>
              </div>
            ),
          })
        }
      >
        Open a sheet with a dropdown
      </button>
      <SheetHost instance={sheets} />
    </>
  )
}
