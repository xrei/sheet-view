---
layout: home

hero:
  name: sheet-view
  text: Headless bottom sheets on native &lt;dialog&gt; + CSS scroll-snap
  tagline: The platform does the modality, the a11y, and the drag — the library is <span class="kb">~7.7 kB</span> of glue. Framework-agnostic core, React adapter included.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Live demos
      link: /examples

features:
  - title: GPU-smooth on mobile
    details: The drag is a native scroll on CSS scroll-snap; the release is a compositor transform on a fixed clock. No per-frame pointer math, no main-thread jank.
  - title: Native a11y for free
    details: showModal() provides the focus-trap, inert background, Escape handling, and focus restoration — no JS re-implementation.
  - title: Tiny — 7.7 kB gzip
    details: 7.7 kB min+gzip for the core, 9.4 kB with the React adapter. Zero dependencies, ESM-only, TypeScript types included.
  - title: Headless
    details: A tiny required structural stylesheet, an optional default theme, or bring your own. Style via CSS custom properties and stable data-attributes.
  - title: Framework-agnostic core
    details: The vanilla core imports zero React. A thin React adapter lives at sheet-view/react. Same behaviour, same props.
  - title: Follows the host theme
    details: Light/dark tracks your page's color-scheme, not the OS, through light-dark(). Your token overrides win in both schemes.
---
