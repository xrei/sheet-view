import type {SheetEntry} from './internal'
import type {SheetPhase} from './types'

/**
 * Moves a sheet to its next motion phase and notifies listeners. `'closing'` is
 * terminal: a breakpoint change racing the exit must not drag the sheet back to
 * `'settled'` and tell a consumer it is safe to measure a card on its way out.
 */
export function setPhase(entry: SheetEntry, next: SheetPhase): void {
  if (entry.phase === next || entry.phase === 'closing') return
  entry.phase = next

  if (next === 'settled') {
    // The CSS-side signal, which stops the dim transitioning so drag frames can
    // set opacity raw. Never removed on 'closing': it means "the entrance is
    // over", and the closing state already wins the backdrop cascade on its own.
    entry.dialog.dataset['sheetSettled'] = ''
  }

  for (const listener of entry.phaseListeners) {
    try {
      listener(next)
    } catch (error) {
      // A consumer listener must never break the close path: that would leave
      // the scroll lock held and the page frozen.
      console.error('[sheet-view] A phase listener threw.', error)
    }
  }
  entry.notify()
}
