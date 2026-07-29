import {useContext} from 'react'

import {SheetLayoutContext} from './SheetLayoutContext'
import type {SheetLayoutValue} from './SheetLayoutContext'

/**
 * Layout handles and motion phase of the sheet this component renders inside.
 * `null` when it isn't rendered inside a sheet slot.
 *
 * There is deliberately no `instance` parameter: slot content is, by definition,
 * inside exactly one sheet, so reading it from context is unambiguous where a
 * "topmost sheet of this instance" lookup would not be. React context flows
 * through portals — it follows the React tree, not the DOM tree — so this works
 * from anywhere inside your slot content.
 */
export function useSheetLayout(): SheetLayoutValue | null {
  return useContext(SheetLayoutContext)
}
