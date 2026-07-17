import {h} from 'vue'
import DefaultTheme from 'vitepress/theme'
import type {Theme} from 'vitepress'

import AnatomyDemo from './AnatomyDemo.vue'
import DemoPanel from './DemoPanel.vue'
import HeroSheetScene from './HeroSheetScene.vue'
import ReactDemo from './ReactDemo.vue'
import VanillaDemo from './VanillaDemo.vue'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroSheetScene),
    }),
  enhanceApp({app}) {
    app.component('AnatomyDemo', AnatomyDemo)
    app.component('DemoPanel', DemoPanel)
    app.component('ReactDemo', ReactDemo)
    app.component('VanillaDemo', VanillaDemo)
  },
} satisfies Theme
