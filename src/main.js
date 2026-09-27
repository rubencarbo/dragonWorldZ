import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router.js'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).use(router).mount('#app')

// acceso de depuración desde la consola en desarrollo
if (import.meta.env.DEV) window.__dwz = { pinia, router }
