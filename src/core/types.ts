export type SheetSize = 'sm' | 'md' | 'lg' | 'xl'

export type SheetStrategy = 'reuse' | 'replace' | 'update'

/** The `{close, update}` context handed to slot render-functions. */
export interface SheetContext {
  close: () => void
  update: (next: Partial<SheetOpenProps>) => void
}

/**
 * A vanilla slot value: a DOM node, a string, or a factory receiving the
 * sheet's context. The React adapter accepts `ReactNode` in the same positions
 * and portals it into these nodes instead of resolving it here.
 */
export type SheetSlot =
  | Node
  | string
  | null
  | undefined
  | ((ctx: SheetContext) => Node | string | null | undefined)

/** Options accepted by `open(...)`. All display props are optional. */
export interface SheetOpenProps {
  /** Dedupe scope for a singleton sheet. Keyless opens are always fresh. */
  key?: string
  /** Only meaningful with `key`. Defaults to `'reuse'`. */
  strategy?: SheetStrategy
  /** Default-header title (ignored when `headerSlot` is provided). */
  title?: string
  /** Mobile height bucket + desktop width. Defaults to `'lg'`. */
  size?: SheetSize
  /**
   * A field inside the sheet autofocuses on open (login, search, …). On mobile
   * the panel opens already at its resting scroll position and rises+fades into
   * place, so iOS raises the keyboard cleanly instead of scroll-into-viewing an
   * off-screen field and shoving the panel past the top edge.
   */
  focusOnOpen?: boolean
  /** Accessible name for the dialog. Falls back to `title`. */
  ariaLabel?: string
  /** Extra class(es) appended to the card element. */
  cardClassName?: string
  /** Class(es) appended to the root dialog element. */
  className?: string
  /**
   * Inline styles/tokens on the root dialog — chiefly per-instance `--sheet-*`
   * overrides, which reach every part (incl. the backdrop that `cardClassName`
   * can't). Keys are CSS property names: custom properties (`--x`) pass through,
   * and camelCase normal properties are normalized to dash-case.
   */
  style?: Record<string, string>
  /** Blocks X / backdrop / Escape / drag; each fires `onCloseAttempt` instead. */
  closeDisabled?: boolean
  /** Omits the default-header close button entirely (a forced sheet). */
  closeHidden?: boolean
  /** Accessible label for the default-header close button. Default `'Close'`. */
  closeLabel?: string
  /**
   * Content of the default-header close button — a custom node / SVG / string in
   * place of the default `×`. The button's accessible name still comes from
   * `closeLabel`. For a fully custom header (or a React/JSX icon), use `headerSlot`.
   */
  closeIcon?: SheetSlot
  /** Replaces the default title/close header row. */
  headerSlot?: SheetSlot
  /** The scrollable body. */
  content?: SheetSlot
  /** Pinned footer; collapses when empty. */
  footer?: SheetSlot
  /** Decorations anchored to the card that may extend past its edges. */
  overlaySlot?: SheetSlot
  /** Fired when a close is requested (not fired for a blocked/`silent` close). */
  onClose?: () => void
  /** Fired when a close is blocked by `closeDisabled`. */
  onCloseAttempt?: () => void
  /** Fired after the exit animation, just before DOM removal. */
  onExited?: () => void
}

/** The DOM nodes exposed per sheet — external renderers portal into these. */
export interface SheetSlots {
  header: HTMLElement
  content: HTMLElement
  footer: HTMLElement
  overlay: HTMLElement
  toplayer: HTMLElement
}

/** The stable handle returned by `open(...)`. Identity is stable for the sheet's life. */
export interface SheetHandle {
  id: number
  close: () => void
  update: (next: Partial<SheetOpenProps>) => void
  slots: SheetSlots
}

/** The reactive projection of an open sheet (one per `getSnapshot()` entry). */
export interface SheetEntrySnapshot {
  id: number
  key: string | undefined
  isClosing: boolean
  closeDisabled: boolean
  slots: SheetSlots
  handle: SheetHandle
}

/** Tunables for a core instance. All optional with sensible defaults. */
export interface SheetCoreOptions {
  /** Exit budget in ms for a button/backdrop/Escape/programmatic close. Default 320. */
  closeMs?: number
  /** Exit budget in ms for a drag-close (transform off a frozen scroller). Default 220. */
  dragCloseMs?: number
  /** Delay in ms after open before drag-to-close arms. Default 400. */
  openSettleMs?: number
  /** Viewport width (px) below which the mobile slide-up layout applies. Default 768. */
  breakpoint?: number
  /**
   * Pin `maximum-scale=1` on the viewport meta while a sheet is open, to block
   * iOS focus auto-zoom. Off by default: disabling zoom is a WCAG 1.4.4 failure
   * (and Android Chrome honors it, hurting low-vision users). Prefer ≥16px inputs
   * — the base theme already sets that inside the sheet. Default `false`.
   */
  zoomLock?: boolean
  /** Default accessible label for close buttons in this instance. Default `'Close'`. */
  closeLabel?: string
}

/** The framework-agnostic engine returned by `createSheetCore()`. */
export interface SheetCore {
  open: (props: SheetOpenProps) => SheetHandle
  closeAll: () => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SheetEntrySnapshot[]
  /** @internal Test-only synchronous teardown. Not part of the stable API. */
  __resetForTests: () => void
}
