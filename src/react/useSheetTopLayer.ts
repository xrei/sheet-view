import {useSyncExternalStore} from 'react'

import type {SheetEntrySnapshot} from '../core/types'
import {sheets as defaultSheets} from './sheets'
import type {Sheets} from './sheets'

const EMPTY: SheetEntrySnapshot[] = []
const serverSnapshot = (): SheetEntrySnapshot[] => EMPTY

// Top-layer node of the topmost open (non-closing) sheet, or null. Portal global
// overlays (toasts) into it so they paint above the modal.
export function useSheetTopLayer(
  instance: Sheets = defaultSheets,
): HTMLElement | null {
  const {subscribe, getSnapshot} = instance.__host
  const entries = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry && !entry.isClosing) return entry.slots.toplayer
  }
  return null
}
