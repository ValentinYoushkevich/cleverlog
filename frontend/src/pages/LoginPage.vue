<template>
  <div class="rounded-2xl bg-surface-0 p-8 shadow-lg">
    <h2 class="mb-6 text-2xl font-semibold text-surface-800">Вход в систему</h2>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="login-email" class="mb-1 block text-sm font-medium text-surface-700">Email</label>
        <InputText
          id="login-email"
          v-model="email"
          type="email"
          name="email"
          placeholder="you@company.com"
          class="w-full"
          :class="{ 'p-invalid': errors.email }"
          autocomplete="username"
        />
        <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
      </div>

      <div>
        <label for="login-password" class="mb-1 block text-sm font-medium text-surface-700">
          Пароль
        </label>
        <Password
          v-model="password"
          inputId="login-password"
          placeholder="Введите пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.password }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          :inputProps="{ name: 'password', autocomplete: 'current-password' }"
        />
        <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
      </div>

      <Message v-if="serverError" severity="error" :closable="false">
        {{ serverError }}
      </Message>

      <Button type="submit" label="Войти" class="w-full" :loading="loading" />
    </form>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.js';
import { loginSchema } from '@/validators/auth.js';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';

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
