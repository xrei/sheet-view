import type {SheetEntry} from './internal'
import {setPhase} from './phase'

/** Commit point, as a fraction of the card's own height, not the viewport's. */
const DISMISS_TRAVEL = 0.5
const FLICK_VELOCITY = 1 // px/ms
/**
 * How far off the open snap point still counts as resting, in px. `offsetTop` is
 * an integer where `scrollTop` is a double, so at a fractional dvh an exact
 * compare reads a sheet that never moved as displaced.
 */
const REST_SLACK = 2

/** The entrance, and the desktop exit. Mirrored by base.css, keep them equal. */
export const ENTER_EASE = 'cubic-bezier(0.3, 0.54, 0.05, 0.995)'
/** Every mobile departure: exit, snap-back, role flip. */
export const EXIT_EASE = 'cubic-bezier(0.295, 0.46, 0.06, 0.99)'
/** A fast release. Differs from EXIT_EASE by pace only. */
export const FLICK_EASE = 'cubic-bezier(0.32, 0.73, 0.04, 1)'

const MOTION = new WeakMap<Element, Animation>()

/**
 * One leg of sheet motion on `el`: two keyframes, `frame(0)` and `frame(1)`,
 * joined by `ease`. Reads no layout, so it can start in the same task as the
 * event that caused it.
 */
export function runMotion(
  el: HTMLElement,
  ease: string,
  ms: number,
  frame: (p: number) => Keyframe,
): Animation | null {
  MOTION.get(el)?.cancel()
  if (typeof el.animate !== 'function') return null
  // A new animation does not affect rendering until the next frame, so without a
  // backwards fill the element paints one frame at the resting value its caller
  // already wrote inline. Forwards fill would swallow the next write.
  const anim = el.animate([frame(0), frame(1)], {
    duration: ms,
    easing: ease,
    fill: 'backwards',
  })
  MOTION.set(el, anim)
  return anim
}

/** Drop any library animation on `el` and let CSS own it again. */
export function stopMotion(el: HTMLElement): void {
  MOTION.get(el)?.cancel()
  MOTION.delete(el)
}

// Stack offset between stations. Must match --_sheet-stack-peek in base.css.
export const PEEK = 10

// How much of the recede the covered card has given back at position L: it
// trails the top card's own travel through the middle, exact at both ends.
function reveal(L: number): number {
  return L + L * (1 - L) * (0.34393 + 0.03923 * (1 - 2 * L))
}

/** The dim the drive leaves on the card directly beneath, at position L. */
export function drivenDim(L: number): number {
  return 0.6 * L
}

/**
 * The pose the drive leaves a deck member in at position L. Exported because a
 * role flip animates FROM here: while the finger is down the card is at this
 * pose, not at the resting one the core has cached.
 */
export function drivenPose(
  station: 'covered' | 'buried',
  rest: {scale: number; ty: number},
  L: number,
): {scale: number; ty: number} {
  if (station === 'buried') return {scale: rest.scale, ty: rest.ty - PEEK * (1 - L)}
  const u = reveal(L)
  return {scale: 1 - (1 - rest.scale) * u, ty: rest.ty * u}
}

function poseCss(p: {scale: number; ty: number}): string {
  return `translateY(${p.ty}px) scale(${p.scale})`
}

// Each card records the L it was posed at, so whatever takes the register back
// knows where the card actually is.
function driveDeck(
  deck: NonNullable<SheetEntry['deck']>,
  L: number,
  reduced: boolean,
): void {
  deck.under.scrim.style.opacity = String(drivenDim(L))
  deck.under.driven = L
  if (reduced) return
  for (const c of deck.covered) {
    c.card.style.transform = poseCss(
      drivenPose('covered', {scale: c.scale, ty: c.stackTy}, L))
    c.driven = L
  }
  const b = deck.buried
  if (b) {
    b.card.style.transform = poseCss(
      drivenPose('buried', {scale: b.scale, ty: b.stackTy}, L))
    b.driven = L
  }
}

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

