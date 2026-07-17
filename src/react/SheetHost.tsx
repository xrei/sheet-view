import {useMemo, useSyncExternalStore} from 'react'
import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'

import type {SheetContext, SheetEntrySnapshot} from '../core/types'
import {sheets as defaultSheets} from './sheets'
import type {ReactSlot, SheetRenderFns, Sheets} from './sheets'

// Stable empty snapshot so getSnapshot === the server snapshot during SSR /
// hydration (no portals against DOM that doesn't exist on the server).
const EMPTY: SheetEntrySnapshot[] = []
const serverSnapshot = (): SheetEntrySnapshot[] => EMPTY

export interface SheetHostProps {
  /** The facade to render. Defaults to the shared `sheets` singleton. */
  instance?: Sheets
}

export function SheetHost({instance = defaultSheets}: SheetHostProps): ReactNode {
  const {subscribe, getSnapshot, getRenderFns} = instance.__host
  const entries = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  return entries.map((entry) => (
    <SheetPortals key={entry.id} entry={entry} getRenderFns={getRenderFns} />
  ))
}

interface SheetPortalsProps {
  entry: SheetEntrySnapshot
  getRenderFns: (id: number) => SheetRenderFns | undefined
}

function SheetPortals({entry, getRenderFns}: SheetPortalsProps): ReactNode {
  const {slots, handle} = entry
  const ctx = useMemo<SheetContext>(
    () => ({close: handle.close, update: handle.update}),
    [handle],
  )

  const fns = getRenderFns(entry.id)
  if (!fns) return null

  const resolve = (slot: ReactSlot | undefined): ReactNode =>
    typeof slot === 'function'
      ? (slot as (c: SheetContext) => ReactNode)(ctx)
      : (slot ?? null)

  return (
    <>
      {fns.headerSlot != null &&
        createPortal(resolve(fns.headerSlot), slots.header)}
      {fns.content != null && createPortal(resolve(fns.content), slots.content)}
      {fns.footer != null && createPortal(resolve(fns.footer), slots.footer)}
      {fns.overlaySlot != null &&
        createPortal(resolve(fns.overlaySlot), slots.overlay)}
    </>
  )
}
