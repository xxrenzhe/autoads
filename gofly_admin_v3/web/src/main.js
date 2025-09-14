import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import App from './App.vue'
import { router } from './router/index.js'

const app = createApp(App)
app.use(router)
app.use(Antd)
app.mount('#app')

