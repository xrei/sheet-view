import {createContext} from 'react'
import type {Context} from 'react'

import type {SheetLayers, SheetPhase, SheetSlots} from '../core/types'

/**
 * Everything a component rendered inside a sheet slot needs in order to place
 * a popover: the nodes to mount into, the nodes to measure against, and
 * whether measuring is safe yet.
 */
export interface SheetLayoutValue {
  /**
   * The positioning root for `layers.anchored` children — `position: relative`
   * and never clipping. This is the offsetParent your `strategy: 'absolute'`
   * coordinates resolve against.
   */
  card: HTMLElement
  /** The body scroller. A scroll ancestor of any trigger inside the content slot. */
  content: HTMLElement
  /**
   * The drag scroller, and the outermost thing that clips. Pass it as the
   * collision `boundary` of whatever positions your panel — the viewport is
   * the wrong boundary for a card-anchored menu.
   */
  scroll: HTMLElement
  /** Slot nodes of this sheet. */
  slots: SheetSlots
  /** Popover mount nodes of this sheet. */
  layers: SheetLayers
  /** Motion phase. `'settled'` means viewport-coordinate measurements are stable. */
  phase: SheetPhase
  /** True from the moment a close starts. Anchored panels should unmount. */
  isClosing: boolean
}

export const SheetLayoutContext: Context<SheetLayoutValue | null> =
  createContext<SheetLayoutValue | null>(null)
