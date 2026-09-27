import { createRouter, createWebHashHistory } from 'vue-router'
import GlobeView from './views/GlobeView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'globe', component: GlobeView },
    { path: '/lugar/:id', name: 'location', component: () => import('./views/LocationView.vue'), props: true },
    { path: '/ajustes', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue') }
  ]
})
