# MODULE_19 — Frontend: Глобальные composables и UX-улучшения

## Обзор

Модуль добавляет переиспользуемые composables и UX-детали: глобальный индикатор загрузки, toast-обёртку, composable пагинации, useAsync для стандартного паттерна загрузки, плавные переходы между страницами, dark mode toggle, а также UI для просмотра логов ошибок фронта (Admin → Отладка).

> **Зависимости модуля:**
> - `useUiStore` из MODULE_2
> - Подключается в `AppLayout` и `App.vue`

---

## Шаг 1. useAsync — стандартный паттерн загрузки

`src/composables/useAsync.js`:

```js
import { ref } from 'vue';

/**
 * Оборачивает async-функцию в стандартный паттерн loading/error.
 *
 * const { loading, error, execute } = useAsync(myApiCall);
 * await execute(arg1, arg2);
 */
export function useAsync(fn) {
  const loading = ref(false);
  const error = ref(null);

  async function execute(...args) {
    loading.value = true;
    error.value = null;
    try {
      return await fn(...args);
    } catch (err) {
      error.value = err.response?.data?.message ?? err.message ?? 'Произошла ошибка';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, execute };
}
```

---

## Шаг 2. useToastHelper — удобная обёртка над Toast

`src/composables/useToastHelper.js`:

```js
import { useToast } from 'primevue/usetoast';

export function useToastHelper() {
  const toast = useToast();

  return {
    success: (message, title = 'Готово') =>
      toast.add({ severity: 'success', summary: title, detail: message, life: 3000 }),

    error: (message, title = 'Ошибка') =>
      toast.add({ severity: 'error', summary: title, detail: message, life: 5000 }),

    warn: (message, title = 'Внимание') =>
      toast.add({ severity: 'warn', summary: title, detail: message, life: 4000 }),

    info: (message, title = 'Информация') =>
      toast.add({ severity: 'info', summary: title, detail: message, life: 3000 }),
  };
}
```

---

## Шаг 3. usePagination — composable для таблиц с серверной пагинацией

`src/composables/usePagination.js`:

```js
import { ref, reactive } from 'vue';

export function usePagination(defaultLimit = 20) {
  const page = ref(1);
  const limit = ref(defaultLimit);
  const total = ref(0);

  function onPage(event) {
    page.value = event.page + 1;
    limit.value = event.rows;
  }

  function reset() {
    page.value = 1;
  }

  return { page, limit, total, onPage, reset };
}
```

---

## Шаг 4. Глобальный индикатор загрузки

Добавить в `src/layouts/AppLayout.vue` после `<header>`:

```vue
<!-- Thin progress bar при глобальной загрузке -->
<div
  v-if="uiStore.globalLoading"
  class="h-0.5 bg-primary-400 animate-pulse fixed top-0 left-0 right-0 z-50"
/>
```

Добавить в `src/api/http.js` interceptors для глобального флага:

```js
import { useUiStore } from '@/stores/ui.js';

let activeRequests = 0;

http.interceptors.request.use((config) => {
  activeRequests++;
  // Пробуем получить стор (может быть не инициализирован до mount)
  try {
    const uiStore = useUiStore();
    uiStore.setLoading(true);
  } catch { /* ignore */ }
  return config;
});

http.interceptors.response.use(
  (response) => {
    activeRequests--;
    if (activeRequests === 0) {
      try { useUiStore().setLoading(false); } catch { /* ignore */ }
    }
    return response;
  },
  (error) => {
    activeRequests--;
    if (activeRequests === 0) {
      try { useUiStore().setLoading(false); } catch { /* ignore */ }
    }
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## Шаг 5. Анимации переходов между страницами

Обновить `src/layouts/AppLayout.vue`:

```vue
<main class="flex-1 overflow-auto p-6">
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" :key="$route.path" />
    </Transition>
  </RouterView>
</main>
```

Добавить в `src/assets/main.css`:

```css
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
```

---

## Шаг 6. Dark Mode Toggle

Добавить кнопку в шапку `AppLayout.vue` рядом с кнопкой закрытия месяца:

```vue
<Button
  :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
  text rounded
  severity="secondary"
  v-tooltip="isDark ? 'Светлая тема' : 'Тёмная тема'"
  @click="toggleDark"
/>
```

В `<script setup>` AppLayout:

```js
import { useDark, useToggle } from '@vueuse/core';

const isDark = useDark();
const toggleDark = useToggle(isDark);
```

Dark Mode уже настроен в PrimeVue через `darkModeSelector: '.dark'` (MODULE_0) — `useDark` из VueUse автоматически добавляет/убирает класс `.dark` на `<html>`.

---

## Шаг 7. Компонент EmptyState

`src/components/EmptyState.vue`:

```vue
<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
      <i :class="icon" class="text-2xl text-surface-400" />
    </div>
    <h3 class="text-base font-medium text-surface-600 mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-surface-400 max-w-xs">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<script setup>
defineOptions({ name: 'EmptyState' });
defineProps({
  icon: { type: String, default: 'pi pi-inbox' },
  title: { type: String, default: 'Нет данных' },
  description: { type: String, default: '' },
});
</script>
```

Использование в DataTable вместо простого текста:

```vue
<template #empty>
  <EmptyState
    icon="pi pi-clock"
    title="Логи не найдены"
    description="Создайте первый рабочий лог или измените фильтры"
  />
</template>
```

---

## Шаг 8. Admin: Отладка → Ошибки фронта (просмотр)

После внедрения отправки ошибок с фронта на backend (`POST /api/log-js-error`, MODULE_19 + backend MODULE_14), добавлен раздел в админской части, чтобы ошибки можно было смотреть из UI:

- **Навигация (sidebar)**: в `src/layouts/AppLayout.vue` под «Администрирование» добавлен новый блок «Отладка» с пунктом **«Ошибки фронта»**.
- **Маршрут**: `admin/debug/js-errors` (name: `admin-js-errors`, `meta: { adminOnly: true }`).
- **API**: `GET /api/js-errors` (backend, admin-only) возвращает список ошибок с пагинацией.
- **Страница**: `src/pages/admin/JsErrorsPage.vue` — таблица + диалог «Подробнее» (message/source/url/stack/user_agent/ip/created_at/lineno/colno).
- **Store**: `src/stores/jsErrors.js` — загрузка списка для таблицы.

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | `useAsync` работает | Использовать в любом компоненте → `loading` и `error` реактивны | <span style="color:red">❌ Не реализовано</span> |
| 2 | `useToastHelper` работает | `toast.success('OK')` → зелёный Toast в правом углу | <span style="color:red">❌ Не реализовано</span> |
| 3 | Глобальный индикатор | Замедлить сеть в DevTools → при запросах тонкая полоска вверху страницы | <span style="color:red">❌ Не реализовано</span> |
| 4 | Анимация страниц | Переход между пунктами меню → плавный fade+slide | <span style="color:red">❌ Не реализовано</span> |
| 5 | Dark Mode | Клик на луну → тема меняется на тёмную; повторный клик → светлая | <span style="color:red">❌ Не реализовано</span> |
| 6 | Dark Mode сохраняется | Перезагрузить страницу → тема та же что была выбрана | <span style="color:red">❌ Не реализовано</span> |
| 7 | EmptyState компонент | Использован хотя бы в одной таблице вместо plain-текста | ✅ Реализовано |
| 8 | `usePagination` | Использовать в AuditLogsPage → смена страницы корректно | <span style="color:red">❌ Не реализовано</span> |
| 9 | Просмотр ошибок фронта в UI | Admin → «Отладка» → «Ошибки фронта» → видна таблица и детали записи | ✅ Реализовано |
