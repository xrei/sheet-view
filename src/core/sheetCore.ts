import {createStore} from './observable'
import {DEV, devWarn} from './dev'
import {setPhase} from './phase'
import {scrollLock, zoomLock} from './locks'
import {applyRootStyle, buildDefaultHeader, buildSheetDOM, mountSlot} from './dom'
import {guardLayers, rescueLayers} from './layer'
import {
  ENTER_EASE,
  EXIT_EASE,
  FLICK_EASE,
  PEEK,
  blurFocusedDescendant,
  drivenDim,
  drivenPose,
  makeIsMobile,
  runDesktopExit,
  runMotion,
  runOpenAnimation,
  runSheetExit,
  setupCloseHandlers,
  setupDragToClose,
  stopMotion,
  syncDragLock,
  watchBreakpoint,
} from './gestures'
import type {SheetEntry} from './internal'
import type {
  SheetContext,
  SheetCore,
  SheetCoreOptions,
  SheetEntrySnapshot,
  SheetHandle,
  SheetOpenProps,
} from './types'

// Prefer aria-labelledby to the visible title: translation and voice-control
// tools translate referenced text but not aria-label.
function syncDialogLabel(entry: SheetEntry): void {
  const {props, dialog} = entry
  if (props.ariaLabel) {
    dialog.setAttribute('aria-label', props.ariaLabel)
    dialog.removeAttribute('aria-labelledby')
    return
  }
  const titleEl =
    typeof props.title === 'string' && props.title
      ? entry.slots.header.querySelector<HTMLElement>('[data-sheet-part="title"]')
      : null
  if (titleEl) {
    const id = `sv-sheet-title-${entry.id}`
    titleEl.id = id
    dialog.setAttribute('aria-labelledby', id)
    dialog.removeAttribute('aria-label')
    return
  }
  // A custom headerSlot owns the row, so there is no node to reference and
  // `title` names the dialog directly (WCAG 4.1.2).
  if (typeof props.title === 'string' && props.title) {
    dialog.setAttribute('aria-label', props.title)
    dialog.removeAttribute('aria-labelledby')
    return
  }
  dialog.removeAttribute('aria-label')
  dialog.removeAttribute('aria-labelledby')
  if (DEV)
    devWarn(
      'Sheet opened without an accessible name, pass `title` or `ariaLabel` (WCAG 4.1.2).',
    )
}

