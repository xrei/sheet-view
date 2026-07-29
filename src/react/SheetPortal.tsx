import {useContext} from 'react'
import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'

import type {SheetLayerName} from '../core/types'
import {SheetLayoutContext} from './SheetLayoutContext'
import type {Sheets} from './sheets'
import {useSheetPortalTarget} from './useSheetPortalTarget'
import type {SheetPortalTargetOptions} from './useSheetPortalTarget'

export interface SheetPortalProps {
  children: ReactNode
  /**
   * `'anchored'` (default) mounts inside the card: unclipped, moves with the card
   * through the entrance / drag / exit, and a click here never dismisses the
   * sheet. Position children `absolute` — the card is their offsetParent.
   *
   * `'viewport'` mounts in the sheet's top layer: above the card, viewport-fixed,
   * does not follow the card. Position children `fixed`.
   *
   * Never use `position: fixed` inside the card: the card is a fixed-positioning
   * containing block only *while it animates*, so a fixed descendant jumps when
   * the entrance ends. Use `'viewport'` instead.
   */
  layer?: SheetLayerName
  /** Stay mounted while the sheet closes — for an exit-animated toast. Default `false`. */
  keepOnClose?: boolean
  /** Facade to read when rendered outside a sheet slot. Defaults to the `sheets` singleton. */
  instance?: Sheets
}

/**
 * Portals a popover into the right place inside an open sheet.
 *
 * The wrapper it renders is `display: contents` — it generates no box, so it
 * cannot swallow a backdrop press or the drag gesture, while `pointer-events`
 * still reaches the children by inheritance. That is the difference between this
 * and a hand-written `createPortal(node, topLayer)`, where a full-bleed
 * `pointer-events: auto` wrapper silently disables drag-to-close.
 */
export function SheetPortal({
  children,
  layer = 'anchored',
  keepOnClose = false,
  instance,
}: SheetPortalProps): ReactNode {
  const layout = useContext(SheetLayoutContext)
  const options: SheetPortalTargetOptions = instance ? {layer, instance} : {layer}
  const target = useSheetPortalTarget(options)

  // An anchored panel measured against a card that is sliding away is wrong, and
  // the top layer stays clickable for the whole exit — so leave by default.
  if (!keepOnClose && layout?.isClosing === true) return null
  if (!target) return null

  return createPortal(
    <div style={{display: 'contents', pointerEvents: 'auto'}}>{children}</div>,
    target,
  )
}
