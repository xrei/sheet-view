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
  /**
   * The card's own dim overlay, clipped to this card. Cards are opaque, so
   * exactly one dim reaches any pixel however deep the stack goes.
   */
  scrim: HTMLElement
  slots: SheetSlots
  layers: SheetLayers
  props: SheetOpenProps
  isClosing: boolean
  /**
   * Position in the render model: 0 = top, 1 = covered, 2 = buried, ≥3 = hidden.
   * Mirrors `data-sheet-stack`.
   */
  stackDepth: number
  /** Opened over another sheet. Fixed at open(); mirrors `data-sheet-nested`. */
  nested: boolean
  /** Currently holds the receded pose. Mirrors `data-sheet-recede`. */
  recede: boolean
  /**
   * The receded scale: (cardWidth − 2·inset) / cardWidth, mirrored to
   * `--_sheet-recede-scale` for CSS.
   */
  scale: number
  /**
   * The receded pose's vertical offset in px, mirrored to `--_sheet-stack-ty`.
   * A shorter card riding a full-height one keeps their bottom edges flush.
   */
  stackTy: number
  /**
   * The full-height card this card's pose aligns to: itself when full-height,
   * the card directly below when riding along. Null while not receding.
   */
  anchor: SheetEntry | null
  /**
   * The dim resting on THIS card's scrim: 0 on top, 0.6 directly under the top
   * sheet, 0.8 deeper.
   */
  dim: number
  /**
   * This sheet's full-viewport backdrop dims the page, true only for the
   * bottom-most live sheet. Every other sheet's backdrop stays transparent.
   */
  pageDim: boolean
  /**
   * Set on the TOP sheet only: what the drag drive poses per frame. Null when
   * nothing is beneath.
   */
  deck: {
    under: SheetEntry
    covered: SheetEntry[]
    buried: SheetEntry | undefined
  } | null
  /**
   * The top card's position this card was last POSED at, or null when it rests
   * at its role pose. The drive is a pure function of it, so it reconstructs
   * where the card and its dim are, which is what a role flip animates FROM.
   */
  driven: number | null
  openDone: boolean
  phase: SheetPhase
  phaseListeners: Set<(phase: SheetPhase) => void>
  /** Re-emits the store snapshot. Wired to the core's `emit`. */
  notify: () => void
  /** Dash-case keys last applied to the root dialog from props.style, cleared on the next update. */
  rootStyleKeys: string[]
  cleanups: Array<() => void>
  closeTimer: ReturnType<typeof setTimeout> | null
  handle: SheetHandle
  ctx: SheetContext
}

/** The static DOM shell built by `buildSheetDOM`. */
export interface SheetDOM {
  dialog: HTMLDialogElement
  backdrop: HTMLElement
  scroll: HTMLElement
  closedSpacer: HTMLElement
  panel: HTMLElement
  card: HTMLElement
  scrim: HTMLElement
  slots: SheetSlots
  layers: SheetLayers
  /** Permanent invisible child per layer, so a layer never looks empty. */
  sentinels: {anchored: HTMLElement; viewport: HTMLElement}
}