// Blur the focused descendant so the keyboard tears down with the card.
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
  if (entry.scroll.scrollTop >= entry.panel.offsetTop - REST_SLACK) {
    entry.openDone = true
  }
}

// A closeDisabled sheet is not swipeable: freeze the drag scroller at the open
// snap point. overflow-y still allows the programmatic scroll of the exit, and
// the card's own content scroller is untouched.
function lockDrag(entry: SheetEntry): void {
  // A closing sheet must stay on its exit path, and a stacked one must keep the
  // dim CSS owns. A promoted closeDisabled sheet re-locks on its first scroll
  // frame, which precedes any dismiss.
  if (entry.isClosing || entry.stackDepth) return
  if (entry.scroll.style.overflowY === 'hidden') return
  entry.openDone = true
  entry.scroll.scrollTop = entry.panel.offsetTop
  if (entry.pageDim) entry.backdrop.style.opacity = '1'
  entry.scroll.style.overflowY = 'hidden'
}

function unlockDrag(entry: SheetEntry): void {
  entry.scroll.style.overflowY = ''
}

// base.css drops the backdrop's enter fade behind this flag, so live drag frames
// set the dim opacity raw; a lingering transition lags it behind the finger.
function markSettled(entry: SheetEntry): void {
  setPhase(entry, 'settled')
}

function settleOpen(entry: SheetEntry): void {
  markSettled(entry)
  armDragClose(entry)
  if (entry.props.closeDisabled) lockDrag(entry)
}

export function syncDragLock(entry: SheetEntry, isMobile: () => boolean): void {
  if (!isMobile()) return
  if (entry.props.closeDisabled) {
    if (entry.openDone) lockDrag(entry)
  } else {
    unlockDrag(entry)
  }
}

// Mobility is fixed at open(), so re-sync the visible state when the breakpoint
// flips: a fresh mobile snap container sits at scrollTop 0, which is closed, an
// invisible modal holding the page; desktop needs the per-frame inline backdrop
// opacity dropped so the CSS state rule takes over.
export function watchBreakpoint(entry: SheetEntry, breakpoint: number): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
  const onChange = (e: MediaQueryListEvent): void => {
    // A non-top sheet keeps the dim it handed to CSS; promotion re-parks itself.
    if (entry.isClosing || entry.stackDepth) return
    if (e.matches) {
      markSettled(entry)
      entry.scroll.scrollTop = entry.panel.offsetTop
      entry.backdrop.style.opacity = entry.pageDim ? '1' : ''
      entry.openDone = true
      if (entry.props.closeDisabled) lockDrag(entry)
    } else {
      // Inline only where CSS can't see the state: a nested sheet that became
      // bottom-most carries the page dim itself.
      entry.backdrop.style.opacity = entry.pageDim && entry.nested ? '1' : ''
      unlockDrag(entry)
    }
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// The one mobile exit: a drag commit and a button close both land here.
// overflow:hidden + touch-action:none is what kills an in-flight pan and its
// momentum; pointer-events cannot, because touch scrolling runs on another thread.
export function runSheetExit(
  entry: SheetEntry,
  ms: number,
  ease: string = EXIT_EASE,
): void {
  const {scroll, card, backdrop} = entry

  // All reads first: interleaving forces a layout pass in the click's own task.
  const max = entry.panel.offsetTop || 1
  const before = scroll.scrollTop
  const height = card.offsetHeight

  // Order is load bearing. A programmatic scroll cancels the browser's own snap
  // animation only while the element is still a live scroller, so the park has
  // to land after snap is off and before the freeze.
  scroll.style.scrollSnapType = 'none'
  scroll.scrollTop = before
  scroll.style.overflow = 'hidden'
  scroll.style.touchAction = 'none'
  scroll.style.pointerEvents = 'none'
  // Again, because the freeze can clamp it.
  scroll.scrollTop = before

  // Kill a still-running entrance keyframe so it stops costing frames.
  card.style.animation = 'none'

  // Reduced motion: no slide, cross-fade the card out on the same clock.
  if (prefersReducedMotion()) {
    card.style.transition = `opacity ${ms}ms ease`
    card.style.opacity = '0'
    backdrop.style.opacity = ''
    return
  }

  // A posed (covered/buried) card keeps its pose on the way out: the slide
  // composes onto the cached pose, so nothing is read back off the element.
  const base = entry.recede
    ? ` translateY(${entry.stackTy}px) scale(${entry.scale})`
    : ''
  // Animate the remaining distance, not a full card height: the drag already
  // carried the card `shown` px down.
  const shown = Math.max(0, max - before)
  const travel = Math.max(0, height - shown)

  // Resting value first, then the journey to it, see runMotion.
  card.style.transform = `translateY(${travel}px)${base}`
  runMotion(card, ease, ms, (p) => ({
    transform: `translateY(${travel * p}px)${base}`,
  }))
  // The dim fades from wherever the drag left it: the drag drives this register
  // per frame, so starting from 1 would flash it back to full.
  if (entry.pageDim) {
    const from = backdrop.style.opacity === '' ? 1 : Number(backdrop.style.opacity)
    backdrop.style.opacity = '0'
    runMotion(backdrop, ease, ms, (p) => ({opacity: String(from * (1 - p))}))
  }
}

// The translateY an element is painted at right now. The desktop entrance is a
// CSS animation, so its position exists only inside the engine. A consumer's 3D
// transform on the card computes to matrix3d, which carries the same offset at
// index 13 rather than 5.
function liveTy(el: HTMLElement): number {
  const m = /matrix(3d)?\(([^)]+)\)/.exec(getComputedStyle(el).transform)
  if (!m) return 0
  return Number(m[2]!.split(',')[m[1] ? 13 : 5]) || 0
}

