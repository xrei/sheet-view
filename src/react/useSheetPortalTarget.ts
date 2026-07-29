import {useContext, useSyncExternalStore} from 'react'

import {devWarn} from '../core/dev'
import type {SheetLayerName} from '../core/types'
import {SheetLayoutContext} from './SheetLayoutContext'
import {sheets as defaultSheets} from './sheets'
import type {Sheets} from './sheets'

const serverTarget = (): null => null

export interface SheetPortalTargetOptions {
  /** Which layer to target. Defaults to `'anchored'`. */
  layer?: SheetLayerName
  /**
   * The facade to read when this component renders OUTSIDE any sheet slot (a
   * root-level toast host, say). Ignored inside a slot, where the sheet is known
   * from context. Defaults to the shared `sheets` singleton.
   */
  instance?: Sheets
}

/**
 * The node to portal app-authored popovers into — the value you hand to a
 * library's `container` / `portalTarget` prop.
 *
 * Resolution order: this sheet (from context) → the topmost sheet of `instance`
 * → `document.body`. It never returns null, so callers write no fallback.
 *
 * A *closing* sheet deliberately still resolves to its own node: "which node" and
 * "should I still render" are separate questions, and flipping the target mid-exit
 * reparents the content, restarting its animations. Ask
 * `useSheetLayout().isClosing` for the second question, or let `<SheetPortal>`
 * handle it.
 *
 * Client-only, like `open()` — on the server there is nothing to portal into.
 */
export function useSheetPortalTarget(
  options: SheetPortalTargetOptions = {},
): HTMLElement {
  const {layer = 'anchored', instance = defaultSheets} = options
  const layout = useContext(SheetLayoutContext)
  const {subscribe, getSnapshot} = instance.__host
  // The subscribed snapshot is the RESOLVED node, not the entries array: the
  // array's identity changes on every emit (an update(), a phase change) while
  // the topmost sheet's layer node almost never does, and useSyncExternalStore
  // re-renders only when the snapshot value itself changes (Object.is). With the
  // array as the snapshot, every emit re-rendered every caller for nothing.
  const topmostTarget = useSyncExternalStore(
    subscribe,
    () => {
      const entries = getSnapshot()
      const topmost = entries[entries.length - 1]
      return topmost ? topmost.layers[layer] : null
    },
    serverTarget,
  )

  if (layout) return layout.layers[layer]
  if (topmostTarget) return topmostTarget

  if (layer === 'anchored') {
    // A viewport overlay legitimately outlives every sheet; an anchored panel
    // with no sheet open has nothing to anchor to, so it's almost always a bug.
    devWarn(
      'useSheetPortalTarget({layer: "anchored"}) fell back to document.body — no sheet is open. Anchored panels belong to a sheet; did you mean layer: "viewport"?',
    )
  }
  return (globalThis as {document?: Document}).document?.body as HTMLElement
}
