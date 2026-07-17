<script setup>
import {ref} from 'vue'

const expanded = ref(false)
</script>

<template>
  <div class="demo-panel">
    <div class="demo-panel__preview">
      <slot name="preview" />
    </div>
    <div class="demo-panel__code" :class="{'is-collapsed': !expanded}">
      <div class="demo-panel__scroll">
        <slot />
      </div>
      <div class="demo-panel__fade" v-if="!expanded" />
      <button
        class="demo-panel__toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Collapse code' : 'Expand code' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.demo-panel {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  overflow: hidden;
}

.demo-panel__preview {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 56px 24px;
  min-height: 280px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #9333ea 100%);
}

.demo-panel__code {
  position: relative;
  border-top: 1px solid var(--vp-c-divider);
}

/* The slotted VitePress code block brings its own bg/padding; strip its default
   margin so it sits flush in the panel. */
.demo-panel__scroll :deep(div[class*='language-']),
.demo-panel__scroll :deep(.vp-code-group) {
  margin: 0;
  border-radius: 0;
}

.demo-panel__code.is-collapsed .demo-panel__scroll {
  max-height: 200px;
  overflow: hidden;
}

.demo-panel__fade {
  position: absolute;
  inset: auto 0 0 0;
  height: 140px;
  pointer-events: none;
  background: linear-gradient(transparent, var(--vp-code-block-bg));
}

.demo-panel__toggle {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.demo-panel__toggle:hover {
  border-color: var(--vp-c-brand-1);
}

/* Once expanded, the toggle flows below the (now full-height) code. */
.demo-panel__code:not(.is-collapsed) .demo-panel__toggle {
  position: static;
  transform: none;
  display: block;
  margin: 12px auto;
}
</style>