/**
 * The desktop exit: the card slides off the bottom edge and the dim fades with
 * it. The card itself never fades.
 *
 * It cannot be a CSS transition: a transition never starts on a property a CSS
 * animation is still animating, and the entrance is one.
 */
export function runDesktopExit(entry: SheetEntry, ms: number): void {
  const {card, backdrop} = entry

  // The card is centered, so half the viewport plus half the card puts its top
  // edge on the bottom edge of the screen. base.css rises through the same
  // distance, written there as calc(50dvh + 50%).
  const travel = (window.innerHeight + card.offsetHeight) / 2
  const from = liveTy(card)
  const dim = Number(getComputedStyle(backdrop).opacity) || 0

  // Drop the entrance so it stops costing frames; `from` is already captured.
  card.style.animation = 'none'
  backdrop.style.animation = 'none'

  if (prefersReducedMotion()) {
    card.style.transition = `opacity ${ms}ms ease`
    card.style.opacity = '0'
    backdrop.style.transition = `opacity ${ms}ms ease`
    backdrop.style.opacity = '0'
    return
  }

  // Resting value first, then the journey to it, see runMotion.
  card.style.transform = `translateY(${travel}px)`
  runMotion(card, ENTER_EASE, ms, (p) => ({
    transform: `translateY(${from + (travel - from) * p}px)`,
  }))
  backdrop.style.opacity = '0'
  runMotion(backdrop, ENTER_EASE, ms, (p) => ({opacity: String(dim * (1 - p))}))
}

export function runOpenAnimation(
  entry: SheetEntry,
  isMobile: () => boolean,
  openSettleMs: number,
): void {
  if (!isMobile()) {
    markSettled(entry)
    requestAnimationFrame(() => {
      // A close() in the same tick already set 'closing'; writing 'open' over it
      // would unmatch the closing CSS and kill the exit animation.
      if (entry.isClosing) return
      entry.dialog.dataset['sheetState'] = 'open'
    })
    entry.openDone = true
    return
  }

  // Mobile always opens at the resting snap point: a fresh snap container sits
  // at scrollTop 0, which is closed, an invisible modal holding the page. The
  // visible entrance is a CSS animation in base.css, not a smooth-scroll,
  // because WebKit refuses to animate scrollTo() inside a mandatory-snap
  // scroller and jumps instead.
  const reduced = prefersReducedMotion()
  entry.scroll.scrollTop = entry.panel.offsetTop

  requestAnimationFrame(() => {
    // Same race as the desktop branch.
    if (entry.isClosing) return
    entry.dialog.dataset['sheetState'] = 'open'
    if (reduced) settleOpen(entry)
    else setTimeout(() => settleOpen(entry), openSettleMs)
  })
}

