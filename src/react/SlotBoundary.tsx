import {Component} from 'react'
import type {ErrorInfo, ReactNode} from 'react'

export interface SlotBoundaryProps {
  /** Slot name, for the console message. */
  slot: string
  children: ReactNode
  onError?: ((error: unknown, info: ErrorInfo) => void) | undefined
}

interface SlotBoundaryState {
  failed: boolean
}

/**
 * @internal Contains a throw to the one slot that threw.
 *
 * `<SheetHost>` mounts at the app root, so without this a throw anywhere in sheet
 * content propagates to the root and unmounts the whole application. Containing
 * that is mechanism, not policy — the library owes you "one sheet can't take out
 * your app" the same way it owes you "the scroll lock is always released". What to
 * render instead is app-level, so this renders nothing and stays out of the way.
 *
 * One boundary per slot, not one per sheet: a crashing `content` then leaves the
 * default header and its close button intact, so the sheet is still dismissable.
 * A single boundary around every portal would blank the sheet into a void the user
 * cannot escape.
 */
export class SlotBoundary extends Component<SlotBoundaryProps, SlotBoundaryState> {
  constructor(props: SlotBoundaryProps) {
    // Assigned here rather than as a class property: `state` is inherited, and a
    // property declaration would need `override` under noImplicitOverride.
    super(props)
    this.state = {failed: false}
  }

  static getDerivedStateFromError(): SlotBoundaryState {
    return {failed: true}
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Unconditional, not dev-gated: this IS an error, and swallowing it silently
    // is worse than the crash it prevents.
    console.error(
      `[sheet-view] The "${this.props.slot}" slot threw and was left empty. The sheet and the rest of your app are still mounted.`,
      error,
    )
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    // No reset heuristic: the boundary is keyed by sheet, so a new sheet always
    // gets a fresh one, and within one sheet a failed slot stays blank until close.
    return this.state.failed ? null : this.props.children
  }
}
