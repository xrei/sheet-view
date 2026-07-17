<script setup>
// The landing hero: a staged miniature of the sheet lifecycle on a pure-CSS
// timeline — a touch cursor presses the page button, the sheet opens, explodes
// into the anatomy, reassembles, then the cursor grabs the handle and swipes it
// away. One master duration; every element keys its frames off the same clock.
</script>

<template>
  <div class="scene" aria-hidden="true">
    <div class="glow" />
    <div class="phone">
      <div class="screen">
        <div class="page">
          <div class="sk nav" />
          <div class="sk title" />
          <div class="chip" />
          <div class="sk line w86" />
          <div class="sk line w70" />
          <div class="sk line w78" />
        </div>

        <div class="backdrop" />

        <div class="sheet">
          <span class="tag tag-card">card</span>
          <div class="part p-handle" style="--pc: #db2777">
            <i class="ring" />
            <i class="pill" />
            <span class="tag">handle</span>
          </div>
          <div class="part p-header" style="--pc: #2563eb">
            <i class="ring" />
            <i class="sk h-title" />
            <i class="h-close" />
            <span class="tag">header</span>
          </div>
          <div class="part p-content" style="--pc: #16a34a">
            <i class="ring" />
            <i class="sk c-line w92" />
            <i class="sk c-line w76" />
            <i class="sk c-line w84" />
            <i class="sk c-line w58" />
            <span class="tag">content</span>
          </div>
          <div class="part p-footer" style="--pc: #d97706">
            <i class="ring" />
            <i class="f-btn" />
            <span class="tag">footer</span>
          </div>
        </div>

        <div class="island" />
        <div class="touch" />
      </div>
    </div>
  </div>
</template>

<style>
/* The default theme sizes .image-container for a square logo; let the scene
   own its footprint instead. */
.VPHome .VPHero .image-container {
  width: auto;
  height: auto;
  transform: none;
}
.VPHome .VPHero .tagline .kb {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
/* The default mobile layout pulls the (square-logo-sized) image into the text
   with negative margins; give the taller scene real space instead. */
@media (max-width: 959px) {
  .VPHome .VPHero .image {
    margin: -32px auto 12px;
  }
}
</style>

<style scoped>
.scene {
  --cycle: 12s;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
}

/* Soft brand glow so the device melts into the page instead of sitting in a box. */
.glow {
  position: absolute;
  inset: -56px -76px;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent),
    transparent 78%
  );
  filter: blur(12px);
}

/* --- the device --------------------------------------------------------- */
.phone {
  position: relative;
  width: 306px;
  height: 568px;
  padding: 5px;
  border-radius: 44px;
  /* Neutral bezel keyed to the theme's own gray scale — silver on the light
     theme, graphite on the dark one. Reads as a device, never as an accent. */
  background: linear-gradient(
    205deg,
    color-mix(in srgb, var(--vp-c-text-1) 14%, var(--vp-c-bg)),
    color-mix(in srgb, var(--vp-c-text-1) 34%, var(--vp-c-bg))
  );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, #fff 22%, transparent),
    0 24px 70px -18px rgb(0 0 0 / 0.45);
}

.screen {
  position: relative;
  height: 100%;
  border-radius: 39px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.island {
  position: absolute;
  top: 11px;
  left: 50%;
  translate: -50%;
  width: 84px;
  height: 25px;
  border-radius: 999px;
  background: #000;
  z-index: 6;
}

/* --- the app page behind the sheet --------------------------------------- */
.page {
  position: absolute;
  inset: 0;
  padding: 52px 18px 0;
}
.sk {
  display: block;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
}
.nav {
  height: 10px;
  width: 38%;
  margin-bottom: 22px;
}
.title {
  height: 16px;
  width: 72%;
  border-radius: 6px;
  margin-bottom: 12px;
}
.line {
  height: 8px;
  margin-bottom: 9px;
}
.w86 { width: 86%; }
.w70 { width: 70%; }
.w78 { width: 78%; }
.chip {
  margin: 4px 0 16px;
  height: 32px;
  width: 118px;
  border-radius: 16px;
  background: var(--vp-c-brand-1);
  animation: press var(--cycle) infinite;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.45);
  opacity: 1;
  animation: bd var(--cycle) infinite;
}

