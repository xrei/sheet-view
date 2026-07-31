import type {
  SheetContext,
  SheetHandle,
  SheetLayers,
  SheetOpenProps,
  SheetPhase,
  SheetSlots,
} from './types'

/** The full mutable state of one open sheet. */
export interface SheetEntry {
  id: number
  dialog: HTMLDialogElement
  backdrop: HTMLElement
  scroll: HTMLElement
  closedSpacer: HTMLElement
  panel: HTMLElement
  card: HTMLElement
  slots: SheetSlots
  layers: SheetLayers
  props: SheetOpenProps
  isClosing: boolean
  openDone: boolean
  phase: SheetPhase
  phaseListeners: Set<(phase: SheetPhase) => void>
  /** Re-emits the store snapshot. Wired to the core's `emit` so phase.ts can notify. */
  notify: () => void
  /** Dash-case keys last applied to the root dialog from props.style — cleared on the next update. */
  rootStyleKeys: string[]
  cleanups: Array<() => void>
  closeTimer: ReturnType<typeof setTimeout> | null
  handle: SheetHandle
  ctx: SheetContext
}

/** The static DOM shell built by `buildSheetDOM` (before lifecycle state is attached). */
export interface SheetDOM {
  dialog: HTMLDialogElement
  backdrop: HTMLElement
  scroll: HTMLElement
  closedSpacer: HTMLElement
  panel: HTMLElement
  card: HTMLElement
  slots: SheetSlots
  layers: SheetLayers
  /** Permanent invisible child per layer — the "never looks empty" guarantee. */
  sentinels: {anchored: HTMLElement; viewport: HTMLElement}
}
