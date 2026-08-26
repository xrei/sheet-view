export type SheetSize = 'sm' | 'md' | 'lg' | 'xl'

export type SheetStrategy = 'reuse' | 'replace' | 'update'

/** The `{close, update}` context handed to slot render-functions. */
export interface SheetContext {
  close: () => void
  update: (next: Partial<SheetOpenProps>) => void
}

/** A slot value: a DOM node, a string, or a factory receiving the sheet's context. */
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
  /**
   * Leading glyph in the default header, before the title. Requires `title` and
   * is ignored when `headerSlot` is set. Not `aria-hidden`: mark a decorative
   * icon yourself, or give a meaningful one an accessible name.
   */
  icon?: SheetSlot
  /** Mobile height bucket + desktop width. Defaults to `'lg'`. */
  size?: SheetSize
  /**
   * A field inside the sheet autofocuses on open. On mobile the panel then opens
   * already at its resting scroll position and rises into place, so raising the
   * keyboard cannot shove it past the top edge.
   */
  focusOnOpen?: boolean
  /** Accessible name for the dialog. Falls back to `title`. */
  ariaLabel?: string
  /** Extra class(es) appended to the card element. */
  cardClassName?: string
  /** Class(es) appended to the root dialog element. */
  className?: string
  /**
   * Inline styles/tokens on the root dialog, chiefly per-instance `--sheet-*`
   * overrides, which reach every part including the backdrop. Custom properties
   * (`--x`) pass through; camelCase properties are normalized to dash-case.
   */
  style?: Record<string, string>
  /** Blocks X / backdrop / Escape / drag; each fires `onCloseAttempt` instead. */
  closeDisabled?: boolean
  /** Omits the default-header close button entirely (a forced sheet). */
  closeHidden?: boolean
  /** Accessible label for the default-header close button. Default `'Close'`. */
  closeLabel?: string
  /**
   * Content of the default-header close button, a node / SVG / string in place
   * of the default `×`, which the CSS drops as soon as this lands. The button
   * itself stays library-owned: its accessible name comes from `closeLabel`.
   * Ignored when `headerSlot` or `closeHidden` is set.
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

/**
 * Motion phase of one sheet. `'settled'` means no ancestor transform is live, so
 * viewport-coordinate measurements are stable, the only window in which a
 * `position: fixed` panel or viewport-boundary collision math is reliable.
 * Mirrors the `[data-sheet-settled]` attribute.
 */
export type SheetPhase = 'entering' | 'settled' | 'closing'

/** Which popover layer to mount into. */
export type SheetLayerName = 'anchored' | 'viewport'

/**
 * Mount points for app-authored popovers, dropdowns, menus, pickers, tooltips.
 * Both are boxless (`display: contents`), so they never generate a box that
 * could swallow a backdrop press or the drag gesture.
 */
export interface SheetLayers {
  /**
   * Inside the card: unclipped, moves with it through the entrance, drag and
   * exit, and a press here never dismisses the sheet. The mount for ANCHORED
   * panels. Children must be `absolute`: the layer is boxless, so a static child
   * becomes a flex item of the card and adds a row.
   */
  anchored: HTMLElement
  /**
   * Inside the sheet's top layer: paints above the card, viewport-fixed, and
   * does NOT follow it. The mount for VIEWPORT-anchored overlays (toasts,
   * command palettes).
   */
  viewport: HTMLElement
}

/** The DOM nodes exposed per sheet: external renderers portal into these. */
export interface SheetSlots {
  header: HTMLElement
  /**
   * Leading-icon node inside the default header. Created once and MOVED into
   * each rebuilt header, so its identity is stable across `update()` and an
   * external renderer can keep rendering into it.
   */
  icon: HTMLElement
  /**
   * Glyph node inside the default header's close button. Identity is stable
   * across `update()` like `icon`. Left empty, CSS fills it with the default `×`.
   */
  closeIcon: HTMLElement
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
  /** Mount nodes for app-authored popovers. */
  layers: SheetLayers
  /** The motion phase right now. */
  phase: () => SheetPhase
  /** Subscribe to phase changes. Change-only, read `phase()` for the current value. */
  onPhase: (listener: (phase: SheetPhase) => void) => () => void
}

/** The reactive projection of an open sheet (one per `getSnapshot()` entry). */
export interface SheetEntrySnapshot {
  id: number
  key: string | undefined
  isClosing: boolean
  closeDisabled: boolean
  slots: SheetSlots
  handle: SheetHandle
  layers: SheetLayers
  phase: SheetPhase
  /** The positioning root for `layers.anchored` children (`position: relative`). */
  card: HTMLElement
  /** The drag scroller: the outermost clip boundary for popover collision math. */
  scroll: HTMLElement
}

/** Tunables for a core instance. All optional with sensible defaults. */
export interface SheetCoreOptions {
  /**
   * Exit duration in ms for a button/backdrop/Escape/programmatic close, which
   * always travels a whole card height. Default 517.
   */
  closeMs?: number
  /**
   * How long a release takes, in ms: the same however far the card still has to
   * go, so the SPEED is proportional to the distance. Covers both the
   * drag-commit exit and the snap-back; a flick differs only in the curve it
   * rides. Default 517.
   */
  dragCloseMs?: number
  /**
   * Mobile entrance duration in ms: the JS-side mirror of the
   * `--sheet-enter-duration` token, written onto each sheet as the private
   * `--_sheet-enter-ms`, so a CSS override of the public token still wins and
   * `prefers-reduced-motion` still clamps it. Also the default for
   * `openSettleMs`. Unset = base.css's own default, 507.
   */
  enterMs?: number
  /** Delay in ms after open before drag-to-close arms. Default: `enterMs` (507). */
  openSettleMs?: number
  /** Viewport width (px) below which the mobile slide-up layout applies. Default 768. */
  breakpoint?: number
  /**
   * Pin `maximum-scale=1` on the viewport meta while a sheet is open, to block
   * focus auto-zoom. Disabling zoom is a WCAG 1.4.4 failure, so prefer the ≥16px
   * inputs the base theme already sets inside the sheet. Default `false`.
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
