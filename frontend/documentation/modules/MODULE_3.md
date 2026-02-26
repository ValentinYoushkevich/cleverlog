# MODULE_3 — Frontend: Аутентификация

## Обзор

Модуль реализует страницы логина и регистрации по инвайту. Live-валидация через vee-validate + zod. Обработка серверных ошибок (ACCOUNT_LOCKED, ACCOUNT_INACTIVE). На странице регистрации — индикатор силы пароля с 5 критериями, кнопка заблокирована до выполнения всех условий.

> **Зависимости модуля:**
> - `useAuthStore` из MODULE_2 — `login()`, `fetchMe()`
> - `authApi` из MODULE_2 — `register()`
> - `AppLayout` из MODULE_1 уже подключён — страницы рендерятся через `AuthLayout`

---

## Шаг 1. Composable: валидация пароля

`src/composables/usePasswordStrength.js`:

```js
import { computed } from 'vue';

export function usePasswordStrength(password) {
  const criteria = computed(() => [
    { label: 'Минимум 8 символов', met: password.value?.length >= 8 },
    { label: 'Заглавная буква', met: /[A-Z]/.test(password.value ?? '') },
    { label: 'Строчная буква', met: /[a-z]/.test(password.value ?? '') },
    { label: 'Цифра', met: /\d/.test(password.value ?? '') },
    { label: 'Спецсимвол', met: /[^a-zA-Z\d]/.test(password.value ?? '') },
  ]);

  const strength = computed(() => criteria.value.filter(c => c.met).length);
  const isStrong = computed(() => strength.value === 5);

  const strengthLabel = computed(() => {
    if (strength.value <= 1) return { text: 'Очень слабый', severity: 'danger' };
    if (strength.value <= 2) return { text: 'Слабый', severity: 'danger' };
    if (strength.value <= 3) return { text: 'Средний', severity: 'warn' };
    if (strength.value <= 4) return { text: 'Хороший', severity: 'info' };
    return { text: 'Сильный', severity: 'success' };
  });

  return { criteria, strength, isStrong, strengthLabel };
}
```

---

## Шаг 2. Zod-схемы

`src/validators/auth.js`:

```js
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(/[A-Z]/, 'Нужна заглавная буква')
  .regex(/[a-z]/, 'Нужна строчная буква')
  .regex(/\d/, 'Нужна цифра')
  .regex(/[^a-zA-Z\d]/, 'Нужен спецсимвол');

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});
```

---

## Шаг 3. LoginPage

`src/pages/LoginPage.vue`:

```vue
<template>
  <div class="bg-surface-0 rounded-2xl shadow-lg p-8">
    <h2 class="text-2xl font-semibold text-surface-800 mb-6">Вход в систему</h2>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <!-- Email -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Email</label>
        <InputText
          v-model="email"
          type="email"
          placeholder="you@company.com"
          class="w-full"
          :class="{ 'p-invalid': errors.email }"
          autocomplete="email"
        />
        <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
      </div>

      <!-- Пароль -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Пароль</label>
        <Password
          v-model="password"
          placeholder="Введите пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.password }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          autocomplete="current-password"
        />
        <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
      </div>

      <!-- Серверная ошибка -->
      <Message v-if="serverError" severity="error" :closable="false">
        {{ serverError }}
      </Message>

      <Button
        type="submit"
        label="Войти"
        class="w-full"
        :loading="loading"
      />
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useAuthStore } from '@/stores/auth.js';
import { loginSchema } from '@/validators/auth.js';

defineOptions({ name: 'LoginPage' });

const authStore = useAuthStore();
const serverError = ref('');
const loading = ref(false);

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(loginSchema),
});

const [email] = defineField('email');
const [password] = defineField('password');

const SERVER_ERRORS = {
  ACCOUNT_LOCKED: 'Аккаунт временно заблокирован. Попробуйте через 10 минут.',
  ACCOUNT_INACTIVE: 'Аккаунт деактивирован. Обратитесь к администратору.',
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
};

const onSubmit = handleSubmit(async (values) => {
  serverError.value = '';
  loading.value = true;
  try {
    await authStore.login(values);
  } catch (err) {
    const code = err.response?.data?.code;
    serverError.value = SERVER_ERRORS[code] ?? 'Произошла ошибка. Попробуйте позже.';
  } finally {
    loading.value = false;
  }
});
</script>
```

