import {useMemo, useSyncExternalStore} from 'react'
import type {ErrorInfo, ReactNode} from 'react'
import {createPortal} from 'react-dom'

import type {SheetEntrySnapshot} from '../core/types'
import {SheetLayoutContext} from './SheetLayoutContext'
import type {SheetLayoutValue} from './SheetLayoutContext'
import {SlotBoundary} from './SlotBoundary'
import {RENDER_KEYS, sheets as defaultSheets} from './sheets'
import type {
  ReactSlot,
  SheetPublicHandle,
  SheetReactContext,
  SheetReactProps,
  SheetRenderFns,
  Sheets,
} from './sheets'

// Stable identity so getSnapshot === the server snapshot during hydration.
const EMPTY: SheetEntrySnapshot[] = []
const serverSnapshot = (): SheetEntrySnapshot[] => EMPTY

/** Reported when a slot throws. `slot` is the prop name that failed. */
export type SheetSlotErrorHandler = (
  error: unknown,
  info: ErrorInfo,
  slot: string,
) => void

export interface SheetHostProps {
  /** The facade to render. Defaults to the shared `sheets` singleton. */
  instance?: Sheets
  /**
   * Called when a slot throws, after the library logs it. A reporting seam for
   * Sentry / `onCaughtError`, not a place to render a fallback: the failed slot
   * renders nothing.
   */
  onSlotError?: SheetSlotErrorHandler
}

export function SheetHost({
  instance = defaultSheets,
  onSlotError,
}: SheetHostProps): ReactNode {
  const {subscribe, getSnapshot, getRenderFns, getHandle} = instance.__host
  const entries = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  return entries.map((entry) => (
    <SheetPortals
      key={entry.id}
      entry={entry}
      publicHandle={getHandle(entry.id)}
      getRenderFns={getRenderFns}
      onSlotError={onSlotError}
    />
  ))
}

interface SheetPortalsProps {
  entry: SheetEntrySnapshot
  publicHandle: SheetPublicHandle | undefined
  getRenderFns: (id: number) => SheetRenderFns | undefined
  onSlotError: SheetSlotErrorHandler | undefined
}

/**
 * Invokes a slot factory. It happens in a child of the boundary: calling it in
 * SheetPortals' own render would put a throwing factory outside the boundary.
 */
function SlotRender({
  slot,
  ctx,
}: {
  slot: ReactSlot
  ctx: SheetReactContext
}): ReactNode {
  return typeof slot === 'function'
    ? (slot as (c: SheetReactContext) => ReactNode)(ctx)
    : (slot ?? null)
}

function SheetPortals({
  entry,
  publicHandle,
  getRenderFns,
  onSlotError,
}: SheetPortalsProps): ReactNode {
  const {slots, handle, layers, card, scroll, phase, isClosing} = entry
  // The ctx `update` must be the facade's, not the core handle's: a ReactNode
  // routed through the core resolves to nothing and replaceChildren()s the slot
  // empty, wiping the portal DOM React renders into. The fallback strips the
  // slot keys for the same reason.
  const ctx = useMemo<SheetReactContext>(
    () => ({
      close: handle.close,
      update:
        publicHandle?.update ??
        ((next: Partial<SheetReactProps>): void => {
          const display = {...next}
          for (const k of RENDER_KEYS) delete display[k]
          handle.update(display as Parameters<typeof handle.update>[0])
        }),
    }),
    [handle, publicHandle],
  )
  const layout = useMemo<SheetLayoutValue>(
    () => ({card, content: slots.content, scroll, slots, layers, phase, isClosing}),
    [card, scroll, slots, layers, phase, isClosing],
  )

  const fns = getRenderFns(entry.id)
  if (!fns) return null

  const portal = (
    name: string,
    slot: ReactSlot | undefined,
    target: HTMLElement,
  ): ReactNode =>
    slot == null
      ? null
      : createPortal(
          <SlotBoundary
            slot={name}
            onError={
              onSlotError
                ? (error, info) => onSlotError(error, info, name)
                : undefined
            }
          >
            <SlotRender slot={slot} ctx={ctx} />
          </SlotBoundary>,
          target,
        )

  return (
    <SheetLayoutContext.Provider value={layout}>
      {portal('headerSlot', fns.headerSlot, slots.header)}
      {/* A custom header owns the whole row, so neither glyph has anywhere to go. */}
      {fns.headerSlot == null && portal('icon', fns.icon, slots.icon)}
      {fns.headerSlot == null &&
        portal('closeIcon', fns.closeIcon, slots.closeIcon)}
      {portal('content', fns.content, slots.content)}
      {portal('footer', fns.footer, slots.footer)}
      {portal('overlaySlot', fns.overlaySlot, slots.overlay)}
    </SheetLayoutContext.Provider>
  )
}
