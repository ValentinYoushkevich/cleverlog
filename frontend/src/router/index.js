import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/register/:token',
      name: 'register',
      component: () => import('@/pages/RegisterPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/HomePage.vue'),
        },
      ],
    },
  ],
})

// Navigation guard — логика появится в модуле RBAC
router.beforeEach((to) => {
  const isAuthenticated = false // заменить на useAuthStore в MODULE_2
  if (!to.meta.public && !isAuthenticated) {
    return { name: 'login' }
  }
})

export default router
