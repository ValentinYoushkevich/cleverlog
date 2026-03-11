<template>
  <div class="rounded-2xl bg-surface-0 p-8 shadow-lg">
    <h2 class="mb-2 text-2xl font-semibold text-surface-800">Создание пароля</h2>
    <p class="mb-6 text-sm text-surface-500">Установите пароль для вашего аккаунта</p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="register-email" class="mb-1 block text-sm font-medium text-surface-700">
          Email
        </label>
        <InputText
          id="register-email"
          v-model="email"
          type="email"
          placeholder="Введите email"
          class="w-full"
          :class="{ 'p-invalid': errors.email }"
        />
        <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
      </div>

      <div>
        <label for="register-password" class="mb-1 block text-sm font-medium text-surface-700">
          Пароль
        </label>
        <Password
          v-model="password"
          inputId="register-password"
          placeholder="Придумайте пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.password }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          :inputProps="{ name: 'password', autocomplete: 'new-password' }"
        />
        <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
      </div>

      <div v-if="password" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-surface-500">Надежность пароля</span>
          <Tag :value="strengthLabel.text" :severity="strengthLabel.severity" />
        </div>
        <ProgressBar :value="(strength / 5) * 100" :showValue="false" class="h-1.5" />
        <ul class="mt-2 space-y-1">
          <li
            v-for="criterion in criteria"
            :key="criterion.label"
            class="flex items-center gap-2 text-xs"
            :class="getCriterionTextClass(criterion)"
          >
            <i :class="getCriterionIconClass(criterion)" class="text-xs" />
            {{ criterion.label }}
          </li>
        </ul>
      </div>

      <div>
        <label
          for="register-confirm-password"
          class="mb-1 block text-sm font-medium text-surface-700"
        >
          Подтвердите пароль
        </label>
        <Password
          v-model="confirmPassword"
          inputId="register-confirm-password"
          placeholder="Повторите пароль"
          class="w-full"
          :class="{ 'p-invalid': errors.confirmPassword }"
          :feedback="false"
          toggleMask
          inputClass="w-full"
          :inputProps="{ name: 'confirmPassword', autocomplete: 'new-password' }"
        />
        <small v-if="errors.confirmPassword" class="p-error">{{ errors.confirmPassword }}</small>
      </div>

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
import http from '@/api/http.js';
import { usePasswordStrength } from '@/composables/usePasswordStrength.js';
import { useAuthStore } from '@/stores/auth.js';
import { registerSchema } from '@/validators/auth.js';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { useRoute, useRouter } from 'vue-router';

defineOptions({ name: 'RegisterPage' });

const registerRequest = (data) => http.post('/auth/register', data);

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const serverError = ref('');
const loading = ref(false);

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

const [email] = defineField('email');
const [password] = defineField('password');
const [confirmPassword] = defineField('confirmPassword');

const { criteria, strength, isStrong, strengthLabel } = usePasswordStrength(password);

function getCriterionTextClass(criterion) {
  return criterion?.met ? 'text-green-600' : 'text-surface-400';
}

function getCriterionIconClass(criterion) {
  return criterion?.met ? 'pi pi-check-circle' : 'pi pi-circle';
}

const onSubmit = handleSubmit(async (values) => {
  serverError.value = '';
  loading.value = true;
  try {
    await registerRequest({ token: route.params.token, email: values.email, password: values.password });
    // После успешной регистрации сервер уже установил cookie с JWT.
    // Обновляем текущего пользователя и отправляем на календарь.
    await authStore.fetchMe();
    await router.push({ name: 'calendar' });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVALID_TOKEN') { serverError.value = 'Ссылка недействительна или устарела.'; }
    else if (code === 'TOKEN_EXPIRED')
    { serverError.value = 'Ссылка истекла. Запросите новую у администратора.'; }
    else { serverError.value = 'Произошла ошибка. Попробуйте позже.'; }
  } finally {
    loading.value = false;
  }
});
</script>
