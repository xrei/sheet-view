import type {ReactNode} from 'react'

import {createSheetCore, sheetCore} from '../core/sheetCore'
import type {SheetCore, SheetHandle, SheetOpenProps} from '../core/types'

/**
 * The `{close, update}` ctx handed to React slot factories. Its `update` is the
 * FACADE's (accepts `ReactNode` slots), not the core's — a ReactNode routed into
 * the core would resolve to nothing and wipe the very portal DOM React is
 * rendering the slot into.
 */
export interface SheetReactContext {
  close: () => void
  update: (next: Partial<SheetReactProps>) => void
}

/** A React slot: a node, or a factory receiving the sheet's `{close, update}` ctx. */
export type ReactSlot = ReactNode | ((ctx: SheetReactContext) => ReactNode)

type DisplayProps = Omit<
  SheetOpenProps,
  'headerSlot' | 'icon' | 'closeIcon' | 'content' | 'footer' | 'overlaySlot'
>

/** Props accepted by `sheets.open(...)`. Slots widen to `ReactNode`. */
export interface SheetReactProps extends DisplayProps {
  headerSlot?: ReactSlot
  icon?: ReactSlot
  closeIcon?: ReactSlot
  content?: ReactSlot
  footer?: ReactSlot
  overlaySlot?: ReactSlot
}

/** The handle returned by `sheets.open(...)`. Stable for the sheet's life. */
export interface SheetPublicHandle {
  id: number
  close: () => void
  update: (next: Partial<SheetReactProps>) => void
}

/** React slot render-fns tracked per sheet id. */
export interface SheetRenderFns {
  headerSlot?: ReactSlot
  icon?: ReactSlot
  closeIcon?: ReactSlot
  content?: ReactSlot
  footer?: ReactSlot
  overlaySlot?: ReactSlot
}

/** @internal Wiring consumed by `<SheetHost>` and `useSheetPortalTarget`. */
export interface SheetsHostBinding {
  subscribe: SheetCore['subscribe']
  getSnapshot: SheetCore['getSnapshot']
  getRenderFns: (id: number) => SheetRenderFns | undefined
  /** The facade handle for a sheet — the ctx `update` React slots must receive. */
  getHandle: (id: number) => SheetPublicHandle | undefined
}

/** The imperative facade returned by `createSheets(...)`. */
export interface Sheets {
  open: (props?: SheetReactProps) => SheetPublicHandle
  closeAll: () => void
  /** True while any open sheet has `closeDisabled` — handy for beforeunload guards. */
  hasLocked: () => boolean
  /** @internal */
  readonly __host: SheetsHostBinding
  /** @internal Test-only synchronous teardown. */
  __resetForTests: () => void
}

/** @internal The prop keys that hold React slots (stripped before the core). */
export const RENDER_KEYS = [
  'headerSlot',
  'icon',
  'closeIcon',
  'content',
  'footer',
  'overlaySlot',
] as const
type RenderKey = (typeof RENDER_KEYS)[number]

function pickRenderFns(props: Partial<SheetReactProps>): SheetRenderFns {
  const out: SheetRenderFns = {}
  for (const k of RENDER_KEYS) {
    const value = (props as Record<RenderKey, ReactSlot | undefined>)[k]
    if (k in props && value !== undefined) out[k] = value
  }
  return out
}

const SKIP_KEYS = new Set<string>(RENDER_KEYS)

function toDisplayProps(
  props: Partial<SheetReactProps>,
  includeTitle: boolean,
  fallbackTitle?: string,
): SheetOpenProps {
  const display: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (SKIP_KEYS.has(k)) continue
    if (v === undefined) continue
    display[k] = v
  }
  if (!includeTitle) {
    // Erase, don't delete: the core MERGES props on update(), so deleting the key
    // here leaves an earlier title in place, mountSlots rebuilds the default
    // header underneath the React-owned one, and the stale <h2> keeps
    // aria-labelledby — two headers and a name that doesn't match the visible one.
    display['title'] = undefined
    // The core can't fall back to `title` once it's erased, so carry the name
    // across ourselves rather than leaving the dialog unnamed.
    if (display['ariaLabel'] === undefined && fallbackTitle) {
      display['ariaLabel'] = fallbackTitle
    }
  }
  return display as SheetOpenProps
}

export function createSheets(core: SheetCore = createSheetCore()): Sheets {
  const renderMap = new Map<number, SheetRenderFns>()
  const publicHandleById = new Map<number, SheetPublicHandle>()
  // Last `title` seen per sheet. An update() patch that only sets `headerSlot`
  // carries no title, but the dialog still needs a name — this is that memory.
  const titleById = new Map<number, string>()

  function updateHandle(
    id: number,
    coreHandle: SheetHandle,
    next: Partial<SheetReactProps>,
  ): void {
    const renderFns = pickRenderFns(next)
    if (Object.keys(renderFns).length) {
      renderMap.set(id, {...(renderMap.get(id) ?? {}), ...renderFns})
    }
    if (next.title != null) titleById.set(id, next.title)
    // Title passes through only when there's no custom (React-owned) header.
    const hasCustomHeader = renderMap.get(id)?.headerSlot != null
    coreHandle.update(toDisplayProps(next, !hasCustomHeader, titleById.get(id)))
  }

  function open(props: SheetReactProps = {}): SheetPublicHandle {
    const strategy = props.strategy ?? 'reuse'

    // A keyed re-open that omits headerSlot but passes a title would otherwise
    // rebuild the default header under the live React-owned one, so the decision
    // has to consult the sheet already on screen, not just this call's props.
    const live =
      props.key != null
        ? core.getSnapshot().find((e) => e.key === props.key && !e.isClosing)
        : undefined
    const hasCustomHeader =
      props.headerSlot != null ||
      (live != null &&
        strategy === 'update' &&
        renderMap.get(live.id)?.headerSlot != null)
    const fallbackTitle =
      props.title ?? (live != null ? titleById.get(live.id) : undefined)

    let id = 0
    const coreOnExited = (): void => {
      props.onExited?.()
      renderMap.delete(id)
      publicHandleById.delete(id)
      titleById.delete(id)
    }

    const coreHandle = core.open({
      ...toDisplayProps(props, !hasCustomHeader, fallbackTitle),
      onExited: coreOnExited,
    })
    id = coreHandle.id

    const existedBefore = publicHandleById.has(id)

    if (existedBefore && strategy === 'reuse') {
      return publicHandleById.get(id)!
    }
    if (props.title != null) titleById.set(id, props.title)
    if (existedBefore && strategy === 'update') {
      renderMap.set(id, {
        ...(renderMap.get(id) ?? {}),
        ...pickRenderFns(props),
      })
      return publicHandleById.get(id)!
    }

    renderMap.set(id, pickRenderFns(props))
    const handle: SheetPublicHandle = {
      id,
      close: coreHandle.close,
      update: (next) => updateHandle(id, coreHandle, next),
    }
    publicHandleById.set(id, handle)
    return handle
  }

  return {
    open,
    closeAll(): void {
      core.closeAll()
    },
    hasLocked(): boolean {
      return core.getSnapshot().some((e) => e.closeDisabled)
    },
    __host: {
      subscribe: core.subscribe,
      getSnapshot: core.getSnapshot,
      getRenderFns: (id) => renderMap.get(id),
      getHandle: (id) => publicHandleById.get(id),
    },
    __resetForTests(): void {
      core.__resetForTests()
      renderMap.clear()
      publicHandleById.clear()
      titleById.clear()
    },
  }
}

/** The default facade, bound to the shared `sheetCore` singleton. */
export const sheets: Sheets = createSheets(sheetCore)
