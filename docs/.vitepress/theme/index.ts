import {h} from 'vue'
import DefaultTheme from 'vitepress/theme'
import type {Theme} from 'vitepress'

import AnatomyDemo from './AnatomyDemo.vue'
import DemoPanel from './DemoPanel.vue'
import HeroSheetScene from './HeroSheetScene.vue'
import ReactDemo from './ReactDemo.vue'
import TryOpenAction from './TryOpenAction.vue'
import VanillaDemo from './VanillaDemo.vue'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroSheetScene),
      'home-hero-actions-after': () => h(TryOpenAction),
    }),
  enhanceApp({app}) {
    app.component('AnatomyDemo', AnatomyDemo)
    app.component('DemoPanel', DemoPanel)
    app.component('ReactDemo', ReactDemo)
    app.component('VanillaDemo', VanillaDemo)
  },
} satisfies Theme
