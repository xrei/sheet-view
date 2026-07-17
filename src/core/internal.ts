import type {SheetContext, SheetHandle, SheetOpenProps, SheetSlots} from './types'

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
  props: SheetOpenProps
  isClosing: boolean
  openDone: boolean
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
}
