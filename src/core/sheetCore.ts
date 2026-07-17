import {createStore} from './observable'
import {scrollLock, zoomLock} from './locks'
import {applyRootStyle, buildDefaultHeader, buildSheetDOM, mountSlot} from './dom'
import {
  blurFocusedDescendant,
  makeIsMobile,
  prefersReducedMotion,
  runOpenAnimation,
  setupCloseHandlers,
  setupDragToClose,
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

// Prefer aria-labelledby to the visible <h2> (Google Translate / Voice Control
// translate referenced text but not aria-label). Explicit ariaLabel still wins;
// a nameless sheet is a WCAG 4.1.2 failure, so warn in dev.
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
  dialog.removeAttribute('aria-label')
  dialog.removeAttribute('aria-labelledby')
  // globalThis.process (not bare `process`) so this compiles without @types/node
  // and can't throw in a bundler-less browser (the vanilla example loads dist raw).
  const nodeEnv = (globalThis as {process?: {env?: {NODE_ENV?: string}}}).process
    ?.env?.NODE_ENV
  if (nodeEnv !== 'production') {
    console.warn(
      '[sheet-view] Sheet opened without an accessible name — pass `title` or `ariaLabel` (WCAG 4.1.2).',
    )
  }
}

export function createSheetCore(options: SheetCoreOptions = {}): SheetCore {
  const closeMs = options.closeMs ?? 320
  const dragCloseMs = options.dragCloseMs ?? 220
  const openSettleMs = options.openSettleMs ?? 400
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
    }
  }

  // The only place the snapshot reference changes — everything else mutates
  // internal fields, keeping getSnapshot stable so useSyncExternalStore can't tear.
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
            buildDefaultHeader(
              props.title ?? '',
              () => requestClose(entry),
              !!props.closeDisabled && !props.onCloseAttempt,
              !!props.closeHidden,
              props.closeLabel ?? defaultCloseLabel,
              props.closeIcon,
              ctx,
            )
        : undefined,
    )
    mountSlot(slots.content, props.content, ctx)
    mountSlot(slots.footer, props.footer, ctx)
    mountSlot(slots.overlay, props.overlaySlot, ctx)
  }

  function updateEntry(entry: SheetEntry, nextProps: Partial<SheetOpenProps>): void {
    entry.props = {...entry.props, ...nextProps}
    mountSlots(entry)

    // Declarative props that live on the DOM (not in a slot) must re-sync too —
    // README promises update() merges *all* props. Resetting className is safe:
    // the card only ever carries sv-sheet__card + the consumer's cardClassName.
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
    emit()
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
    opts: {silent?: boolean; dragged?: boolean; immediate?: boolean} = {},
  ): void {
    const silent = opts.silent ?? false
    const dragged = opts.dragged ?? false
    const immediate = opts.immediate ?? false
    if (entry.isClosing) return
    entry.isClosing = true

    // touch-action:none is what stops a late swipe-up from dragging the panel
    // back into view (WebKit touch scrolling ignores pointer-events).
    entry.scroll.style.touchAction = 'none'
    entry.scroll.style.pointerEvents = 'none'

    blurFocusedDescendant(entry)

    if (!silent) entry.props.onClose?.()

    entry.dialog.dataset['sheetState'] = 'closing'
    emit()

    // A dragged close already animates off a frozen scroller; a native close
    // already removed the dialog. Otherwise slide the still-visible card down —
    // instantly under reduced motion.
    if (!dragged && !immediate) {
      if (prefersReducedMotion()) {
        entry.scroll.scrollTop = 0
      } else {
        try {
          entry.scroll.scrollTo({top: 0, behavior: 'smooth'})
        } catch {
          entry.scroll.scrollTop = 0
        }
      }
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
      immediate ? 0 : dragged ? dragCloseMs : closeMs,
    )
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
    const entry: SheetEntry = {
      id: nextId++,
      dialog: dom.dialog,
      backdrop: dom.backdrop,
      scroll: dom.scroll,
      closedSpacer: dom.closedSpacer,
      panel: dom.panel,
      card: dom.card,
      slots: dom.slots,
      props,
      isClosing: false,
      openDone: false,
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
    }
    entry.ctx = {close: entry.handle.close, update: entry.handle.update}

    stack.push(entry)
    if (props.key) sheetsByKey.set(props.key, entry)

    document.body.append(entry.dialog)
    entry.rootStyleKeys = applyRootStyle(entry.dialog, props.style)
    mountSlots(entry)
    syncDialogLabel(entry)
    scrollLock.acquire()
    if (useZoomLock) zoomLock.acquire()
    setupCloseHandlers(entry, () => requestClose(entry))
    setupDragToClose(
      entry,
      () => closeEntry(entry, {dragged: true}),
      isMobile,
      dragCloseMs,
    )

    // A dialog can close outside our control — a <form method="dialog"> submit, or
    // a browser force-close that ignores our cancel preventDefault. Without this
    // the entry stays in the stack and the scroll lock never releases (page frozen).
    const onNativeClose = (): void => {
      if (!entry.isClosing) closeEntry(entry, {immediate: true})
    }
    entry.dialog.addEventListener('close', onNativeClose)
    entry.cleanups.push(() =>
      entry.dialog.removeEventListener('close', onNativeClose),
    )
    entry.cleanups.push(watchBreakpoint(entry, breakpoint))

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
