import {devWarn} from './dev'
import type {MoveBeforeParent} from './layer'
import type {RefCountedLock} from './locks'

/*
 * Top-layer UI the page does not own. A password-manager extension (iCloud
 * Passwords in desktop Chrome) appends a `<div popover="manual">` to <body> and
 * shows it. The top layer paints it above the sheet, but showModal() made
 * everything outside the dialog inert, so the pointer falls through it to
 * whatever lies beneath.
 *
 * moveBefore() into the topmost sheet changes only that. The popover stays open
 * with no toggle, keeps its rect (a showing popover lays out in the top layer,
 * not in its DOM parent), keeps focus and its iframe, and becomes hit-testable.
 * appendChild is never a fallback: remove-then-insert hides the popover and
 * reloads its frame. Without moveBefore nothing moves and the page behaves as
 * it always did.
 *
 * Driven by `toggle`, not by a MutationObserver: toggle fires only for a
 * popover that is actually showing, so a hidden page container is never touched,
 * and every move needs a fresh showPopover() from the owner. An owner that
 * fights back trades the node with us one task at a time, never in a microtask
 * loop that starves rendering.
 */

// The raw attribute, so cssText, setAttribute and setProperty(…, 'important')
// all count.
const IMPORTANT = /!\s*important/i

/**
 * Adoptions per second past which an owner is answering every move with a
 * fresh node. Well above what focus can produce: even a held Tab key cycling a
 * login form re-shows a dropdown a dozen times a second at most.
 */
const BURST = 20

// Where this copy adopted each node from. Presence also means "ours right
// now": a listed node found back on the page side was moved there by its owner.
const origin = new WeakMap<Element, Element>()
// Owners that took their node back. Yield for good, or the two of us trade it
// on every show.
const refused = new WeakSet<Element>()

let holders = 0
let burst = 0
let burstStart = 0
let tripped = false

function supported(): boolean {
  return (
    typeof Element !== 'undefined' &&
    typeof (Element.prototype as MoveBeforeParent).moveBefore === 'function'
  )
}

function onPageSide(parent: Node | null): boolean {
  return parent === document.body || parent === document.documentElement
}

function isSheetRoot(node: Node | null): node is HTMLDialogElement {
  return (
    node != null &&
    node.nodeType === 1 &&
    (node as Element).localName === 'dialog' &&
    (node as Element).getAttribute('data-sheet-part') === 'root'
  )
}

/**
 * Injected, not page-owned. Each clause is a way page UI fails it:
 * - `manual`, the only state verified to survive the move;
 * - no own properties. A renderer keeps its bookkeeping on the nodes it
 *   creates and unmounts through the parent it remembers, and that
 *   removeChild throws once the node has moved. Content scripts run in an
 *   isolated world, so nothing an extension attaches is visible here. Names,
 *   not Reflect.ownKeys: jsdom keeps its impl under an own symbol;
 * - inline `!important`, the armour injected UI wears against page CSS and
 *   page code almost never writes.
 */
function isForeignOverlay(el: Element): boolean {
  return (
    el.getAttribute('popover')?.toLowerCase() === 'manual' &&
    Object.getOwnPropertyNames(el).length === 0 &&
    IMPORTANT.test(el.getAttribute('style') ?? '')
  )
}

/**
 * The blocking modal among sheets. open() appends each dialog to <body> right
 * before showModal(), so document order is top-layer order, across core
 * instances and bundled copies, which share nothing but the DOM. A closing
 * sheet counts: it stays modal, so blocking, until its teardown closes it.
 */
function topSheet(skip: Element | null): HTMLDialogElement | null {
  const kids = document.body.children
  for (let i = kids.length - 1; i >= 0; i--) {
    const el = kids[i]!
    if (el !== skip && isSheetRoot(el) && el.open) return el
  }
  return null
}

// Before the toplayer, which guardLayers keeps as the last child. Paint does not
// depend on it, a showing popover is in the top layer either way. Never INTO the
// toplayer: its pointer-events:none, and the visibility:hidden of a hidden stack
// station, are both inherited.
function seat(dialog: HTMLDialogElement, el: Element): boolean {
  const last = dialog.lastElementChild
  return moveInto(
    dialog,
    el,
    last?.getAttribute('data-sheet-part') === 'toplayer' ? last : null,
  )
}

function moveInto(parent: Element, el: Element, before: Element | null): boolean {
  try {
    ;(parent as MoveBeforeParent).moveBefore!(el, before)
    return true
  } catch {
    return false
  }
}

// Catch-all for an owner that answers each move with a fresh node, which the
// per-node refusal cannot see.
function withinBurst(): boolean {
  const now = Date.now()
  if (now - burstStart > 1000) {
    burstStart = now
    burst = 0
  }
  if (++burst <= BURST) return true
  tripped = true
  devWarn(
    'Stopped moving third-party overlays into the sheet: their owner keeps re-injecting them.',
  )
  return false
}

function adopt(el: Element): void {
  const parent = el.parentNode
  const target = topSheet(null)
  if (onPageSide(parent)) {
    if (origin.has(el)) {
      origin.delete(el)
      refused.add(el)
      return
    }
    if (tripped || refused.has(el) || !target || !isForeignOverlay(el)) return
    if (!withinBurst()) return
    if (seat(target, el)) origin.set(el, parent as Element)
    return
  }
  // One of ours, shown again at the root of a sheet no longer on top. Anything
  // else at a sheet root was placed there by its owner and stays put.
  if (origin.has(el) && isSheetRoot(parent) && target && target !== parent) {
    seat(target, el)
  }
}

// toggle does not bubble, hence capture. Nor is it composed, so a popover inside
// a shadow root stays out of reach. A plain property read: jsdom has no
// ToggleEvent. Sheet roots are dialogs and fire toggle too.
function onToggle(e: Event): void {
  if ((e as Event & {newState?: string}).newState !== 'open') return
  const el = e.target
  if (!(el instanceof Element) || el.hasAttribute('data-sheet-part')) return
  adopt(el)
}

/**
 * Watches while any sheet is open. Counted per copy, not in the DOM like the
 * locks: each copy runs its own listener, and adoption is idempotent across
 * them, the second finds the node already moved.
 */
export const foreignOverlays: RefCountedLock = {
  acquire(): void {
    if (holders++ > 0 || !supported()) return
    document.addEventListener('toggle', onToggle, true)
  },
  release(): void {
    if (holders === 0 || --holders > 0) return
    document.removeEventListener('toggle', onToggle, true)
    burst = 0
    tripped = false
  },
}

/**
 * Teardown, before the dialog closes and is removed: removal would hide the
 * popover and unload its frame. Only what this copy adopted leaves, so UI an
 * extension placed in the dialog itself is never touched. Each goes to the next
 * sheet down, else back where it came from. The dialog being torn down is still
 * open here, so it is skipped as a target.
 */
export function evictForeignOverlays(dialog: HTMLDialogElement): void {
  if (!supported()) return
  const next = topSheet(dialog)
  for (const el of [...dialog.children]) {
    const home = origin.get(el)
    if (!home) continue
    if (next) {
      seat(next, el)
      continue
    }
    // Forget it first, or a later show reads as its owner taking it back.
    origin.delete(el)
    moveInto(home.isConnected ? home : document.body, el, null)
  }
}
