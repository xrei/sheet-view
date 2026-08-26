import {useContext} from 'react'

import {SheetLayoutContext} from './SheetLayoutContext'
import type {SheetLayoutValue} from './SheetLayoutContext'

/**
 * Layout handles and motion phase of the sheet this component renders inside.
 * `null` outside a sheet slot. Context follows the React tree, not the DOM tree,
 * so this reads through portals from anywhere inside your slot content.
 */
export function useSheetLayout(): SheetLayoutValue | null {
  return useContext(SheetLayoutContext)
}
