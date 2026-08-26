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
 * @internal Contains a throw to the one slot that threw. `<SheetHost>` mounts at
 * the app root, so without this a throw in sheet content unmounts the whole app.
 * One boundary per slot: a crashing `content` leaves the header and its close
 * button intact, so the sheet stays dismissable.
 */
export class SlotBoundary extends Component<SlotBoundaryProps, SlotBoundaryState> {
  constructor(props: SlotBoundaryProps) {
    // Assigned here, not as a class property: `state` is inherited, so a property
    // declaration would need `override` under noImplicitOverride.
    super(props)
    this.state = {failed: false}
  }

  static getDerivedStateFromError(): SlotBoundaryState {
    return {failed: true}
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      `[sheet-view] The "${this.props.slot}" slot threw and was left empty. The sheet and the rest of your app are still mounted.`,
      error,
    )
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    // The boundary is keyed by sheet, so a failed slot stays blank until that
    // sheet closes.
    return this.state.failed ? null : this.props.children
  }
}