/* --- the sheet ------------------------------------------------------------ */
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 344px;
  /* At rest the bottom corners match the screen's own radius, exactly like a
     real sheet against a real display corner — nothing reads as cropped. */
  border-radius: 20px 20px 37px 37px;
  background: var(--vp-c-bg-elv);
  box-shadow:
    inset 0 0 0 1px var(--vp-c-divider),
    0 -10px 34px rgb(0 0 0 / 0.28);
  padding: 8px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  will-change: transform;
  animation:
    sheet var(--cycle) infinite,
    sheet-radius var(--cycle) infinite;
}
/* Violet card ring during the anatomy beat. */
.sheet::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1.5px solid #7c3aed;
  opacity: 0;
  pointer-events: none;
  animation: anat var(--cycle) infinite;
}

.part {
  position: relative;
  border-radius: 9px;
}
.ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1.5px solid var(--pc);
  background: color-mix(in srgb, var(--pc) 12%, transparent);
  opacity: 0;
  animation: anat var(--cycle) infinite;
}

.p-handle {
  height: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: spread-a var(--cycle) infinite;
}
.pill {
  width: 38px;
  height: 5px;
  border-radius: 999px;
  background: var(--vp-c-text-3);
}

.p-header {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  animation: spread-b var(--cycle) infinite;
}
.h-title {
  height: 11px;
  width: 45%;
  border-radius: 5px;
}
.h-close {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
}

.p-content {
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.c-line {
  height: 8px;
}
.w92 { width: 92%; }
.w76 { width: 76%; }
.w84 { width: 84%; }
.w58 { width: 58%; }

.p-footer {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  animation: spread-c var(--cycle) infinite;
}
.f-btn {
  width: 92px;
  height: 24px;
  border-radius: 12px;
  background: var(--vp-c-brand-1);
}

/* --- anatomy labels -------------------------------------------------------- */
.tag {
  position: absolute;
  right: 10px;
  top: 50%;
  translate: 0 -50%;
  z-index: 1;
  font: 600 9px/1.7 var(--vp-font-family-mono);
  letter-spacing: 0.05em;
  color: #fff;
  background: var(--pc);
  padding: 0 7px;
  border-radius: 999px;
  opacity: 0;
  animation: tag var(--cycle) infinite;
}
.p-handle .tag { right: 36px; }
.p-content .tag { top: 12px; translate: none; }
.p-footer .tag { right: 112px; }
.tag-card {
  --pc: #7c3aed;
  right: auto;
  left: 10px;
  top: -9px;
  translate: none;
}

/* --- the touch cursor ------------------------------------------------------
   Anchored on the page button; waypoints are translate() offsets from there.
   --hx/--hy = the sheet handle, --drag = end of the swipe (media-tuned). */
.touch {
  --hx: 67px;
  --hy: 100px;
  --drag: 235px;
  position: absolute;
  left: 62px;
  top: 117px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  z-index: 7;
  background: color-mix(in srgb, var(--vp-c-text-1) 22%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--vp-c-text-1) 42%, transparent);
  opacity: 0;
  will-change: transform, opacity;
  animation: touch var(--cycle) infinite;
}

/* --- the timeline -----------------------------------------------------------
   0–4      cursor glides in to the button
   4.8–6    press
   5.5–11.5 sheet slides up (the library's own iOS curve)
   11.5–20  open, resting
   20–25    explode into the anatomy
   25–46    anatomy, resting
   46–51    reassemble
   51–63    open, resting; cursor settles on the handle
   65.5–71  swipe down — the sheet follows the finger out
   74–100   closed pause, loop                                                 */
