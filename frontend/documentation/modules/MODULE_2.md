# MODULE_2 — Frontend: Pinia — глобальные сторы

## Обзор

Модуль создаёт четыре глобальных Pinia-стора: `useAuthStore`, `useCalendarStore`, `useProjectsStore`, `useUiStore`. После реализации этого модуля заглушки в `AppLayout` и роутере заменяются на реальные данные.

> **Зависимости модуля:**
> - `src/api/http.js` из MODULE_0 — axios-инстанс
> - После реализации: обновить заглушки в `AppLayout.vue` (MODULE_1) и `router/index.js` (MODULE_1)

---

## Шаг 1. API-функции

`src/api/auth.js`:

```js
import http from '@/api/http.js';

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
  register: (data) => http.post('/auth/register', data),
  changePassword: (data) => http.post('/auth/change-password', data),
};
```

`src/api/calendar.js`:

```js
import http from '@/api/http.js';

export const calendarApi = {
  getMonth: (year, month) => http.get(`/calendar/${year}/${month}`),
  getMonthStatus: (year, month) => http.get(`/month-closures/status/${year}/${month}`),
  closeMonth: (year, month) => http.post('/month-closures', { year, month }),
  openMonth: (year, month) => http.delete(`/month-closures/${year}/${month}`),
};
```

`src/api/projects.js`:

```js
import http from '@/api/http.js';

export const projectsApi = {
  list: (params) => http.get('/projects', { params }),
};
```

---

## Шаг 2. useAuthStore

`src/stores/auth.js`:

```js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth.js';
import router from '@/router/index.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const userName = computed(() =>
    user.value ? `${user.value.last_name} ${user.value.first_name}` : ''
  );
  const userInitials = computed(() => {
    if (!user.value) return '';
    return `${user.value.first_name?.[0] ?? ''}${user.value.last_name?.[0] ?? ''}`.toUpperCase();
  });

  async function fetchMe() {
    try {
      const res = await authApi.me();
      user.value = res.data;
    } catch {
      user.value = null;
    }
  }

  async function login(credentials) {
    loading.value = true;
    try {
      const res = await authApi.login(credentials);
      user.value = res.data.user;
      await router.push({ name: 'calendar' });
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
      await router.push({ name: 'login' });
    }
  }

  return { user, loading, isAuthenticated, isAdmin, userName, userInitials, fetchMe, login, logout };
});
```

---

## Шаг 3. useCalendarStore

`src/stores/calendar.js`:

```js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import { calendarApi } from '@/api/calendar.js';

export const useCalendarStore = defineStore('calendar', () => {
  const currentYear = ref(dayjs().year());
  const currentMonth = ref(dayjs().month() + 1);
  const normHours = ref(168);
  const days = ref([]);
  const isClosed = ref(false);
  const loading = ref(false);

  const monthLabel = computed(() => {
    return dayjs(`${currentYear.value}-${currentMonth.value}-01`)
      .format('MMMM YYYY');
  });

  async function fetchMonth(year, month) {
    loading.value = true;
    try {
      const [calRes, statusRes] = await Promise.all([
        calendarApi.getMonth(year, month),
        calendarApi.getMonthStatus(year, month),
      ]);
      currentYear.value = year;
      currentMonth.value = month;
      normHours.value = calRes.data.norm_hours;
      days.value = calRes.data.days;
      isClosed.value = statusRes.data.closed;
    } finally {
      loading.value = false;
    }
  }

  function prevMonth() {
    const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).subtract(1, 'month');
    fetchMonth(d.year(), d.month() + 1);
  }

  function nextMonth() {
    const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).add(1, 'month');
    fetchMonth(d.year(), d.month() + 1);
  }

  return { currentYear, currentMonth, normHours, days, isClosed, loading, monthLabel, fetchMonth, prevMonth, nextMonth };
});
```

---

## Шаг 4. useProjectsStore

`src/stores/projects.js`:

```js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { projectsApi } from '@/api/projects.js';

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref([]);
  const loading = ref(false);

  const activeProjects = computed(() =>
    projects.value.filter(p => p.status === 'active')
  );

  async function fetchProjects() {
    loading.value = true;
    try {
      const res = await projectsApi.list();
      projects.value = res.data;
    } finally {
      loading.value = false;
    }
  }

  return { projects, activeProjects, loading, fetchProjects };
});
```

---

## Шаг 5. useUiStore

`src/stores/ui.js`:

```js
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const globalLoading = ref(false);
  const pageTitle = ref('CleverLog');

  function setLoading(val) {
    globalLoading.value = val;
  }

  function setPageTitle(title) {
    pageTitle.value = title;
  }

  return { globalLoading, pageTitle, setLoading, setPageTitle };
});
```

---

## Шаг 6. Подключить сторы в AppLayout

Обновить заглушки в `src/layouts/AppLayout.vue` (заменить закомментированные строки):

```js
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useUiStore } from '@/stores/ui.js';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const calendarStore = useCalendarStore();
const uiStore = useUiStore();
const router = useRouter();

const isAdmin = computed(() => authStore.isAdmin);
const userName = computed(() => authStore.userName);
const userRole = computed(() => authStore.user?.role ?? '');
const userInitials = computed(() => authStore.userInitials);
const isClosed = computed(() => calendarStore.isClosed);
const pageTitle = computed(() => uiStore.pageTitle);

async function handleLogout() {
  await authStore.logout();
}
```

---

## Шаг 7. Подключить fetchMe при старте

`src/App.vue` — добавить инициализацию:

```vue
<template>
  <RouterView />
  <Toast />
  <ConfirmDialog />
</template>

<script setup>
import { onMounted } from 'vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useAuthStore } from '@/stores/auth.js';
import { useProjectsStore } from '@/stores/projects.js';

defineOptions({ name: 'App' });

const authStore = useAuthStore();
const projectsStore = useProjectsStore();

onMounted(async () => {
  await authStore.fetchMe();
  if (authStore.isAuthenticated) {
    await projectsStore.fetchProjects();
  }
});
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | `useAuthStore.fetchMe` работает | При наличии валидной cookie → `user.value` заполняется данными с `/api/auth/me` |
| 2 | `isAuthenticated` реактивен | После `fetchMe` → `isAuthenticated.value === true` |
| 3 | `isAdmin` корректен | Залогиниться admin → `isAdmin === true`; user → `false` |
| 4 | `userName` и `userInitials` | В сайдбаре AppLayout отображаются реальные имя и инициалы |
| 5 | `logout` очищает стор | После `logout()` → `user.value === null`, редирект на `/login` |
| 6 | `useCalendarStore.fetchMonth` | Вызвать → `days`, `normHours`, `isClosed` заполняются из API |
| 7 | `activeProjects` фильтрует | В `useProjectsStore` → только проекты со статусом `active` |
| 8 | `pageTitle` в шапке | `uiStore.setPageTitle('Календарь')` → заголовок в шапке обновился |
| 9 | AppLayout использует реальные сторы | Сайдбар и шапка отражают данные из стора, не заглушки |
