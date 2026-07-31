import {useContext, useEffect, useState} from 'react'
import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'

import {liveMove} from '../core/layer'
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
 * Owns one stable `display: contents` host: it generates no box, so it cannot
 * swallow a backdrop press or the drag gesture, and a target change only moves
 * the host — React never remounts the subtree, so running animations, focus
 * and media survive a sheet opening over the content or closing from under it.
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

  // One stable host for the component's whole life. Client-only, like open().
  const [host] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null
    const node = document.createElement('div')
    node.style.display = 'contents'
    node.style.pointerEvents = 'auto'
    return node
  })

  useEffect(() => {
    if (!host || !target || host.parentNode === target) return
    liveMove(target, host)
  }, [target, host])

  // Detach only on unmount: a cleanup keyed on `target` would disconnect the
  // host before the move above, forcing the state-losing appendChild path.
  useEffect(() => () => host?.remove(), [host])

  if (!host) return null
  // An anchored panel measured against a card that is sliding away is wrong, and
  // the top layer stays clickable for the whole exit — so leave by default.
  if (!keepOnClose && layout?.isClosing === true) return null

  return createPortal(children, host)
}