---

## Шаг 4. RegisterPage

`src/pages/RegisterPage.vue`:

```vue
<template>
  <div class="bg-surface-0 rounded-2xl shadow-lg p-8">
    <h2 class="text-2xl font-semibold text-surface-800 mb-2">Создание пароля</h2>
    <p class="text-surface-500 text-sm mb-6">Установите пароль для вашего аккаунта</p>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <!-- Пароль -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Пароль</label>
        <Password
          v-model="password"
          placeholder="Придумайте пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.password }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          autocomplete="new-password"
        />
        <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
      </div>

      <!-- Индикатор силы пароля -->
      <div v-if="password" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-surface-500">Надёжность пароля</span>
          <Tag :value="strengthLabel.text" :severity="strengthLabel.severity" />
        </div>
        <ProgressBar :value="(strength / 5) * 100" :showValue="false" class="h-1.5" />
        <ul class="space-y-1 mt-2">
          <li
            v-for="c in criteria"
            :key="c.label"
            class="flex items-center gap-2 text-xs"
            :class="c.met ? 'text-green-600' : 'text-surface-400'"
          >
            <i :class="c.met ? 'pi pi-check-circle' : 'pi pi-circle'" class="text-xs" />
            {{ c.label }}
          </li>
        </ul>
      </div>

      <!-- Подтверждение пароля -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1">Подтвердите пароль</label>
        <Password
          v-model="confirmPassword"
          placeholder="Повторите пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.confirmPassword }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          autocomplete="new-password"
        />
        <small v-if="errors.confirmPassword" class="p-error">{{ errors.confirmPassword }}</small>
      </div>

      <!-- Серверная ошибка -->
      <Message v-if="serverError" severity="error" :closable="false">
        {{ serverError }}
      </Message>

      <Button
        type="submit"
        label="Создать аккаунт"
        class="w-full"
        :loading="loading"
        :disabled="!isStrong"
      />
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import { authApi } from '@/api/auth.js';
import { registerSchema } from '@/validators/auth.js';
import { usePasswordStrength } from '@/composables/usePasswordStrength.js';

defineOptions({ name: 'RegisterPage' });

const route = useRoute();
const router = useRouter();
const serverError = ref('');
const loading = ref(false);

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const [password] = defineField('password');
const [confirmPassword] = defineField('confirmPassword');

const { criteria, strength, isStrong, strengthLabel } = usePasswordStrength(password);

const onSubmit = handleSubmit(async (values) => {
  serverError.value = '';
  loading.value = true;
  try {
    await authApi.register({ token: route.params.token, password: values.password });
    await router.push({ name: 'login' });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVALID_TOKEN') serverError.value = 'Ссылка недействительна или устарела.';
    else if (code === 'TOKEN_EXPIRED') serverError.value = 'Ссылка истекла. Запросите новую у администратора.';
    else serverError.value = 'Произошла ошибка. Попробуйте позже.';
  } finally {
    loading.value = false;
  }
});
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Login: пустая форма → ошибки | Нажать «Войти» без заполнения → ошибки под полями |
| 2 | Login: невалидный email | Ввести `notanemail` → `'Введите корректный email'` |
| 3 | Login: успешный вход | Ввести данные тестового user → редирект на `/calendar` |
| 4 | Login: ACCOUNT_LOCKED | 5 неверных попыток → сообщение о блокировке |
| 5 | Login: ACCOUNT_INACTIVE | Войти неактивным → соответствующее сообщение |
| 6 | Register: кнопка заблокирована | Открыть `/register/:token` → кнопка disabled пока не выполнены все 5 критериев |
| 7 | Register: индикатор силы | Вводить пароль → критерии загораются зелёным, прогресс-бар растёт |
| 8 | Register: пароли не совпадают | Разные пароли → ошибка под полем подтверждения |
| 9 | Register: успешная регистрация | Правильный токен + сильный пароль → редирект на `/login` |
| 10 | Register: невалидный токен | Неверный токен → `'Ссылка недействительна или устарела.'` |
