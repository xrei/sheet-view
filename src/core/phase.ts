import type {SheetEntry} from './internal'
import type {SheetPhase} from './types'

/**
 * Moves a sheet to its next motion phase and tells everyone who asked.
 *
 * `'closing'` is terminal: a breakpoint change racing the exit must not drag the
 * sheet back to `'settled'` and tell a consumer it is safe to measure a card
 * that is on its way out.
 */
export function setPhase(entry: SheetEntry, next: SheetPhase): void {
  if (entry.phase === next || entry.phase === 'closing') return
  entry.phase = next

  if (next === 'settled') {
    // One source of truth for both signals: the CSS-side [data-sheet-settled]
    // (which stops the dim transitioning so drag frames can set opacity raw) and
    // the JS-side phase. Deliberately never removed on 'closing' — the attribute
    // has always meant "the entrance is over", and the closing state already wins
    // the backdrop cascade on its own.
    entry.dialog.dataset['sheetSettled'] = ''
  }

  for (const listener of entry.phaseListeners) {
    try {
      listener(next)
    } catch (error) {
      // A consumer listener must never break the close path — that would leave
      // the scroll lock held and the page frozen.
      console.error('[sheet-view] A phase listener threw.', error)
    }
  }
  entry.notify()
}
