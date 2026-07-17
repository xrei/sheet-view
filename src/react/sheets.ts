import type {ReactNode} from 'react'

import {createSheetCore, sheetCore} from '../core/sheetCore'
import type {
  SheetContext,
  SheetCore,
  SheetHandle,
  SheetOpenProps,
} from '../core/types'

/** A React slot: a node, or a factory receiving the sheet's `{close, update}` ctx. */
export type ReactSlot = ReactNode | ((ctx: SheetContext) => ReactNode)

type DisplayProps = Omit<
  SheetOpenProps,
  'headerSlot' | 'content' | 'footer' | 'overlaySlot'
>

/** Props accepted by `sheets.open(...)`. Slots widen to `ReactNode`. */
export interface SheetReactProps extends DisplayProps {
  headerSlot?: ReactSlot
  content?: ReactSlot
  footer?: ReactSlot
  overlaySlot?: ReactSlot
  /** @deprecated Use `ariaLabel`. Kept as a runtime alias for parity. */
  'aria-label'?: string
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
  content?: ReactSlot
  footer?: ReactSlot
  overlaySlot?: ReactSlot
}

/** @internal Wiring consumed by `<SheetHost>` and `useSheetTopLayer`. */
export interface SheetsHostBinding {
  subscribe: SheetCore['subscribe']
  getSnapshot: SheetCore['getSnapshot']
  getRenderFns: (id: number) => SheetRenderFns | undefined
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

const RENDER_KEYS = [
  'headerSlot',
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

const SKIP_KEYS = new Set<string>([...RENDER_KEYS, 'aria-label', 'ariaLabel'])

function toDisplayProps(
  props: Partial<SheetReactProps>,
  includeTitle: boolean,
): SheetOpenProps {
  const display: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (SKIP_KEYS.has(k)) continue
    if (v === undefined) continue
    display[k] = v
  }
  const aria = props.ariaLabel ?? props['aria-label']
  if (aria !== undefined) display['ariaLabel'] = aria
  if (!includeTitle) delete display['title']
  return display as SheetOpenProps
}

export function createSheets(core: SheetCore = createSheetCore()): Sheets {
  const renderMap = new Map<number, SheetRenderFns>()
  const publicHandleById = new Map<number, SheetPublicHandle>()

  function updateHandle(
    id: number,
    coreHandle: SheetHandle,
    next: Partial<SheetReactProps>,
  ): void {
    const renderFns = pickRenderFns(next)
    if (Object.keys(renderFns).length) {
      renderMap.set(id, {...(renderMap.get(id) ?? {}), ...renderFns})
    }
    // Title passes through only when there's no custom (React-owned) header.
    const hasCustomHeader = renderMap.get(id)?.headerSlot != null
    coreHandle.update(toDisplayProps(next, !hasCustomHeader))
  }

  function open(props: SheetReactProps = {}): SheetPublicHandle {
    const hasCustomHeader = props.headerSlot != null
    const strategy = props.strategy ?? 'reuse'

    let id = 0
    const coreOnExited = (): void => {
      props.onExited?.()
      renderMap.delete(id)
      publicHandleById.delete(id)
    }

    const coreHandle = core.open({
      ...toDisplayProps(props, !hasCustomHeader),
      onExited: coreOnExited,
    })
    id = coreHandle.id

    const existedBefore = publicHandleById.has(id)

    if (existedBefore && strategy === 'reuse') {
      return publicHandleById.get(id)!
    }
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
    },
    __resetForTests(): void {
      core.__resetForTests()
      renderMap.clear()
      publicHandleById.clear()
    },
  }
}

/** The default facade, bound to the shared `sheetCore` singleton. */
export const sheets: Sheets = createSheets(sheetCore)
