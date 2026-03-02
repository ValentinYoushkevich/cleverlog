# MODULE_1 — Frontend: Роутер и layouts

## Обзор

Модуль реализует финальную структуру роутера с полным списком маршрутов, navigation guard, два layout-компонента (AuthLayout и AppLayout с сайдбаром и шапкой) и заглушки всех страниц.

> **Зависимости модуля:**
> - `useAuthStore` из MODULE_2 — в роутере используется заглушка, финальный guard подключается в MODULE_20 (RBAC)
> - Все страницы создаются как заглушки — наполняются в соответствующих модулях

---

## Шаг 1. Полный список маршрутов

`src/router/index.js`:

```js
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Публичные
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

    // Защищённые — внутри AppLayout
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
        // Отчёты
        {
          path: 'reports/user',
          name: 'reports-user',
          component: () => import('@/pages/reports/UserReportPage.vue'),
        },
        // Admin-only
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

    // Fallback
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'calendar' },
    },
  ],
});

// Guard — финальная логика в MODULE_20, здесь заглушка
router.beforeEach((to) => {
  const isAuthenticated = !!localStorage.getItem('_auth_check'); // заменить в MODULE_20
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' };
  }
  if (to.meta.public && isAuthenticated) {
    return { name: 'calendar' };
  }
});

export default router;
```

---

## Шаг 2. AuthLayout

`src/layouts/AuthLayout.vue`:

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-50">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-primary">CleverLog</h1>
        <p class="mt-1 text-surface-500">Система учёта рабочего времени</p>
      </div>
      <RouterView />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AuthLayout' });
</script>
```

---

## Шаг 3. AppLayout

`src/layouts/AppLayout.vue`:

```vue
<template>
  <div class="flex h-screen bg-surface-50 overflow-hidden">
    <!-- Сайдбар -->
    <aside class="w-64 flex-shrink-0 bg-surface-0 border-r border-surface-200 flex flex-col">
      <!-- Логотип -->
      <div class="h-16 flex items-center px-6 border-b border-surface-200">
        <span class="text-xl font-bold text-primary">CleverLog</span>
      </div>

      <!-- Навигация -->
      <nav class="flex-1 overflow-y-auto py-4 px-3">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-surface-700 hover:bg-surface-100 transition-colors"
              active-class="bg-primary-50 text-primary font-medium"
            >
              <i :class="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>

        <!-- Admin-секция -->
        <template v-if="isAdmin">
          <div class="mt-6 mb-2 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Администрирование
          </div>
          <ul class="space-y-1">
            <li v-for="item in adminNavItems" :key="item.name">
              <RouterLink
                :to="{ name: item.name }"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-surface-700 hover:bg-surface-100 transition-colors"
                active-class="bg-primary-50 text-primary font-medium"
              >
                <i :class="item.icon" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </nav>

      <!-- Пользователь внизу -->
      <div class="border-t border-surface-200 p-4">
        <div class="flex items-center gap-3">
          <Avatar :label="userInitials" shape="circle" class="bg-primary text-white" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-surface-800 truncate">{{ userName }}</p>
            <p class="text-xs text-surface-400 truncate">{{ userRole }}</p>
          </div>
          <Button
            icon="pi pi-sign-out"
            text
            rounded
            severity="secondary"
            size="small"
            v-tooltip="'Выйти'"
            @click="handleLogout"
          />
        </div>
      </div>
    </aside>

    <!-- Основной контент -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Шапка -->
      <header class="h-16 bg-surface-0 border-b border-surface-200 flex items-center justify-between px-6 flex-shrink-0">
        <div class="flex items-center gap-3">
          <span class="text-lg font-semibold text-surface-800">{{ pageTitle }}</span>
          <Tag
            v-if="isClosed"
            value="Месяц закрыт"
            severity="danger"
            icon="pi pi-lock"
          />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="isAdmin"
            :label="isClosed ? 'Открыть месяц' : 'Закрыть месяц'"
            :severity="isClosed ? 'secondary' : 'warning'"
            size="small"
            :icon="isClosed ? 'pi pi-lock-open' : 'pi pi-lock'"
            @click="handleMonthToggle"
          />
        </div>
      </header>

      <!-- Контент страницы -->
      <main class="flex-1 overflow-auto p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Avatar from 'primevue/avatar';