export function createSheetCore(options: SheetCoreOptions = {}): SheetCore {
  // Settle times, not round numbers: presentation 507ms, departure 517ms.
  const closeMs = options.closeMs ?? 517
  const dragCloseMs = options.dragCloseMs ?? 517
  // enterMs is the CSS entrance duration, base.css owns the animation itself.
  // The drag arms only once that entrance is over.
  const enterMs = options.enterMs
  const openSettleMs = options.openSettleMs ?? enterMs ?? 507
  const breakpoint = options.breakpoint ?? 768
  const useZoomLock = options.zoomLock ?? false
  const defaultCloseLabel = options.closeLabel ?? 'Close'
  const isMobile = makeIsMobile(breakpoint)

  const store = createStore<SheetEntrySnapshot[]>([])
  const sheetsByKey = new Map<string, SheetEntry>()
  const stack: SheetEntry[] = []
  let nextId = 1

  function project(entry: SheetEntry): SheetEntrySnapshot {
    return {
      id: entry.id,
      key: entry.props.key,
      isClosing: entry.isClosing,
      closeDisabled: !!entry.props.closeDisabled,
      slots: entry.slots,
      handle: entry.handle,
      layers: entry.layers,
      phase: entry.phase,
      card: entry.card,
      scroll: entry.scroll,
    }
  }

  // The only place the snapshot reference changes, everything else mutates
  // internal fields, so getSnapshot stays stable between emits.
  function emit(): void {
    store.setSnapshot(stack.map(project))
  }

  function mountSlots(entry: SheetEntry): void {
    const {props, slots, ctx} = entry
    mountSlot(
      slots.header,
      props.headerSlot,
      ctx,
      props.title != null
        ? () =>
            buildDefaultHeader({
              title: props.title ?? '',
              icon: slots.icon,
              closeIcon: slots.closeIcon,
              onClose: () => requestClose(entry),
              closeMuted: !!props.closeDisabled && !props.onCloseAttempt,
              closeHidden: !!props.closeHidden,
              closeLabel: props.closeLabel ?? defaultCloseLabel,
            })
        : undefined,
    )
    // mountSlot leaves the node untouched so it cannot wipe an external
    // renderer's content, so dropping the header we built ourselves is our job.
    if (props.headerSlot == null && props.title == null) {
      slots.header.querySelector('[data-sheet-part="default-header"]')?.remove()
    }
    mountSlot(slots.icon, props.icon, ctx)
    mountSlot(slots.closeIcon, props.closeIcon, ctx)
    mountSlot(slots.content, props.content, ctx)
    mountSlot(slots.footer, props.footer, ctx)
    mountSlot(slots.overlay, props.overlaySlot, ctx)
  }

  function updateEntry(entry: SheetEntry, nextProps: Partial<SheetOpenProps>): void {
    entry.props = {...entry.props, ...nextProps}
    mountSlots(entry)

    // Resetting className is safe: the card only ever carries sv-sheet__card
    // plus the consumer's cardClassName.
    entry.card.className = `sv-sheet__card${
      entry.props.cardClassName ? ` ${entry.props.cardClassName}` : ''
    }`
    entry.card.dataset['sheetSize'] = entry.props.size ?? 'lg'
    entry.dialog.className = `sv-sheet${
      entry.props.className ? ` ${entry.props.className}` : ''
    }`
    entry.rootStyleKeys = applyRootStyle(
      entry.dialog,
      entry.props.style,
      entry.rootStyleKeys,
    )
    syncDialogLabel(entry)

    syncDragLock(entry, isMobile)
    // A size change can flip who recedes, so re-walk, on the entrance pair: a
    // pose change from an update reads as an arrival, not as an exit.
    syncStackRoles(openSettleMs, ENTER_EASE)
    emit()
  }

  // Full-height sheets are the ones that push the cards below them back.
  function isFull(entry: SheetEntry): boolean {
    const s = entry.props.size ?? 'lg'
    return s === 'lg' || s === 'xl'
  }

  // Reads only: measuring flushes layout, and a flush between an attribute flip
  // and the animation carrying it makes the card teleport, so every read in a
  // role sync precedes the first write. The side inset is 16px narrow, 20px
  // otherwise; a shorter card riding a receding one sinks by the height
  // difference times the scale change, so both bottom edges land level.
  function measureStackPose(
    entry: SheetEntry,
    covered: boolean,
  ): {scale: number; ty: number} {
    const w = entry.card.offsetWidth
    const scale = w ? 1 - (2 * (w > 402 ? 20 : 16)) / w : 1
    const anchor = entry.anchor ?? entry
    let ty = covered ? (anchor.nested ? -PEEK : 0) : anchor.nested ? 0 : PEEK
    if (anchor !== entry) {
      ty -= (anchor.card.offsetHeight - entry.card.offsetHeight) * (1 - scale)
    }
    return {scale, ty}
  }

  // The write half: cached on the entry, which the drag drive reads per frame,
  // and mirrored to CSS for the rest poses.
  function writeStackPose(entry: SheetEntry, pose: {scale: number; ty: number}): void {
    entry.scale = pose.scale
    entry.stackTy = pose.ty
    entry.dialog.style.setProperty('--_sheet-recede-scale', String(pose.scale))
    entry.dialog.style.setProperty('--_sheet-stack-ty', `${pose.ty}px`)
  }

  // Recompute a posed card outside a role flip, a viewport change while it holds
  // the pose. Nothing is animating, so measure-then-write in place is safe.
  function applyStackPose(entry: SheetEntry): void {
    const covered = entry.dialog.dataset['sheetStack'] === 'covered'
    writeStackPose(entry, measureStackPose(entry, covered))
  }

  // The resting inline value of a sheet's full-viewport backdrop. Mobile rests
  // inline because drag frames own the register; desktop rests on CSS, except
  // the case CSS cannot see: a nested sheet whose undersheets all closed, now
  // the bottom-most and carrying the page dim.
  function restBackdrop(entry: SheetEntry): string {
    if (!entry.pageDim) return ''
    return isMobile() || entry.nested ? '1' : ''
  }

  // One walk owns every stack attribute and the per-entry drive state. `ms` and
  // `ease` are the event this sync rides on, and every property of every sheet
  // travels on that one curve, so the caller always names it.
  //
  // Depth counts non-closing entries only. A closing sheet keeps its role for the
  // whole exit (demoting it mid-flight cuts its dim) and the one beneath is
  // promoted at close-start, before the exit paints, so the two cross-fade.
  function syncStackRoles(ms: number, ease: string): void {
    const live: SheetEntry[] = []
    for (let i = stack.length - 1; i >= 0; i--) {
      const e = stack[i]!
      if (!e.isClosing) live.push(e) // live[0] = the top sheet
    }
    // A card recedes iff a full-height sheet sits above it and it is either
    // full-height itself or sitting directly on a receding full-height card,
    // the ride-along, which aligns its bottom edge to that card, its anchor.
    // "Above" is a top-down prefix, the ride-along chains bottom-up.
    const n = live.length
    const above: boolean[] = new Array(n)
    let fullAbove = false
    for (let i = 0; i < n; i++) {
      above[i] = fullAbove
      fullAbove ||= isFull(live[i]!)
    }
    const recede: boolean[] = new Array(n).fill(false)
    const anchor: Array<SheetEntry | null> = new Array(n).fill(null)
    for (let i = n - 1; i >= 0; i--) {
      const below = live[i + 1]
      if (!above[i]) continue
      if (isFull(live[i]!)) {
        recede[i] = true
        anchor[i] = live[i]!
      } else if (below != null && isFull(below) && recede[i + 1]!) {
        recede[i] = true
        anchor[i] = below
      }
    }

    // Stations, not indices. A receding card's pose slot is the number of
    // full-height sheets above it, capped at 2, and partial sheets add no depth.
    // Several cards can share the covered station; cards past the first at the
    // buried station are exact copies parked behind it, occluded by the nearest
    // natural full-height card, and stop painting. Non-receding covered sheets
    // keep two painted layers the same way.
    const values: Array<string | null> = new Array(n)
    let fulls = 0
    let seenBuried = false
    let naturals = 0
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        values[i] = null
      } else if (recede[i]) {
        values[i] =
          fulls < 2 ? 'covered' : seenBuried ? 'hidden' : ((seenBuried = true), 'buried')
      } else {
        naturals++
        values[i] = naturals === 1 ? 'covered' : naturals === 2 ? 'buried' : 'hidden'
      }
      if (isFull(live[i]!)) fulls++
    }

    const mobile = isMobile()

    // Pass 1, read: decide what flips and take every layout measurement it
    // needs. Nothing here writes and nothing after here reads, because a flush
    // between a flip and its transition eats the transition.
    const flips: Array<{
      entry: SheetEntry
      value: string | null
      pose: {scale: number; ty: number} | null
      from: {scale: number; ty: number} | null
      fromDim: number
      /** A style read, not layout. */
      fromPage: string
      /** panel.offsetTop, pre-read, when this flip must re-park the scroller. */
      repark: number | null
    }> = []
    for (let i = 0; i < n; i++) {
      const entry = live[i]!
      const value = values[i]!
      const wasValue = entry.dialog.dataset['sheetStack'] ?? null
      const wasRecede = entry.recede
      const wasDim = entry.dim
      const wasPage = entry.pageDim
      const wasScale = entry.scale
      const wasTy = entry.stackTy
      entry.stackDepth = i
      entry.recede = i > 0 && recede[i]!
      entry.anchor = anchor[i]!
      // The dim on a card is owned by the sheet above it: 0.6 of the dim colour
      // directly under the top card, 0.8 under anything deeper, flat however
      // deep the stack goes. The full-viewport backdrop belongs to the
      // bottom-most sheet alone, so the page shade is one dim deep at any depth.
      entry.dim = i === 0 ? 0 : i === 1 ? 0.6 : 0.8
      entry.pageDim = i === n - 1
      if (
        wasValue === value &&
        wasRecede === entry.recede &&
        wasDim === entry.dim &&
        wasPage === entry.pageDim
      )
        continue

      // Only mobile poses: desktop cards stay at their natural rect (see the
      // Stack section of base.css), so desktop needs no measurement at all.
      // A later crossing into mobile arrives through the resize handler.
      const pose =
        entry.recede && mobile ? measureStackPose(entry, value === 'covered') : null
      // Where this card and its dim actually are. While the finger is down the
      // drag drive owns both registers and poses them from the top card's
      // position, so the cached resting values are not what is on screen and a
      // journey composed from them starts at fully receded.
      const L = entry.driven
      const drivenFrom =
        L != null && (wasValue === 'covered' || wasValue === 'buried')
          ? drivenPose(wasValue, {scale: wasScale, ty: wasTy}, L)
          : {scale: wasScale, ty: wasTy}
      // 0.6 is the dim of the card directly under the top one, the only scrim
      // the drive touches, so the only one that can be mid-drag.
      const fromDim = L != null && wasDim === 0.6 ? drivenDim(L) : wasDim
      // Promotion re-parks, because snap drift accumulates while a card is not
      // rendering, and so does hidden going back to painting, because a resize
      // while hidden clamps scrollTop with the guard suppressed.
      const needsRepark = mobile && (value === null || wasValue === 'hidden')
      flips.push({
        entry,
        value,
        pose,
        from: wasRecede && mobile ? drivenFrom : null,
        fromDim,
        fromPage: entry.backdrop.style.opacity,
        repark: needsRepark ? entry.panel.offsetTop : null,
      })
    }

    // Pass 2, write: land every register on its resting value, then animate the
    // journey to it on the event's own curve, see runMotion in gestures.ts.
    for (const {entry, value, pose, from, fromDim, fromPage} of flips) {
      const {dialog, card, backdrop, scrim} = entry
      if (pose) writeStackPose(entry, pose)
      if (value === null) {
        delete dialog.dataset['sheetStack']
        delete dialog.dataset['sheetRecede']
      } else {
        dialog.dataset['sheetStack'] = value
        if (entry.recede) dialog.dataset['sheetRecede'] = ''
        else delete dialog.dataset['sheetRecede']
      }
      // Drop any per-frame drive pose: the rest pose is the CSS one now.
      card.style.transform = ''
      entry.driven = null
      scrim.style.opacity = entry.dim ? String(entry.dim) : ''
      // Desktop rests the backdrop on CSS and animates there, so only mobile
      // drives the register from here.
      const toPage = restBackdrop(entry)
      backdrop.style.opacity = toPage
      if (mobile && toPage !== fromPage) {
        const a = fromPage === '' ? 0 : Number(fromPage)
        const b = toPage === '' ? 0 : Number(toPage)
        runMotion(backdrop, ease, ms, (p) => ({opacity: String(a + (b - a) * p)}))
      }

      // Both ends of the pose flip are core-owned numbers, so the journey is
      // computed, never read back off the element.
      const to = entry.recede && mobile ? {scale: entry.scale, ty: entry.stackTy} : null
      if (from || to) {
        const a = from ?? {scale: 1, ty: 0}
        const b = to ?? {scale: 1, ty: 0}
        runMotion(card, ease, ms, (p) => ({
          transform: `translateY(${a.ty + (b.ty - a.ty) * p}px) scale(${
            a.scale + (b.scale - a.scale) * p
          })`,
        }))
      }
      if (fromDim !== entry.dim) {
        runMotion(scrim, ease, ms, (p) => ({
          opacity: String(fromDim + (entry.dim - fromDim) * p),
        }))
      }
    }

    // Pass 3, scroller re-park, last and separate: assigning scrollTop can flush
    // layout, so it must not sit between any flip and its transition. Promotion
    // also drops a scroller freeze left by a release interrupted mid-flight.
    for (const {entry, value, repark} of flips) {
      if (repark == null) continue
      if (value === null) {
        entry.scroll.style.scrollSnapType = ''
        entry.scroll.style.overflow = ''
        entry.scroll.style.touchAction = ''
      }
      entry.scroll.scrollTop = repark
    }

    // The drag drive's targets, posed per frame in gestures.ts as functions of
    // the top card's position: the scrim of the card directly beneath, every
    // receding card at the covered station, and the one live buried card. Only
    // the top sheet carries one; a demoted sheet drops it, or it holds the
    // entries beneath it reachable long after they close.
    for (let i = 1; i < n; i++) live[i]!.deck = null
    const top = live[0]
    if (top) {
      const under = live[1]
      if (!under) {
        top.deck = null
      } else {
        const covered: SheetEntry[] = []
        let buried: SheetEntry | undefined
        for (let i = 1; i < n; i++) {
          if (!live[i]!.recede) continue
          if (values[i] === 'covered') covered.push(live[i]!)
          else if (values[i] === 'buried') buried = live[i]!
        }
        top.deck = {under, covered, buried}
      }
    }
  }

  // Guarded close: X / backdrop / Escape / drag route here so closeDisabled
  // blocks them. handle.close() is the unguarded programmatic path.
  function requestClose(entry: SheetEntry): void {
    if (entry.props.closeDisabled) {
      entry.props.onCloseAttempt?.()
      return
    }
    closeEntry(entry)
  }

  function closeEntry(
    entry: SheetEntry,
    opts: {
      silent?: boolean
      dragged?: boolean
      immediate?: boolean
      exitMs?: number
      flick?: boolean
    } = {}): void {
    const silent = opts.silent ?? false
    const dragged = opts.dragged ?? false
    const immediate = opts.immediate ?? false
    if (entry.isClosing) return
    entry.isClosing = true
    // Take this sheet's registers back from a role flip that may still be in
    // flight, or a promotion animation keeps driving the card and dim straight
    // through the departure.
    stopMotion(entry.card)
    stopMotion(entry.scrim)
    stopMotion(entry.backdrop)
    // One number for the whole exit: the teardown delay below, the exit
    // animation, and the cross-fade the sheet underneath is promoted on must all
    // be the same, or the dim hands over early (flash) or late (double dim).
    const exitMs = opts.exitMs ?? (immediate ? 0 : dragged ? dragCloseMs : closeMs)
    // Desktop departs on the presentation curve, see ENTER_EASE.
    syncStackRoles(
      exitMs,
      !isMobile() ? ENTER_EASE : opts.flick ? FLICK_EASE : EXIT_EASE,
    )
    setPhase(entry, 'closing')

    // touch-action:none is what stops a late swipe-up from dragging the panel
    // back into view (WebKit touch scrolling ignores pointer-events).
    entry.scroll.style.touchAction = 'none'
    entry.scroll.style.pointerEvents = 'none'

    blurFocusedDescendant(entry)

    if (!silent) entry.props.onClose?.()

    entry.dialog.dataset['sheetState'] = 'closing'
    emit()

    // A dragged close already animates off a frozen scroller, and a native close
    // already removed the dialog. Otherwise the card leaves under its own JS
    // animation, so nothing here rides a CSS transition the entrance can block.
    if (!dragged && !immediate) {
      if (isMobile()) runSheetExit(entry, exitMs)
      else runDesktopExit(entry, exitMs)
    }

    entry.closeTimer = setTimeout(
      () => {
        for (const fn of entry.cleanups) {
          try {
            fn()
          } catch {
            /* already torn down */
          }
        }
        entry.cleanups.length = 0
        entry.phaseListeners.clear()

        // After the cleanups, so the layer guard is already disconnected.
        rescueLayers(entry.layers)

        const idx = stack.indexOf(entry)
        if (idx >= 0) stack.splice(idx, 1)
        const key = entry.props.key
        if (key && sheetsByKey.get(key) === entry) sheetsByKey.delete(key)
        emit()

        try {
          if (entry.dialog.open) entry.dialog.close()
        } catch {
          /* safari may throw mid-close */
        }
        entry.dialog.remove()

        scrollLock.release()
        if (useZoomLock) zoomLock.release()

        entry.props.onExited?.()
      },
      // No syncStackRoles here: the splice removes an entry the walk already
      // skipped, so every surviving role is already correct.
      exitMs)
  }

  function openSheet(props: SheetOpenProps): SheetHandle {
    if (props.key) {
      const existing = sheetsByKey.get(props.key)
      if (existing && !existing.isClosing) {
        const strategy = props.strategy ?? 'reuse'
        if (strategy === 'reuse') return existing.handle
        if (strategy === 'update') {
          updateEntry(existing, props)
          return existing.handle
        }
        if (strategy === 'replace') closeEntry(existing, {silent: true})
      }
    }

    const dom = buildSheetDOM(props)
    // Fixed for the sheet's life. Carries the height and peek geometry and the
    // dim-ladder position, see base.css.
    const nested = stack.some((e) => !e.isClosing)
    if (nested) dom.dialog.dataset['sheetNested'] = ''
    const entry: SheetEntry = {
      id: nextId++,
      dialog: dom.dialog,
      backdrop: dom.backdrop,
      scroll: dom.scroll,
      closedSpacer: dom.closedSpacer,
      panel: dom.panel,
      card: dom.card,
      scrim: dom.scrim,
      slots: dom.slots,
      layers: dom.layers,
      props,
      isClosing: false,
      stackDepth: 0,
      nested,
      recede: false,
      scale: 1,
      stackTy: 0,
      anchor: null,
      dim: 0,
      pageDim: !nested,
      deck: null,
      driven: null,
      openDone: false,
      phase: 'entering',
      phaseListeners: new Set(),
      notify: emit,
      rootStyleKeys: [],
      cleanups: [],
      closeTimer: null,
      handle: null as unknown as SheetHandle,
      ctx: null as unknown as SheetContext,
    }

    entry.handle = {
      id: entry.id,
      close: () => closeEntry(entry),
      update: (next: Partial<SheetOpenProps>) => updateEntry(entry, next),
      slots: entry.slots,
      layers: entry.layers,
      phase: () => entry.phase,
      onPhase: (listener) => {
        entry.phaseListeners.add(listener)
        return () => entry.phaseListeners.delete(listener)
      },
    }
    entry.ctx = {close: entry.handle.close, update: entry.handle.update}

    stack.push(entry)
    if (props.key) sheetsByKey.set(props.key, entry)

    document.body.append(entry.dialog)
    // The private input of --sheet-enter-duration: written only when set, and
    // read behind the public token, so a consumer's CSS override still wins
    // over this inline value.
    if (enterMs != null) {
      entry.dialog.style.setProperty('--_sheet-enter-ms', `${enterMs}ms`)
    }
    entry.rootStyleKeys = applyRootStyle(entry.dialog, props.style)
    mountSlots(entry)
    syncDialogLabel(entry)
    if (DEV && props.headerSlot == null) {
      if (props.icon != null && props.title == null) {
        devWarn(
          '`icon` was ignored: it renders in the default header, which only exists when `title` is set.')
      }
      if (props.closeIcon != null) {
        if (props.title == null) {
          devWarn(
            '`closeIcon` was ignored: it renders in the default header, which only exists when `title` is set.')
        } else if (props.closeHidden) {
          devWarn(
            '`closeIcon` was ignored: `closeHidden` removes the close button it would fill.')
        }
      }
    }
    scrollLock.acquire()
    if (useZoomLock) zoomLock.acquire()
    entry.cleanups.push(guardLayers(dom))
    setupCloseHandlers(entry, () => requestClose(entry))
    setupDragToClose(
      entry,
      (ms, flick) => closeEntry(entry, {dragged: true, exitMs: ms, flick}),
      isMobile,
      dragCloseMs,
    )
    // The receded pose is a function of the card's laid-out size.
    const onStackResize = (): void => {
      if (entry.recede) applyStackPose(entry)
    }
    window.addEventListener('resize', onStackResize)
    entry.cleanups.push(() => window.removeEventListener('resize', onStackResize))

    // A dialog can close outside our control: a <form method="dialog"> submit,
    // or a browser force-close that ignores our cancel preventDefault. Without
    // this the entry stays in the stack and the scroll lock never releases.
    const onNativeClose = (): void => {
      if (!entry.isClosing) closeEntry(entry, {immediate: true})
    }
    entry.dialog.addEventListener('close', onNativeClose)
    entry.cleanups.push(() =>
      entry.dialog.removeEventListener('close', onNativeClose))
    entry.cleanups.push(watchBreakpoint(entry, breakpoint))

    // Before showModal, so the demotions this open causes land in the same frame
    // the new sheet first paints, in lockstep with the entrance.
    syncStackRoles(openSettleMs, ENTER_EASE)

    entry.dialog.showModal()
    runOpenAnimation(entry, isMobile, openSettleMs)
    emit()

    return entry.handle
  }

  return {
    open: openSheet,
    closeAll(): void {
      for (const entry of [...stack]) closeEntry(entry)
    },
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,

    __resetForTests(): void {
      for (const entry of [...stack]) {
        if (entry.closeTimer) clearTimeout(entry.closeTimer)
        entry.phaseListeners.clear()
        for (const fn of entry.cleanups) {
          try {
            fn()
          } catch {}
        }
        try {
          if (entry.dialog.open) entry.dialog.close()
        } catch {}
        entry.dialog.remove()
        scrollLock.release()
        if (useZoomLock) zoomLock.release()
      }
      stack.length = 0
      sheetsByKey.clear()
      nextId = 1
      store.setSnapshot([])
    },
  }
}

/** The default shared core instance. */
export const sheetCore: SheetCore = createSheetCore()
