import { useAuthStore } from '@/stores/auth.js';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { public: true },
      children: [
        {
          path: 'login',
          name: 'login',
          component: () => import('@/pages/LoginPage.vue'),
        },
        {
          path: 'register/:token',
          name: 'register',
          component: () => import('@/pages/RegisterPage.vue'),
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          redirect: { name: 'calendar' },
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('@/pages/CalendarPage.vue'),
        },
        {
          path: 'work-logs',
          name: 'work-logs',
          component: () => import('@/pages/WorkLogsPage.vue'),
        },
        {
          path: 'absences',
          name: 'absences',
          component: () => import('@/pages/AbsencesPage.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/pages/ProfilePage.vue'),
        },
        {
          path: 'reports/user',
          name: 'reports-user',
          component: () => import('@/pages/reports/UserReportPage.vue'),
        },
        {
          path: 'reports/project',
          name: 'reports-project',
          component: () => import('@/pages/reports/ProjectReportPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'reports/monthly-summary',
          name: 'reports-monthly-summary',
          component: () => import('@/pages/reports/MonthlySummaryPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/pages/admin/UsersPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/projects',
          name: 'admin-projects',
          component: () => import('@/pages/admin/ProjectsPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/custom-fields',
          name: 'admin-custom-fields',
          component: () => import('@/pages/admin/CustomFieldsPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/calendar',
          name: 'admin-calendar',
          component: () => import('@/pages/admin/AdminCalendarPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/notifications',
          name: 'admin-notifications',
          component: () => import('@/pages/admin/NotificationsPage.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'admin/audit-logs',
          name: 'admin-audit-logs',
          component: () => import('@/pages/admin/AuditLogsPage.vue'),
          meta: { adminOnly: true },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'calendar' },
    },
  ],
});

let authChecked = false;

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authChecked) {
    await authStore.fetchMe();
    authChecked = true;
  }

  // Регистрация по инвайту должна быть доступна без авторизации.
  if (to.name === 'register') {
    return true;
  }

  if (to.path === '/') {
    return authStore.isAuthenticated ? { name: 'calendar' } : { name: 'login' };
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' };
  }

  if (to.meta.public && authStore.isAuthenticated) {
    return { name: 'calendar' };
  }
});

export default router;