import Button from 'primevue/button';
import Tag from 'primevue/tag';

defineOptions({ name: 'AppLayout' });

// Заглушки — заменить на сторы в MODULE_2
const isAdmin = computed(() => false);
const userName = computed(() => 'Пользователь');
const userRole = computed(() => 'user');
const userInitials = computed(() => 'П');
const isClosed = computed(() => false);
const pageTitle = computed(() => 'CleverLog');

const navItems = [
  { name: 'calendar', label: 'Календарь', icon: 'pi pi-calendar' },
  { name: 'work-logs', label: 'Рабочие логи', icon: 'pi pi-clock' },
  { name: 'absences', label: 'Отсутствия', icon: 'pi pi-calendar-times' },
  { name: 'reports-user', label: 'Мой отчёт', icon: 'pi pi-chart-bar' },
  { name: 'profile', label: 'Профиль', icon: 'pi pi-user' },
];

const adminNavItems = [
  { name: 'dashboard', label: 'Дашборд', icon: 'pi pi-th-large' },
  { name: 'reports-project', label: 'Отчёт по проекту', icon: 'pi pi-briefcase' },
  { name: 'reports-monthly-summary', label: 'Свод по месяцу', icon: 'pi pi-table' },
  { name: 'admin-users', label: 'Пользователи', icon: 'pi pi-users' },
  { name: 'admin-projects', label: 'Проекты', icon: 'pi pi-folder' },
  { name: 'admin-custom-fields', label: 'Кастомные поля', icon: 'pi pi-sliders-h' },
  { name: 'admin-calendar', label: 'Календарь', icon: 'pi pi-calendar-plus' },
  { name: 'admin-notifications', label: 'Уведомления', icon: 'pi pi-bell' },
  { name: 'admin-audit-logs', label: 'Журнал аудита', icon: 'pi pi-list' },
];

function handleLogout() {
  // реализация в MODULE_3
}

function handleMonthToggle() {
  // реализация в MODULE_16
}
</script>
```

---

## Шаг 4. Заглушки всех страниц

Создать файлы с минимальным содержимым. Структура `src/pages/`:

```
pages/
  LoginPage.vue
  RegisterPage.vue
  CalendarPage.vue
  WorkLogsPage.vue
  AbsencesPage.vue
  ProfilePage.vue
  DashboardPage.vue
  reports/
    UserReportPage.vue
    ProjectReportPage.vue
    MonthlySummaryPage.vue
  admin/
    UsersPage.vue
    ProjectsPage.vue
    CustomFieldsPage.vue
    AdminCalendarPage.vue
    NotificationsPage.vue
    AuditLogsPage.vue
```

Шаблон заглушки (менять `name` и заголовок под каждый файл):

```vue
<template>
  <div class="p-4">
    <h2 class="text-xl font-semibold">CalendarPage</h2>
    <p class="text-surface-400 mt-1">Модуль в разработке</p>
  </div>
</template>

<script setup>
defineOptions({ name: 'CalendarPage' });
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | `/login` открывается | `http://localhost:5173/login` → AuthLayout с заглушкой LoginPage | Прошло ✅ |
| 2 | Guard редиректит на `/login` | Открыть `/calendar` без `_auth_check` в localStorage → редирект | Прошло ✅ |
| 3 | AppLayout рендерится | Установить `_auth_check=1` в localStorage → `/calendar` → виден сайдбар + шапка | Прошло ✅ |
| 4 | Навигация работает | Клик по пунктам меню → роут меняется, RouterView обновляется | Прошло ✅ |
| 5 | Admin-секция скрыта | `isAdmin = false` → секция «Администрирование» не видна в сайдбаре | Прошло ✅ |
| 6 | Все страницы-заглушки созданы | Переход на любой маршрут → нет ошибок роутера | Прошло ✅ |
| 7 | Fallback redirect | Перейти на `/несуществующий` → редирект на `/calendar` | Прошло ✅ |
| 8 | Active-класс в сайдбаре | На `/calendar` → пункт «Календарь» имеет класс `bg-primary-50 text-primary` | Прошло ✅ |
