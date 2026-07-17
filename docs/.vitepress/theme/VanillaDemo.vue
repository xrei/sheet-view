<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue'

const props = defineProps({demo: {type: String, required: true}})

const loaders = {
  basic: () => import('../../../examples/vanilla/demos/basic.js'),
  themed: () => import('../../../examples/vanilla/demos/themed.js'),
}

const host = ref()
let cleanup

onMounted(async () => {
  await Promise.all([
    import('sheet-view/base.css'),
    import('sheet-view/theme.css'),
    import('../../../examples/vanilla/demo.css'),
  ])
  const {mount} = await loaders[props.demo]()
  cleanup = mount(host.value)
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <ClientOnly><div ref="host" class="sv-demo" /></ClientOnly>
</template>
