# MODULE_4 — Frontend: Профиль пользователя

## Обзор

Страница `/profile` с двумя Card: редактирование имени, фамилии и должности; смена пароля с индикатором силы. После сохранения профиля `fetchMe()` обновляет данные в сайдбаре.

> **Зависимости модуля:**
> - `useAuthStore` из MODULE_2 — `fetchMe()`, `user`
> - `authApi` из MODULE_2 — `changePassword()`
> - `usePasswordStrength` из MODULE_3

---

## Шаг 1. API-функция профиля

Добавить в `src/api/auth.js`:

```js
updateProfile: (data) => http.patch('/auth/profile', data),
```

> На бэкенде эндпоинт `PATCH /api/auth/profile` — реализовать в бэк MODULE_3 если не был добавлен. Обновляет `first_name`, `last_name`, `position` текущего пользователя.

---

## Шаг 2. Zod-схемы

`src/validators/profile.js`:

```js
import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z.string().min(1, 'Имя обязательно'),
  last_name: z.string().min(1, 'Фамилия обязательна'),
  position: z.string().optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Введите текущий пароль'),
  new_password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Z]/, 'Нужна заглавная буква')
    .regex(/[a-z]/, 'Нужна строчная буква')
    .regex(/\d/, 'Нужна цифра')
    .regex(/[^a-zA-Z\d]/, 'Нужен спецсимвол'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Пароли не совпадают',
  path: ['confirm_password'],
});
```

---

## Шаг 3. ProfilePage

`src/pages/ProfilePage.vue`:

