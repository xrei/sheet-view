import type {SheetDOM} from './internal'
import type {SheetLayers} from './types'

interface MoveBeforeParent extends Node {
  moveBefore?: (node: Node, child: Node | null) => void
}

/**
 * Move `node` to the end of `target`. `moveBefore` (Chrome 133+) preserves live
 * state, where appendChild is remove-then-insert: animations restart, focus
 * drops. It throws when either end is disconnected or cross-document, so it is
 * gated with a fallback.
 */
export function liveMove(target: HTMLElement, node: Node): void {
  const parent = target as MoveBeforeParent
  if (
    node.isConnected &&
    target.isConnected &&
    node.ownerDocument === target.ownerDocument &&
    typeof parent.moveBefore === 'function'
  ) {
    try {
      parent.moveBefore(node, null)
      return
    } catch {
      /* fall through */
    }
  }
  target.appendChild(node)
}

/**
 * Re-seats a popover layer that an external renderer removes, moves or clears.
 * Repair is idempotent, so it cannot ping-pong.
 */
export function guardLayers(dom: SheetDOM): () => void {
  const {anchored, viewport} = dom.layers
  const toplayer = dom.slots.toplayer
  // [child, parent], append also restores "layer = last child = top paint".
  const seats: Array<[HTMLElement, HTMLElement]> = [
    [toplayer, dom.dialog],
    [anchored, dom.card],
    [viewport, toplayer],
    [dom.sentinels.anchored, anchored],
    [dom.sentinels.viewport, viewport],
  ]
  const observer = new MutationObserver(() => {
    for (const [child, parent] of seats) {
      if (child.parentNode !== parent) parent.appendChild(child)
    }
  })
  for (const [, parent] of seats) observer.observe(parent, {childList: true})
  return () => observer.disconnect()
}

let receiver: HTMLElement | null = null

/** How long a parked layer waits for its content to be claimed. */
const SWEEP_MS = 1000

/**
 * Teardown parking: emit() only schedules the subscribers' re-render while
 * dialog.remove() is synchronous, so layer content that outlives the sheet
 * would detach before its owner can re-home it. Occupied layer NODES move whole
 * into a connected receiver, so no parent link breaks and an external renderer
 * can still remove its own children. Layers still parked after the grace period
 * are dropped.
 */
export function rescueLayers(layers: SheetLayers): void {
  const occupied = [layers.anchored, layers.viewport].filter((layer) =>
    [...layer.children].some(
      (child) => child.getAttribute('data-sheet-part') !== 'layer-sentinel'))
  if (occupied.length === 0) return

  if (!receiver?.isConnected) {
    receiver = document.createElement('div')
    receiver.setAttribute('data-sheet-part', 'layer-rescue')
    receiver.style.cssText = 'position:fixed;inset:0;pointer-events:none'
    document.body.appendChild(receiver)
  }
  for (const layer of occupied) liveMove(receiver, layer)

  const parkedIn = receiver
  setTimeout(() => {
    for (const layer of occupied) {
      if (layer.parentNode === parkedIn) layer.remove()
    }
    // Leave the host's <body> as it was found. Emptiness is the test, not this
    // sweep's own list: a later rescue may still be parked in the same receiver.
    if (parkedIn.childNodes.length === 0) {
      parkedIn.remove()
      if (receiver === parkedIn) receiver = null
    }
  }, SWEEP_MS)
}
