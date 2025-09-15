import { createApp } from 'vue'
import Antd from 'ant-design-vue'
// Ant Design Vue v4 使用 reset.css 作为全局样式重置
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { router } from './router/index.js'

const app = createApp(App)
app.use(router)
app.use(Antd)
app.mount('#app')
