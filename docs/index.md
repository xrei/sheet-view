---
layout: home

hero:
  name: sheet-view
  text: Headless bottom sheets on native &lt;dialog&gt; + CSS scroll-snap
  tagline: The platform does the modality, the a11y, and the gesture physics — the library is <span class="kb">~4 kB</span> of glue. Framework-agnostic core, React adapter included.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Live demos
      link: /examples

features:
  - title: GPU-smooth on mobile
    details: Drag-to-close rides CSS scroll-snap and compositor transforms — no pointer-event bookkeeping, no main-thread jank.
  - title: Native a11y for free
    details: showModal() provides the focus-trap, inert background, Escape handling, and focus restoration — no JS re-implementation.
  - title: Tiny — 4.7 kB gzip
    details: 3.9 kB for the core, 4.7 kB with the React adapter — smaller than a bare Radix dialog. Zero dependencies, ESM-only, TypeScript types included.
  - title: Headless
    details: A tiny required structural stylesheet, an optional default theme, or bring your own. Style via CSS custom properties and stable data-attributes.
  - title: Framework-agnostic core
    details: The vanilla core imports zero React. A thin React adapter lives at sheet-view/react. Same behaviour, same props.
  - title: Follows the host theme
    details: Light/dark tracks your page's color-scheme (not the OS), via light-dark() with an OS fallback. Your token overrides win in both schemes.
---