export function setupDragToClose(
  entry: SheetEntry,
  close: (exitMs: number, flick: boolean) => void,
  isMobile: () => boolean,
  dragCloseMs: number,
): void {
  if (!isMobile()) return
  const {scroll, backdrop, panel} = entry
  let touched = false
  let touching = false
  // The card is animating home while the scroller sits parked at the open point.
  let returning = false
  let returnTimer: ReturnType<typeof setTimeout> | null = null
  // Release velocity in px/ms, positive toward dismissal. Averaged over a window
  // because a mouse translated into touch reverses single frames routinely, and
  // one reversed sample would flip the gesture.
  const VELOCITY_WINDOW_MS = 64
  const samples: Array<{t: number; top: number}> = []
  // Samples only accrue while the scroller moves, so a finger that stops keeps
  // what it last saw; without an age check a long hold would still read as fast.
  const STALE_MS = 80
  // Checked per drive frame, so the MediaQueryList is created once, not per event.
  const reducedMq =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null

  // panel.offsetTop (= spacer height = 100dvh) is constant while the viewport is.
  let snapMax = 0
  const readSnapMax = (): number => (snapMax ||= panel.offsetTop || 1)
  // Falls back to the viewport when the card has no layout to measure yet.
  let cardH = 0
  const readCardH = (): number => (cardH ||= entry.card.offsetHeight)
  const commitAt = (): number => DISMISS_TRAVEL * (readCardH() || readSnapMax())
  const onResize = (): void => {
    snapMax = 0
    cardH = 0
  }

  /**
   * A finger lands while the card is still travelling back up: cancel the
   * return, put the scroller where the card visually is, carry on from there.
   * The card is the one thing read back off the DOM, because a running
   * animation's position exists nowhere else.
   */
  const grabReturn = (): void => {
    if (!returning) return
    returning = false
    if (returnTimer != null) {
      clearTimeout(returnTimer)
      returnTimer = null
    }
    const max = readSnapMax()
    const live = liveTy(entry.card)
    const {card, deck} = entry
    stopMotion(card)
    stopMotion(backdrop)
    if (deck) {
      stopMotion(deck.under.scrim)
      for (const c of deck.covered) stopMotion(c.card)
      if (deck.buried) stopMotion(deck.buried.card)
    }
    // Same pixels, different owner: the card gives up its transform and the
    // scroller takes on the offset, in one task, so nothing paints in between.
    card.style.transform = ''
    scroll.style.overflow = ''
    scroll.style.touchAction = ''
    scroll.scrollTop = max - live
    const progress = Math.min(Math.max((max - live) / max, 0), 1)
    if (entry.pageDim) backdrop.style.opacity = String(progress)
    if (deck) driveDeck(deck, progress, !!(reducedMq && reducedMq.matches))
  }

  const onTouchStart = (): void => {
    touched = true
    touching = true
    samples.length = 0
    grabReturn()
    // Snap is off from touchstart, so the browser has no snap animation of its
    // own to run against this one. The release owns it from here: every path
    // hands it back except the two that leave on a snapless scroller by design,
    // a commit and a close already in flight.
    scroll.style.scrollSnapType = 'none'
  }

  const dismiss = (flick = false): void => {
    blurFocusedDescendant(entry)
    // One duration for the whole event: the exit, the teardown delay and the
    // promotion underneath all read it, or the dim hands over early or late.
    const ms = dragCloseMs
    // close() first: it clears the inline registers a role flip still holds, so
    // an exit armed before it would be the thing that gets cleared.
    close(ms, flick)
    runSheetExit(entry, ms, flick ? FLICK_EASE : EXIT_EASE)
  }

  // The snap-back, the inverse of runSheetExit on the same curve and clock.
  // Taking the release off the scroller is what makes a fixed clock possible:
  // the browser's own snap times itself, so the sheet shoots back after one drag
  // and crawls after another.
  const runReturn = (): void => {
    // Reads first, as in runSheetExit.
    const max = readSnapMax()
    const before = scroll.scrollTop
    const ms = dragCloseMs
    // The freeze kills the fling and any pending native snap, and it has to be a
    // real freeze because touch scrolling runs on another thread. It lasts one
    // frame, not the whole return: an overflow:hidden element is not a scroll
    // container, so a finger landing on it rubber-bands the page instead. Write
    // order as in runSheetExit, for the same reason.
    scroll.style.scrollSnapType = 'none'
    scroll.scrollTop = max
    scroll.style.overflow = 'hidden'
    scroll.style.touchAction = 'none'
    scroll.scrollTop = max
    returning = true

    const thaw = (): void => {
      // Snap stays off for the rest of the flight: a finger arriving mid-return
      // puts the scroller between two points, and mandatory snap would fight it.
      scroll.style.overflow = ''
      scroll.style.touchAction = ''
      // Re-park: freezing only stops the user scrolling, Chrome resumes the
      // release's momentum in this very frame. A programmatic scroll cancels a
      // fling only once the element is a live scroller again, as it is here.
      scroll.scrollTop = max
    }
    const unfreeze = (): void => {
      thaw()
      scroll.style.scrollSnapType = ''
      returning = false
    }
    // Restoring mandatory snap re-snaps the scroller instantly and totally, with
    // no animation, so nothing below may drive off a scroll frame while
    // `returning` is set. The slack keeps that correction out of the card's last
    // animation frame, which lands a tick past `ms`.
    const SNAP_SLACK_MS = 32
    // Where the finger left everything. Every start value below derives from this
    // number: the rest values are written first, so a read-back would return the
    // destination instead.
    const L = Math.min(Math.max(before / max, 0), 1)

    // Rest state, written first; the animations below only cover the journey.
    const card = entry.card
    card.style.transform = ''
    if (entry.pageDim) backdrop.style.opacity = '1'
    if (entry.deck) entry.deck.under.scrim.style.opacity = '0.6'
    for (const c of entry.deck
      ? [...entry.deck.covered, ...(entry.deck.buried ? [entry.deck.buried] : [])]
      : []) {
      c.card.style.transform = ''
    }
    // Nothing may still read the deck as driven from here on.
    if (entry.deck) {
      entry.deck.under.driven = null
      for (const c of entry.deck.covered) c.driven = null
      if (entry.deck.buried) entry.deck.buried.driven = null
    }

    if (prefersReducedMotion()) {
      unfreeze()
      return
    }

    const ease = EXIT_EASE
    // Parking moved the card up by (max - before); the animation starts from that
    // offset, exactly where the finger let go, and closes it.
    const d = max - before
    runMotion(card, ease, ms, (p) => ({transform: `translateY(${d * (1 - p)}px)`}))
    // A timer, not the animation's onfinish: anything that supersedes this card's
    // motion cancels it, a cancelled animation never finishes, and the scroller
    // would stay frozen for the rest of the sheet's life.
    requestAnimationFrame(thaw)
    returnTimer = setTimeout(unfreeze, ms + SNAP_SLACK_MS)
    // The drive wrote the dim linearly in L, so that is where it rejoins from.
    if (entry.pageDim) {
      runMotion(backdrop, ease, ms, (p) => ({opacity: String(L + (1 - L) * p)}))
    }

    // Each deck card returns from the exact pose the drive left it in,
    // recomputed rather than read back, so this path touches no layout.
    const deck = entry.deck
    if (deck) {
      const from = drivenDim(L)
      runMotion(deck.under.scrim, ease, ms, (p) => ({
        opacity: String(from + (0.6 - from) * p),
      }))
      const u = reveal(L)
      for (const c of deck.covered) {
        runMotion(c.card, ease, ms, (p) => {
          const up = u + (1 - u) * p
          return {
            transform: `translateY(${c.stackTy * up}px) scale(${1 - (1 - c.scale) * up})`,
          }
        })
      }
      const b = deck.buried
      if (b) {
        runMotion(b.card, ease, ms, (p) => ({
          transform: `translateY(${b.stackTy - PEEK * (1 - L) * (1 - p)}px) scale(${b.scale})`,
        }))
      }
    }
  }

  const onScroll = (): void => {
    // A covered sheet still fires scroll (a resize clamps its scrollTop), and
    // writing opacity here would fight the values the role sync owns.
    if (entry.isClosing || entry.stackDepth) return
    // A stray frame during a return (a snap correction, a fling the freeze did
    // not eat) would fight the animations, and `touching` is already false, so a
    // big enough one would dismiss a sheet on its way home.
    if (returning || scroll.style.overflow === 'hidden') return

    const max = readSnapMax()
    const top = scroll.scrollTop
    // Two samples are kept regardless of age, so a gesture shorter than the
    // window still has something to measure.
    if (touching) {
      const now = performance.now()
      samples.push({t: now, top})
      while (samples.length > 2 && now - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift()
    }
    const progress = Math.min(Math.max(top / max, 0), 1)
    // The dims track the position linearly while the covered card's geometry
    // runs the reveal curve. They share the position, never a progress value.
    if (entry.pageDim) backdrop.style.opacity = String(progress)
    if (entry.openDone && entry.deck) {
      driveDeck(entry.deck, progress, !!(reducedMq && reducedMq.matches))
    }

    if (!entry.openDone) {
      if (progress > 0.99) {
        entry.openDone = true
        if (entry.props.closeDisabled) lockDrag(entry)
      } else if (touched && progress < 0.05) {
        // `touched` is required: the opening animation itself passes through low
        // progress, so only a real finger-drag dismisses mid-open.
        if (entry.props.closeDisabled) lockDrag(entry)
        else dismiss()
      }
      return
    }

    if (entry.props.closeDisabled) {
      lockDrag(entry)
      return
    }

    // Commit past the midpoint of the card's own travel, but never with a finger
    // still down: that decision belongs to the release. Trackpad, wheel and
    // devtools drags have no touch to wait for and commit at the crossing.
    if (max - top > commitAt() && !touching) {
      dismiss()
    }
  }

  // A flick moves one station in its direction of travel from wherever it is; a
  // slow release goes to the nearer station, midpoint as the boundary. Both
  // animations are ours, so the native snap never times a touch release.
  const release = (): void => {
    touching = false
    // A closing sheet is mid-exit on a deliberately snap-less scroller, so it is
    // the one release that must NOT hand snap back: re-snapping mid-flight
    // yanks the departing card home.
    if (entry.isClosing) return
    // Nothing here owns a gesture, but onTouchStart still took snap off, and a
    // finger that lands during the entrance and lifts before the drag arms would
    // otherwise leave the scroller snapless until the next full release.
    if (entry.stackDepth || !entry.openDone || entry.props.closeDisabled) {
      scroll.style.scrollSnapType = ''
      return
    }
    // Re-measured, not taken from the memo: the dynamic viewport moves under a
    // live sheet (URL bar, keyboard) without always firing resize, and a stale
    // max reads a resting sheet as displaced. Once per release, never per frame.
    snapMax = 0
    const shown = readSnapMax() - scroll.scrollTop
    // Nothing was displaced, so there is nothing to return. Touch events bubble
    // out of the card's own scroller, so this is the path every tap and every
    // content scroll takes, and a return played over a sheet that never moved is
    // half a second of the card travelling under a caret that stays put.
    if (shown <= REST_SLACK) {
      // The one path out that has to put snap back itself, see onTouchStart.
      scroll.style.scrollSnapType = ''
      return
    }
    // Only if the newest sample is fresh: a stale one is a stopped sheet.
    const a = samples[0]
    const b = samples[samples.length - 1]
    const fast =
      a && b && b.t - a.t >= 4 && performance.now() - b.t <= STALE_MS
        ? (a.top - b.top) / (b.t - a.t)
        : 0
    if (fast <= -FLICK_VELOCITY) runReturn()
    else if (fast >= FLICK_VELOCITY) dismiss(true)
    else if (shown > commitAt()) dismiss()
    else runReturn()
  }
  const onTouchEnd = (e: TouchEvent): void => {
    if (e.touches && e.touches.length > 0) return
    release()
  }
  const onTouchCancel = (e: TouchEvent): void => {
    // The browser took the gesture. Decide anyway, or this one release gets a
    // distance-timed native animation while every other runs on our fixed clock.
    if (!e.touches || e.touches.length === 0) release()
  }

  // visualViewport as well as window: the keyboard resizes the visual viewport
  // without always resizing the layout one, and a snap max measured on the other
  // side of that is what turns a resting sheet into a phantom drag.
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  window.addEventListener('resize', onResize)
  vv?.addEventListener('resize', onResize)
  scroll.addEventListener('touchstart', onTouchStart, {passive: true})
  scroll.addEventListener('touchend', onTouchEnd, {passive: true})
  scroll.addEventListener('touchcancel', onTouchCancel, {passive: true})
  scroll.addEventListener('scroll', onScroll, {passive: true})
  entry.cleanups.push(() => {
    window.removeEventListener('resize', onResize)
    vv?.removeEventListener('resize', onResize)
    scroll.removeEventListener('touchstart', onTouchStart)
    scroll.removeEventListener('touchend', onTouchEnd)
    scroll.removeEventListener('touchcancel', onTouchCancel)
    scroll.removeEventListener('scroll', onScroll)
  })
}

export function setupCloseHandlers(
  entry: SheetEntry,
  requestClose: () => void,
): void {
  const {dialog, backdrop, scroll, closedSpacer, panel} = entry

  // The dismiss surfaces, matched by node identity so consumer markup cannot
  // spoof one. Backdrop and spacer are pointer-events:none, so a press on the
  // dim hit-tests through to `scroll` or `panel`, and one on the native
  // ::backdrop retargets to the dialog.
  const dismissSurfaces = new Set<EventTarget>([
    dialog,
    backdrop,
    scroll,
    closedSpacer,
    panel,
  ])
  let pressedDismissSurface = false

  // Decided at pointerdown, not click: a sync re-render can detach the click
  // target, making a content click look like an outside click.
  const onPointerDown = (e: PointerEvent): void => {
    pressedDismissSurface = e.target != null && dismissSurfaces.has(e.target)
  }
  const onClick = (): void => {
    const dismiss = pressedDismissSurface
    pressedDismissSurface = false // don't let a stale press leak into a later click
    if (dismiss) requestClose()
  }
  // A press the browser takes over fires pointercancel and never a click, and
  // the next click can arrive with no pointerdown of its own (a keyboard
  // activation), which must not inherit the dead press's verdict.
  const onPointerCancel = (): void => {
    pressedDismissSurface = false
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
  dialog.addEventListener('pointercancel', onPointerCancel)
  dialog.addEventListener('click', onClick)
  dialog.addEventListener('cancel', onFileInputCancelCapture, {capture: true})
  dialog.addEventListener('cancel', onCancel)
  entry.cleanups.push(() => {
    dialog.removeEventListener('pointerdown', onPointerDown)
    dialog.removeEventListener('pointercancel', onPointerCancel)
    dialog.removeEventListener('click', onClick)
    dialog.removeEventListener('cancel', onFileInputCancelCapture, {
      capture: true,
    })
    dialog.removeEventListener('cancel', onCancel)
  })
}