@keyframes sheet {
  0%, 5.5% {
    transform: translateY(108%);
    animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  }
  11.5%, 20% {
    transform: translateY(0);
    animation-timing-function: ease;
  }
  25%, 46% {
    transform: translateY(-20px) scale(0.955);
    animation-timing-function: ease;
  }
  /* Finger-drag phase: the card tracks the cursor linearly… */
  51%, 65.5% {
    transform: translateY(0);
    animation-timing-function: linear;
  }
  /* …then the finger lifts and momentum carries it out. */
  69% {
    transform: translateY(140px);
    animation-timing-function: cubic-bezier(0.3, 0, 0.8, 0.5);
  }
  71.5%, 100% {
    transform: translateY(108%);
  }
}

/* The card floats free of the screen's bottom corners while exploded — all
   four corners round so nothing reads as cropped. */
@keyframes sheet-radius {
  0%, 20%, 51%, 100% { border-radius: 20px 20px 37px 37px; }
  25%, 46% { border-radius: 20px; }
}

@keyframes bd {
  0%, 5.5% { opacity: 0; }
  11.5%, 65.5% { opacity: 1; }
  71.5%, 100% { opacity: 0; }
}

@keyframes press {
  0%, 4.4% { transform: none; }
  5.2% { transform: scale(0.93); }
  6.4%, 100% { transform: none; }
}

/* Rings + card outline share one opacity window. */
@keyframes anat {
  0%, 21%, 49%, 100% { opacity: 0; }
  25%, 46% { opacity: 1; }
}

/* Labels trail the rings slightly. */
@keyframes tag {
  0%, 23%, 48%, 100% { opacity: 0; transform: translateX(5px); }
  27%, 45% { opacity: 1; transform: none; }
}

/* Parts drift apart around the content block. */
@keyframes spread-a {
  0%, 20%, 51%, 100% { transform: none; }
  25%, 46% { transform: translateY(-5px); }
}
@keyframes spread-b {
  0%, 20%, 51%, 100% { transform: none; }
  25%, 46% { transform: translateY(-5px); }
}
@keyframes spread-c {
  0%, 20%, 51%, 100% { transform: none; }
  25%, 46% { transform: translateY(7px); }
}

@keyframes touch {
  0%, 0.8% { opacity: 0; transform: translate(74px, 200px) scale(1); }
  4% { opacity: 0.9; transform: translate(0, 0) scale(1); }
  4.8%, 5.6% { opacity: 0.9; transform: translate(0, 0) scale(0.72); }
  6.4% { opacity: 0.9; transform: translate(0, 0) scale(1); }
  9% { opacity: 0; transform: translate(8px, 16px) scale(1); }
  58% { opacity: 0; transform: translate(var(--hx), var(--hy)) scale(1); }
  62%, 64.5% { opacity: 0.9; transform: translate(var(--hx), var(--hy)) scale(1); }
  65.5% {
    opacity: 0.9;
    transform: translate(var(--hx), var(--hy)) scale(0.72);
    animation-timing-function: linear;
  }
  69.5% { opacity: 0.9; transform: translate(var(--hx), var(--drag)) scale(0.72); }
  73%, 100% { opacity: 0; transform: translate(var(--hx), calc(var(--drag) + 26px)) scale(1); }
}

/* Reduced motion: hold the resting open frame — no loop, no cursor. */
@media (prefers-reduced-motion: reduce) {
  .scene *,
  .scene *::before,
  .scene *::after {
    animation: none !important;
  }
}

@media (max-width: 959px) {
  .phone {
    width: 234px;
    height: 434px;
    padding: 4px;
    border-radius: 36px;
  }
  .screen { border-radius: 32px; }
  .island {
    top: 8px;
    width: 66px;
    height: 20px;
  }
  .page { padding-top: 42px; }
  .sheet {
    height: 262px;
    border-radius: 20px 20px 31px 31px;
  }
  .p-footer { height: 38px; }
  .touch {
    --hx: 33px;
    --hy: 42px;
    --drag: 182px;
    top: 107px;
  }
  @keyframes sheet-radius {
    0%, 20%, 51%, 100% { border-radius: 20px 20px 31px 31px; }
    25%, 46% { border-radius: 20px; }
  }
}
</style>
