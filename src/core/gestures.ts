import type {SheetEntry} from './internal'

// Below this progress a release always lands on "closed", so the dismiss is
// decided the moment the drag crosses it.
const DISMISS_PROGRESS = 0.5

export function makeIsMobile(breakpoint: number): () => boolean {
  const mq =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      : null
  return () => (mq ? mq.matches : false)
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Blur the focused descendant so iOS tears the keyboard down with the card.
export function blurFocusedDescendant(entry: SheetEntry): void {
  const active = document.activeElement
  if (
    active &&
    active !== document.body &&
    active !== entry.dialog &&
    entry.dialog.contains(active)
  ) {
    try {
      ;(active as HTMLElement).blur()
    } catch {
      /* element may not support blur */
    }
  }
}

function armDragClose(entry: SheetEntry): void {
  if (entry.isClosing) return
  if (entry.scroll.scrollTop >= entry.panel.offsetTop - 2) entry.openDone = true
}

// A closeDisabled sheet is not swipeable: freeze the drag scroller at the open
// snap point so a downward drag can't move — let alone dismiss — it. overflow-y
// still allows programmatic scroll (the exit animation), and the card's own
// content scroller is untouched, so long bodies still scroll.
function lockDrag(entry: SheetEntry): void {
  if (entry.scroll.style.overflowY === 'hidden') return
  entry.openDone = true
  entry.scroll.scrollTop = entry.panel.offsetTop
  entry.backdrop.style.opacity = '1'
  entry.scroll.style.overflowY = 'hidden'
}

function unlockDrag(entry: SheetEntry): void {
  entry.scroll.style.overflowY = ''
}

function settleOpen(entry: SheetEntry): void {
  // Drop the one-shot entrance transition so live drag frames set backdrop opacity
  // raw (a lingering transition would lag the dim behind the finger). No-op when
  // the open path never armed it (desktop, reduced motion).
  entry.backdrop.style.transition = ''
  armDragClose(entry)
  if (entry.props.closeDisabled) lockDrag(entry)
}

// Re-sync the drag lock when closeDisabled is toggled via update().
export function syncDragLock(entry: SheetEntry, isMobile: () => boolean): void {
  if (!isMobile()) return
  if (entry.props.closeDisabled) {
    if (entry.openDone) lockDrag(entry)
  } else {
    unlockDrag(entry)
  }
}

// A sheet can outlive a breakpoint crossing (device rotation, iPad split-view).
// Mobility is fixed at open(), so re-sync the visible state when it flips:
// desktop→mobile must land at the open snap point (a fresh snap container sits at
// scrollTop 0 = closed = an invisible modal holding the page); mobile→desktop must
// drop the per-frame inline backdrop opacity so the CSS state rule takes over.
export function watchBreakpoint(entry: SheetEntry, breakpoint: number): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
  const onChange = (e: MediaQueryListEvent): void => {
    if (entry.isClosing) return
    if (e.matches) {
      entry.scroll.scrollTop = entry.panel.offsetTop
      entry.backdrop.style.opacity = '1'
      entry.openDone = true
      if (entry.props.closeDisabled) lockDrag(entry)
    } else {
      entry.backdrop.style.opacity = ''
      unlockDrag(entry)
    }
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// Take the dismiss off the scroller and finish it on a fixed timeline. Freezing
// the scroller (overflow:hidden + touch-action:none) is what actually kills
// WebKit's in-flight pan, momentum, AND pending snap animation — pointer-events
// can't, since touch scrolling runs on a separate thread. The freeze may clamp
// scrollTop, jumping the card by `jump`px; the transform's start value cancels it.
function commitDragClose(entry: SheetEntry, dragCloseMs: number): void {
  const {scroll, card, backdrop} = entry

  const before = scroll.scrollTop
  scroll.style.scrollSnapType = 'none'
  scroll.style.overflow = 'hidden'
  scroll.style.touchAction = 'none'
  scroll.style.pointerEvents = 'none'
  const jump = before - scroll.scrollTop

  // Kill a still-running entrance keyframe (slide-up / rise-in): a running CSS
  // animation outranks inline styles, so the close transform below would be
  // ignored until it finished. Clearing it hands transform control back to us.
  card.style.animation = 'none'

  // Reduced motion: drop the card to its end position with no slide animation.
  if (prefersReducedMotion()) {
    card.style.transition = 'none'
    card.style.transform = `translateY(${card.offsetHeight - jump}px)`
    backdrop.style.opacity = '0'
    return
  }

  card.style.transition = 'none'
  card.style.transform = `translateY(${-jump}px)`
  void card.offsetHeight

  // Card slide and backdrop fade run on ONE timeline — same frame start, same
  // duration, same curve — so the dim tracks the sheet exactly as it did under the
  // finger and both clear the screen together. A gentler backdrop easing (or its
  // old synchronous, one-frame-early start) left the dim lingering after the card
  // had visually gone.
  const exit = `${dragCloseMs}ms cubic-bezier(0.32, 0.72, 0, 1)`
  requestAnimationFrame(() => {
    card.style.transition = `transform ${exit}`
    card.style.transform = `translateY(${card.offsetHeight - jump}px)`
    backdrop.style.transition = `opacity ${exit}`
    backdrop.style.opacity = '0'
  })
}

export function runOpenAnimation(
  entry: SheetEntry,
  isMobile: () => boolean,
  openSettleMs: number,
): void {
  if (!isMobile()) {
    requestAnimationFrame(() => {
      entry.dialog.dataset['sheetState'] = 'open'
    })
    entry.openDone = true
    return
  }

  // Mobile ALWAYS opens at the resting snap point (scrollTop = panel.offsetTop):
  // the drag-to-close gesture is armed from the first frame, and the card is never
  // parked at scrollTop 0 — a snap container sitting there is a visible modal whose
  // card is scrolled off-screen (the "invisible modal" holding the page). The
  // visible entrance is a compositor CSS animation (theme.css: slide-up by default,
  // rise-in for focusOnOpen), NOT a programmatic smooth-scroll. iOS Safari will not
  // animate scrollTo() inside a `scroll-snap-type: mandatory` scroller — it jumps
  // to the target, which popped the card AND the scroll-driven backdrop in one
  // frame (fine in Blink/devtools, abrupt on real iOS).
  const reduced = prefersReducedMotion()

  // Resting at the snap point fires one onScroll (progress ≈ 1) that would snap the
  // backdrop straight to full. A one-shot transition fades it in step with the card
  // slide instead; settleOpen strips it before real drag frames arrive. Reduced
  // motion keeps its own short CSS cross-fade — don't arm a JS slide over it.
  if (!reduced) {
    entry.backdrop.style.transition = `opacity ${openSettleMs}ms ease`
  }
  entry.scroll.scrollTop = entry.panel.offsetTop

  requestAnimationFrame(() => {
    entry.dialog.dataset['sheetState'] = 'open'
    if (reduced) settleOpen(entry)
    else setTimeout(() => settleOpen(entry), openSettleMs)
  })
}

export function setupDragToClose(
  entry: SheetEntry,
  close: () => void,
  isMobile: () => boolean,
  dragCloseMs: number,
): void {
  if (!isMobile()) return
  const {scroll, backdrop, panel} = entry
  let touched = false

  // panel.offsetTop (= spacer height = 100dvh) is constant while the viewport is;
  // cache it instead of forcing a layout read every scroll frame, drop on resize.
  let snapMax = 0
  const readSnapMax = (): number => (snapMax ||= panel.offsetTop || 1)
  const onResize = (): void => {
    snapMax = 0
  }

  const onTouchStart = (): void => {
    touched = true
  }

  const dismiss = (): void => {
    blurFocusedDescendant(entry)
    commitDragClose(entry, dragCloseMs)
    close()
  }

  const onScroll = (): void => {
    if (entry.isClosing) return

    const max = readSnapMax()
    const progress = Math.min(Math.max(scroll.scrollTop / max, 0), 1)
    backdrop.style.opacity = String(progress)

    if (!entry.openDone) {
      if (progress > 0.99) {
        entry.openDone = true
        // A locked sheet freezes the instant it's open — never draggable.
        if (entry.props.closeDisabled) lockDrag(entry)
      } else if (touched && progress < 0.05) {
        // Caught during the opening scroll and dragged almost back to closed.
        // `touched` is required here — the opening animation itself passes through
        // low progress, so only a real finger-drag should dismiss mid-open.
        if (entry.props.closeDisabled) lockDrag(entry)
        else dismiss()
      }
      return
    }

    // closeDisabled is a hard lock: freeze the scroller in place. No dismiss,
    // no bounce — a downward drag simply can't move the sheet.
    if (entry.props.closeDisabled) {
      lockDrag(entry)
      return
    }

    // Commit past the halfway mark. This must NOT require a touchstart: a
    // trackpad / wheel / devtools-emulated drag snaps to the closed point with no
    // touch events, and gating on `touched` left the sheet snapped shut but never
    // dismissed — an invisible, inert modal a swipe-up resurrects. Safe without
    // the guard: past settle the only non-closing route to progress < 0.5 is a
    // user drag (the isClosing guard covers programmatic close-scrolls).
    if (progress < DISMISS_PROGRESS) {
      dismiss()
    }
  }

  window.addEventListener('resize', onResize)
  scroll.addEventListener('touchstart', onTouchStart, {passive: true})
  scroll.addEventListener('scroll', onScroll, {passive: true})
  entry.cleanups.push(() => {
    window.removeEventListener('resize', onResize)
    scroll.removeEventListener('touchstart', onTouchStart)
    scroll.removeEventListener('scroll', onScroll)
  })
}

export function setupCloseHandlers(
  entry: SheetEntry,
  requestClose: () => void,
): void {
  const {dialog, card} = entry
  let pressedOutsideCard = false

  // Decide dismiss at pointerdown, not click: a sync re-render can detach the
  // click target, making a content click look like an outside click.
  const onPointerDown = (e: PointerEvent): void => {
    pressedOutsideCard = !card.contains(e.target as Node | null)
  }
  const onClick = (): void => {
    if (pressedOutsideCard) requestClose()
  }

  // Chrome fires `cancel` on the <dialog> when a child file picker is dismissed;
  // a capture-phase listener flags it so we don't treat that as an Escape close.
  let filePickerCancelled = false
  const onFileInputCancelCapture = (e: Event): void => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      filePickerCancelled = true
    }
  }
  const onCancel = (e: Event): void => {
    e.preventDefault()
    if (filePickerCancelled) {
      filePickerCancelled = false
      return
    }
    requestClose()
  }

  dialog.addEventListener('pointerdown', onPointerDown)
  dialog.addEventListener('click', onClick)
  dialog.addEventListener('cancel', onFileInputCancelCapture, {capture: true})
  dialog.addEventListener('cancel', onCancel)
  entry.cleanups.push(() => {
    dialog.removeEventListener('pointerdown', onPointerDown)
    dialog.removeEventListener('click', onClick)
    dialog.removeEventListener('cancel', onFileInputCancelCapture, {
      capture: true,
    })
    dialog.removeEventListener('cancel', onCancel)
  })
}
