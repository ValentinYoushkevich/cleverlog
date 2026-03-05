<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-semibold text-surface-800">Профиль</h1>

    <Card>
      <template #title>Личные данные</template>
      <template #content>
        <form class="space-y-4" @submit.prevent="onSaveProfile">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="profile-first-name" class="mb-1 block text-sm font-medium text-surface-700">
                Имя
              </label>
              <InputText
                id="profile-first-name"
                v-model="firstName"
                name="first_name"
                autocomplete="off"
                class="w-full"
                :class="{ 'p-invalid': profileErrors.first_name }"
              />
              <small v-if="profileErrors.first_name" class="p-error">{{ profileErrors.first_name }}</small>
            </div>
            <div>
              <label for="profile-last-name" class="mb-1 block text-sm font-medium text-surface-700">
                Фамилия
              </label>
              <InputText
                id="profile-last-name"
                v-model="lastName"
                name="last_name"
                autocomplete="off"
                class="w-full"
                :class="{ 'p-invalid': profileErrors.last_name }"
              />
              <small v-if="profileErrors.last_name" class="p-error">{{ profileErrors.last_name }}</small>
            </div>
          </div>

          <div>
            <label for="profile-position" class="mb-1 block text-sm font-medium text-surface-700">
              Должность
            </label>
            <InputText
              id="profile-position"
              v-model="position"
              name="position"
              autocomplete="off"
              class="w-full"
              placeholder="Не указана"
            />
          </div>

          <div>
            <label for="profile-email" class="mb-1 block text-sm font-medium text-surface-700">
              Email
            </label>
            <InputText id="profile-email" :value="authStore.user?.email" class="w-full" disabled />
            <small class="text-surface-400">Email изменить нельзя</small>
          </div>

          <Message v-if="profileSuccess" severity="success" :closable="false">
            Данные сохранены
          </Message>
          <Message v-if="profileError" severity="error" :closable="false">
            {{ profileError }}
          </Message>

          <Button type="submit" label="Сохранить" :loading="profileLoading" />
        </form>
      </template>
    </Card>

    <Card>
      <template #title>Смена пароля</template>
      <template #content>
        <form class="space-y-4" @submit.prevent="onChangePassword">
          <div>
            <label for="profile-current-password" class="mb-1 block text-sm font-medium text-surface-700">
              Текущий пароль
            </label>
            <Password
              v-model="currentPassword"
              inputId="profile-current-password"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.current_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
              :inputProps="{ name: 'current_password', autocomplete: 'current-password' }"
            />
            <small v-if="passwordErrors.current_password" class="p-error">
              {{ passwordErrors.current_password }}
            </small>
          </div>

          <div>
            <label for="profile-new-password" class="mb-1 block text-sm font-medium text-surface-700">
              Новый пароль
            </label>
            <Password
              v-model="newPassword"
              inputId="profile-new-password"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.new_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
              :inputProps="{ name: 'new_password', autocomplete: 'new-password' }"
            />
            <small v-if="passwordErrors.new_password" class="p-error">
              {{ passwordErrors.new_password }}
            </small>
          </div>

          <div v-if="newPassword" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-surface-500">Надежность пароля</span>
              <Tag :value="strengthLabel.text" :severity="strengthLabel.severity" />
            </div>
            <ProgressBar :value="(strength / 5) * 100" :showValue="false" class="h-1.5" />
          </div>

          <div>
            <label for="profile-confirm-password" class="mb-1 block text-sm font-medium text-surface-700">
              Подтвердите новый пароль
            </label>
            <Password
              v-model="confirmPassword"
              inputId="profile-confirm-password"
              class="w-full"
              :class="{ 'p-invalid': passwordErrors.confirm_password }"
              :feedback="false"
              toggleMask
              inputClass="w-full"
              :inputProps="{ name: 'confirm_password', autocomplete: 'new-password' }"
            />
            <small v-if="passwordErrors.confirm_password" class="p-error">
              {{ passwordErrors.confirm_password }}
            </small>
          </div>

          <Message v-if="passwordSuccess" severity="success" :closable="false">
            Пароль изменен
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
import { toTypedSchema } from '@vee-validate/zod';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import { useForm } from 'vee-validate';
import { onMounted, ref, watch } from 'vue';

import { usePasswordStrength } from '@/composables/usePasswordStrength.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { changePasswordSchema, profileSchema } from '@/validators/profile.js';

defineOptions({ name: 'ProfilePage' });

const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Профиль');
});

const profileLoading = ref(false);
const profileSuccess = ref(false);
const profileError = ref('');

const {
  defineField: defineProfileField,
  handleSubmit: handleProfileSubmit,
  errors: profileErrors,
  setValues,
} = useForm({
  validationSchema: toTypedSchema(profileSchema),
});

const [firstName] = defineProfileField('first_name');
const [lastName] = defineProfileField('last_name');
const [position] = defineProfileField('position');

watch(
  () => authStore.user,
  (user) => {
    if (!user) { return; }
    setValues({
      first_name: user.first_name,
      last_name: user.last_name,
      position: user.position ?? '',
    });
  },
  { immediate: true }
);

const onSaveProfile = handleProfileSubmit(async (values) => {
  profileLoading.value = true;
  profileSuccess.value = false;
  profileError.value = '';
  try {
    await authStore.updateProfile(values);
    await authStore.fetchMe();
    profileSuccess.value = true;
  } catch {
    profileError.value = 'Не удалось сохранить данные';
  } finally {
    profileLoading.value = false;
  }
});

const passwordLoading = ref(false);
const passwordSuccess = ref(false);
const passwordError = ref('');

const {
  defineField: definePasswordField,
  handleSubmit: handlePasswordSubmit,
  errors: passwordErrors,
  resetForm: resetPasswordForm,
} = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
});

const [currentPassword] = definePasswordField('current_password');
const [newPassword] = definePasswordField('new_password');
const [confirmPassword] = definePasswordField('confirm_password');

const { strength, strengthLabel } = usePasswordStrength(newPassword);

const onChangePassword = handlePasswordSubmit(async (values) => {
  passwordLoading.value = true;
  passwordSuccess.value = false;
  passwordError.value = '';
  try {
    await authStore.changePassword({
      current_password: values.current_password,
      new_password: values.new_password,
    });
    passwordSuccess.value = true;
    resetPasswordForm();
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVALID_PASSWORD') {
      passwordError.value = 'Текущий пароль введен неверно';
    } else {
      passwordError.value = 'Не удалось изменить пароль';
    }
  } finally {
    passwordLoading.value = false;
  }
});
</script>
