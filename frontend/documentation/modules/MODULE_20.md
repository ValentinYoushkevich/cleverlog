# MODULE_20 — Frontend: RBAC — финальный модуль

## Обзор

Финальный модуль — замена заглушек в роутере на реальные проверки, защита Admin-роутов, редирект уже авторизованных со страниц логина, инициализация приложения через `fetchMe`, финальный smoke-тест всех сценариев.

> **Зависимости модуля:**
> - `useAuthStore` из MODULE_2 — `isAuthenticated`, `isAdmin`, `fetchMe`
> - Роутер из MODULE_1 — обновляем `beforeEach`
> - `AppLayout` из MODULE_1 — все заглушки уже заменены в MODULE_2
>
> **Важно (порядок реализации):**
> - MODULE_20 выполнять последним, когда модули до него уже работают.
> - Этот модуль финализирует фронтенд:
>   - заменяет заглушку `isAuthenticated = false` в роутере на реальную проверку;
>   - переписывает `App.vue` на финальную версию инициализации.

---

## Шаг 1. Финальный navigation guard

Заменить заглушку в `src/router/index.js`:

```js
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [ /* ... все роуты из MODULE_1 без изменений ... */ ],
});

router.beforeEach(async (to) => {
  // Динамический импорт стора чтобы избежать circular dependency
  const { useAuthStore } = await import('@/stores/auth.js');
  const authStore = useAuthStore();

  // Ждём инициализации — fetchMe вызывается в App.vue onMounted
  // Если user ещё не загружен и это первый заход — пробуем один раз
  if (!authStore.user && !to.meta.public) {
    await authStore.fetchMe();
  }

  const isAuthenticated = authStore.isAuthenticated;
  const isAdmin = authStore.isAdmin;

  // Публичная страница + уже авторизован → на главную
  if (to.meta.public && isAuthenticated) {
    return { name: 'calendar' };
  }

  // Требует авторизации + не авторизован → логин
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' };
  }

  // Admin-only страница + не Admin → на главную с предупреждением
  if (to.meta.adminOnly && !isAdmin) {
    return { name: 'calendar' };
  }
});

export default router;
```

---

## Шаг 2. Инициализация в App.vue

`src/App.vue` — финальная версия:

```vue
<template>
  <div>
    <!-- Глобальный спиннер при первой инициализации -->
    <div v-if="initializing" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <ProgressSpinner />
        <p class="mt-4 text-surface-400 text-sm">Загрузка...</p>
      </div>
    </div>
    <template v-else>
      <RouterView />
      <Toast position="top-right" />
      <ConfirmDialog />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import ProgressSpinner from 'primevue/progressspinner';
import { useAuthStore } from '@/stores/auth.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { setupErrorLogger } from '@/utils/errorLogger.js';
import dayjs from 'dayjs';

defineOptions({ name: 'App' });

const initializing = ref(true);
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const calendarStore = useCalendarStore();

onMounted(async () => {
  setupErrorLogger();

  try {
    await authStore.fetchMe();

    if (authStore.isAuthenticated) {
      // Параллельная загрузка начальных данных
      await Promise.all([
        projectsStore.fetchProjects(),
        calendarStore.fetchMonth(dayjs().year(), dayjs().month() + 1),
      ]);
    }
  } finally {
    initializing.value = false;
  }
});
</script>
```

---

## Шаг 3. Матрица защиты роутов

| Роут | requiresAuth | adminOnly | Доступ |
|------|-------------|-----------|--------|
| `/login` | ❌ | ❌ | Все |
| `/register/:token` | ❌ | ❌ | Все |
| `/calendar` | ✅ | ❌ | User + Admin |
| `/work-logs` | ✅ | ❌ | User + Admin |
| `/absences` | ✅ | ❌ | User + Admin |
| `/profile` | ✅ | ❌ | User + Admin |
| `/reports/user` | ✅ | ❌ | User + Admin |
| `/reports/project` | ✅ | ✅ | Admin only |
| `/reports/monthly-summary` | ✅ | ✅ | Admin only |
| `/reports/unlogged` | ✅ | ✅ | Admin only |
| `/dashboard` | ✅ | ✅ | Admin only |
| `/admin/*` | ✅ | ✅ | Admin only |

---

## Шаг 4. Финальные сценарии тестирования

### Сценарий 1: User — полный цикл

```
1. Открыть http://localhost:5173 → редирект на /login
2. Войти как user@cleverlog.local
3. Сайдбар: только пользовательские пункты, нет Admin-секции
4. Перейти на /dashboard → редирект на /calendar
5. Создать Work Log → таблица обновилась
6. Перейти в /calendar → день позеленел
7. Создать Absence → день посинел
8. Открыть /reports/user → свои данные за месяц
9. Изменить профиль → сайдбар обновил имя
10. Выйти → редирект на /login
```

### Сценарий 2: Admin — полный цикл

```
1. Войти как admin@cleverlog.local
2. Сайдбар: виден раздел «Администрирование»
3. /admin/users → список пользователей, создать нового
4. /admin/projects → создать проект, привязать кастомное поле
5. /admin/calendar → переопределить один день как праздник
6. /dashboard → карточки, диаграммы за текущий месяц
7. Кликнуть по карточке «Незаполненные» → Dialog с таблицей
8. /reports/monthly-summary → сводная таблица с цветами строк
9. Закрыть месяц → Tag «Месяц закрыт» в шапке
10. Попытаться создать Work Log за закрытый месяц → заблокировано
11. Открыть месяц → снова доступно
12. /admin/audit-logs → все действия зафиксированы
```

### Сценарий 3: Регистрация по инвайту

```
1. Admin создаёт пользователя → инвайт на email
2. Открыть ссылку /register/:token
3. Страница регистрации: кнопка заблокирована, пока пароль слабый
4. Ввести сильный пароль → кнопка активна
5. Зарегистрироваться → редирект на /login
6. Войти новым пользователем → полный доступ User
```

### Сценарий 4: Изоляция данных

```
1. User A создаёт Work Log
2. Войти как User B → /work-logs → лог User A не виден
3. Admin → /work-logs → видит всех
4. Admin → /reports/project → видит всех
5. User B → /reports/user → только свои данные
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Guard работает | Открыть любой защищённый роут без авторизации → `/login` |
| 2 | Авторизованный редиректится с `/login` | Войти → зайти на `/login` → редирект на `/calendar` |
| 3 | Admin-роуты закрыты для User | User → `/dashboard` → редирект на `/calendar` |
| 4 | Первая загрузка: спиннер | Открыть приложение → мигает спиннер пока идёт `fetchMe` |
| 5 | После обновления страницы — авторизован | F5 → остаётся авторизованным (cookie жива) |
| 6 | После обновления страницы — Admin видит Admin-секцию | F5 → сайдбар сразу правильный |
| 7 | Сценарий 1 проходит полностью | Все 10 шагов без ошибок |
| 8 | Сценарий 2 проходит полностью | Все 12 шагов без ошибок |
| 9 | Сценарий 3 (инвайт) | Вся цепочка от создания до входа |
| 10 | Сценарий 4 (изоляция) | User не видит чужие данные нигде |
| 11 | 401 → редирект | Истечение сессии на сервере → автоматический выход |
| 12 | Нет лишних запросов при старте | DevTools Network: только `fetchMe` + `projects` + `calendar` |
