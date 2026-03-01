MODULE_0 — Frontend: Инициализация проекта
Шаг 1. Инициализация проекта
bashnpm create vue@latest cleverlog-frontend
В интерактивном меню выбрать:

✅ TypeScript — No (используем JS)
✅ Vue Router — Yes
✅ Pinia — Yes
✅ ESLint — Yes
✅ Prettier — No
Остальное — No

bashcd cleverlog-frontend
npm install

Шаг 2. Структура папок
Привести src/ к виду:
src/
  api/             — axios-инстанс и функции запросов по модулям
  assets/          — глобальные стили, шрифты
  components/      — переиспользуемые компоненты
  composables/     — useX-функции
  constants/       — UPPER_SNAKE_CASE константы
  layouts/         — AuthLayout.vue, AppLayout.vue
  pages/           — страницы (по роутам)
  router/          — index.js
  stores/          — Pinia сторы
  utils/           — вспомогательные функции
  App.vue
  main.js
Удалить всё лишнее что создал Vite: src/components/HelloWorld.vue, src/views/, src/assets/logo.svg.

Шаг 3. Установка зависимостей
bashnpm install primevue @primevue/themes primeicons \
  axios dayjs \
  vee-validate @vee-validate
bashnpm install -D tailwindcss @tailwindcss/vite tailwindcss-primeui

Шаг 4. Настройка Tailwind
vite.config.js:
jsimport { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
src/assets/main.css:
css@import "tailwindcss";
@import "tailwindcss-primeui";

Шаг 5. Настройка PrimeVue в main.js
jsimport { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import 'primeicons/primeicons.css';

import App from '@/App.vue';
import router from '@/router/index.js';
import '@/assets/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
  ripple: true,
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');

Шаг 6. App.vue — базовый шаблон
vue<template>
  <RouterView />
  <Toast />
  <ConfirmDialog />
</template>

<script setup>
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

defineOptions({ name: 'App' });
</script>

Шаг 7. Роутер — заглушки
src/router/index.js:
jsimport { createRouter, createWebHistory } from 'vue-router';

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
});

// Navigation guard — логика появится в модуле RBAC
router.beforeEach((to) => {
  const isAuthenticated = false; // заменить на useAuthStore в MODULE_2
  if (!to.meta.public && !isAuthenticated) {
    return { name: 'login' };
  }
});

export default router;

Шаг 8. Заглушки страниц и layouts
src/pages/LoginPage.vue:
vue<template>
  <div>Login page</div>
</template>

<script setup>
defineOptions({ name: 'LoginPage' });
</script>
src/pages/RegisterPage.vue и src/pages/HomePage.vue — аналогично.
src/layouts/AppLayout.vue:
vue<template>
  <div class="flex h-screen">
    <aside>Sidebar placeholder</aside>
    <main class="flex-1 overflow-auto p-4">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
defineOptions({ name: 'AppLayout' });
</script>
src/layouts/AuthLayout.vue:
vue<template>
  <div class="flex min-h-screen items-center justify-center">
    <RouterView />
  </div>
</template>

<script setup>
defineOptions({ name: 'AuthLayout' });
</script>

Шаг 9. Axios инстанс
src/api/http.js:
jsimport axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // для HttpOnly cookie
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

Шаг 10. Переменные окружения
.env:
envVITE_API_URL=http://localhost:3000/api
.env.example — то же без значений. Добавить .env в .gitignore.

Шаг 11. ESLint
eslint.config.js:
json{
  "extends": ["eslint:recommended", "plugin:vue/vue3-recommended"],
  "rules": {
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "vue/component-definition-name-casing": ["error", "PascalCase"],
    "vue/no-unused-vars": "warn"
  }
}

Критерии приёмки
| # | Проверка | Как проверить | Статус |
|---|---|---|---|
| 1 | Проект стартует | `npm run dev` → нет ошибок в консоли | Прошло ✅ |
| 2 | Редирект на `/login` работает | Открыть `http://localhost:5173` → редирект на `/login` | Прошло ✅ |
| 3 | `LoginPage` рендерится | `http://localhost:5173/login` → текст `Login page`, нет ошибок | Прошло ✅ |
| 4 | PrimeVue подключён | Добавить `<Button label="Test" />` на любую страницу → рендерится styled-кнопка Aura | Прошло ✅ |
| 5 | Tailwind работает | Добавить `class="text-red-500"` → текст красный | Прошло ✅ |
| 6 | Алиас `@/` работает | Импорт через `@/api/http.js` → нет ошибок резолвинга | Прошло ✅ |
| 7 | axios `withCredentials` | В DevTools → Network → запрос к API → `withCredentials: true` | Прошло ✅ |
| 8 | `401`-interceptor работает | Имитировать `401`-ответ от сервера → редирект на `/login` | Прошло ✅ |
| 9 | Структура папок соответствует схеме | Все директории из Шага 2 присутствуют в `src/` | Прошло ✅ |