```vue
<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-semibold text-surface-800">Профиль</h1>

    <!-- Карточка: данные пользователя -->
    <Card>
      <template #title>Личные данные</template>
      <template #content>
        <form @submit.prevent="onSaveProfile" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Имя</label>
              <InputText
                v-model="firstName"
                class="w-full"
                :class="{ 'p-invalid': profileErrors.first_name }"
              />
              <small v-if="profileErrors.first_name" class="p-error">{{ profileErrors.first_name }}</small>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1">Фамилия</label>
              <InputText
                v-model="lastName"
                class="w-full"
                :class="{ 'p-invalid': profileErrors.last_name }"
              />
              <small v-if="profileErrors.last_name" class="p-error">{{ profileErrors.last_name }}</small>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Должность</label>
            <InputText v-model="position" class="w-full" placeholder="Не указана" />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Email</label>
            <InputText :value="authStore.user?.email" class="w-full" disabled />
            <small class="text-surface-400">Email изменить нельзя</small>
          </div>

          <Message v-if="profileSuccess" severity="success" :closable="false">
            Данные сохранены
          </Message>
          <Message v-if="profileError" severity="error" :closable="false">
            {{ profileError }}
          </Message>

          <Button
            type="submit"
            label="Сохранить"
            :loading="profileLoading"
          />
        </form>
      </template>
    </Card>

    <!-- Карточка: смена пароля -->
    <Card>
      <template #title>Смена пароля</template>
      <template #content>
        <form @submit.prevent="onChangePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Текущий пароль</label>
            <Password
              v-model="currentPassword"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.current_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
            />
            <small v-if="passwordErrors.current_password" class="p-error">{{ passwordErrors.current_password }}</small>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Новый пароль</label>
            <Password
              v-model="newPassword"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.new_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
            />
            <small v-if="passwordErrors.new_password" class="p-error">{{ passwordErrors.new_password }}</small>
          </div>

          <!-- Индикатор силы -->
          <div v-if="newPassword" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-surface-500">Надёжность пароля</span>
              <Tag :value="strengthLabel.text" :severity="strengthLabel.severity" />
            </div>
            <ProgressBar :value="(strength / 5) * 100" :showValue="false" class="h-1.5" />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Подтвердите новый пароль</label>
            <Password
              v-model="confirmPassword"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.confirm_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
            />
            <small v-if="passwordErrors.confirm_password" class="p-error">{{ passwordErrors.confirm_password }}</small>
          </div>

          <Message v-if="passwordSuccess" severity="success" :closable="false">
            Пароль изменён
          </Message>
          <Message v-if="passwordError" severity="error" :closable="false">
            {{ passwordError }}
          </Message>

          <Button
            type="submit"
            label="Изменить пароль"
            severity="secondary"
            :loading="passwordLoading"
          />
        </form>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import { useAuthStore } from '@/stores/auth.js';
import { authApi } from '@/api/auth.js';
import { profileSchema, changePasswordSchema } from '@/validators/profile.js';
import { usePasswordStrength } from '@/composables/usePasswordStrength.js';
import { useUiStore } from '@/stores/ui.js';

defineOptions({ name: 'ProfilePage' });

const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(() => uiStore.setPageTitle('Профиль'));

// --- Форма профиля ---
const profileLoading = ref(false);
const profileSuccess = ref(false);
const profileError = ref('');

const { defineField: defineProfileField, handleSubmit: handleProfileSubmit, errors: profileErrors, setValues } = useForm({
  validationSchema: toTypedSchema(profileSchema),
});

const [firstName] = defineProfileField('first_name');
const [lastName] = defineProfileField('last_name');
const [position] = defineProfileField('position');

onMounted(() => {
  if (authStore.user) {
    setValues({
      first_name: authStore.user.first_name,
      last_name: authStore.user.last_name,
      position: authStore.user.position ?? '',
    });
  }
});

const onSaveProfile = handleProfileSubmit(async (values) => {
  profileLoading.value = true;
  profileSuccess.value = false;
  profileError.value = '';
  try {
    await authApi.updateProfile(values);
    await authStore.fetchMe(); // обновляет сайдбар
    profileSuccess.value = true;
  } catch {
    profileError.value = 'Не удалось сохранить данные';
  } finally {
    profileLoading.value = false;
  }
});

// --- Форма смены пароля ---
const passwordLoading = ref(false);
const passwordSuccess = ref(false);
const passwordError = ref('');

const { defineField: definePasswordField, handleSubmit: handlePasswordSubmit, errors: passwordErrors, resetForm: resetPasswordForm } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
});

const [currentPassword] = definePasswordField('current_password');
const [newPassword] = definePasswordField('new_password');
const [confirmPassword] = definePasswordField('confirm_password');

const { strength, isStrong, strengthLabel } = usePasswordStrength(newPassword);

const onChangePassword = handlePasswordSubmit(async (values) => {
  passwordLoading.value = true;
  passwordSuccess.value = false;
  passwordError.value = '';
  try {
    await authApi.changePassword({
      current_password: values.current_password,
      new_password: values.new_password,
    });
    passwordSuccess.value = true;
    resetPasswordForm();
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVALID_PASSWORD') {
      passwordError.value = 'Текущий пароль введён неверно';
    } else {
      passwordError.value = 'Не удалось изменить пароль';
    }
  } finally {
    passwordLoading.value = false;
  }
});
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Страница открывается | `/profile` → два Card без ошибок |
| 2 | Форма профиля предзаполнена | Поля `Имя`, `Фамилия`, `Должность` содержат данные из стора |
| 3 | Email disabled | Поле email нередактируемо |
| 4 | Сохранение профиля | Изменить имя → «Сохранить» → `200`, сайдбар обновился |
| 5 | Пустые обязательные поля | Очистить Имя → «Сохранить» → ошибка валидации |
| 6 | Смена пароля успешна | Верный текущий + сильный новый → «Пароль изменён», форма сброшена |
| 7 | Неверный текущий пароль | → `'Текущий пароль введён неверно'` |
| 8 | Индикатор силы пароля | Вводить новый пароль → критерии загораются, Tag меняет severity |
| 9 | Пароли не совпадают | → ошибка под полем подтверждения |
