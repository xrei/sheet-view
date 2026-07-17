<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue'

const host = ref()
let cleanup

onMounted(async () => {
  await import('sheet-view/base.css')
  await import('sheet-view/theme.css')
  await import('../../../examples/vanilla/demo.css')
  const {mountAnatomy} = await import('../../../examples/vanilla/app.js')
  cleanup = mountAnatomy(host.value)
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <ClientOnly><div ref="host" class="sv-demo" /></ClientOnly>
</template>
