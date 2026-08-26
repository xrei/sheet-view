<script setup lang="ts">
// The hero's "Open a sheet" action is a plain frontmatter link to #open-sheet;
// this invisible component turns that click into a real sheet. Delegated, so it
// survives the hero re-rendering.
import {onBeforeUnmount, onMounted} from 'vue'
import {openTrySheet} from './trySheet'

const onClick = (e: MouseEvent): void => {
  const target = e.target as Element | null
  if (!target?.closest?.('a[href="#open-sheet"]')) return
  e.preventDefault()
  void openTrySheet()
}

onMounted(() => {
  document.addEventListener('click', onClick)
  // Deep link: /#open-sheet lands with the sheet already open.
  if (location.hash === '#open-sheet') void openTrySheet()
})
onBeforeUnmount(() => document.removeEventListener('click', onClick))
</script>

<template>
  <span style="display: none" />
</template>
