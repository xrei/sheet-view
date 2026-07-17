<script setup>
import {onBeforeUnmount, onMounted, ref} from 'vue'

const props = defineProps({demo: {type: String, required: true}})

const loaders = {
  basic: () => import('../../../examples/react/src/demos/Basic'),
  footer: () => import('../../../examples/react/src/demos/Footer'),
  forced: () => import('../../../examples/react/src/demos/Forced'),
  form: () => import('../../../examples/react/src/demos/Form'),
  keyed: () => import('../../../examples/react/src/demos/KeyedUpdate'),
  toast: () => import('../../../examples/react/src/demos/TopLayerToast'),
}

const host = ref()
let root

onMounted(async () => {
  const [{createRoot}, React, mod] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    loaders[props.demo](),
  ])
  await Promise.all([
    import('sheet-view/base.css'),
    import('sheet-view/theme.css'),
    import('../../../examples/vanilla/demo.css'),
  ])
  root = createRoot(host.value)
  root.render(
    React.createElement(React.StrictMode, null, React.createElement(mod.Demo)),
  )
})

onBeforeUnmount(() => root?.unmount())
</script>

<template>
  <ClientOnly><div ref="host" /></ClientOnly>
</template>
