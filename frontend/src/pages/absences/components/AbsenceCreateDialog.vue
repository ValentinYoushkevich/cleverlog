<template>
  <Dialog
    v-model:visible="visible"
    header="Добавить отсутствие"
    modal
    class="w-full max-w-md"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div v-if="isAdmin">
        <label for="absence-create-user" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь <span class="text-red-500">*</span>
        </label>
        <Select
          id="absence-create-user"
          v-model="form.user_id"
          :options="userOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите пользователя"
          class="w-full"
          :class="{ 'p-invalid': localErrors.user_id }"
          :loading="usersLoading"
        />
        <small v-if="localErrors.user_id" class="p-error">{{ localErrors.user_id }}</small>
      </div>
      <div v-else>
        <label for="absence-create-user-readonly" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь
        </label>
        <InputText id="absence-create-user-readonly" :modelValue="currentUserLabel" class="w-full" disabled />
      </div>
      <div>
        <label for="absence-create-type" class="mb-1 block text-sm font-medium text-surface-700">
          Тип <span class="text-red-500">*</span>
        </label>
        <Select
          id="absence-create-type"
          v-model="form.type"
          :options="ABSENCE_TYPES"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите тип"
          class="w-full"
          :class="{ 'p-invalid': localErrors.type }"
        />
        <small v-if="localErrors.type" class="p-error">{{ localErrors.type }}</small>
      </div>

      <div>
        <label for="absence-create-date" class="mb-1 block text-sm font-medium text-surface-700">
          Дата <span class="text-red-500">*</span>
        </label>
        <DatePicker
          id="absence-create-date"
          v-model="form.date"
          class="w-full"
          dateFormat="dd.mm.yy"
          :class="{ 'p-invalid': localErrors.date }"
          placeholder="Выберите дату"
          showIcon
        />
        <small v-if="localErrors.date" class="p-error">{{ localErrors.date }}</small>
      </div>

      <div>
        <label for="absence-create-comment" class="mb-1 block text-sm font-medium text-surface-700">
          Комментарий
        </label>
        <Textarea
          id="absence-create-comment"
          v-model="form.comment"
          rows="2"
          class="w-full"
          placeholder="Необязательно"
        />
      </div>

      <Message v-if="localErrors.submit" severity="error" :closable="false" class="w-full">
        {{ localErrors.submit }}
      </Message>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Создать" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
import dayjs from 'dayjs';

import { ABSENCE_TYPES } from '@/constants/absences.js';

defineOptions({ name: 'AbsenceCreateDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  isAdmin: { type: Boolean, required: true },
  userOptions: { type: Array, default: () => [] },
  usersLoading: { type: Boolean, default: false },
  currentUserLabel: { type: String, default: '—' },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({ user_id: null, type: null, date: null, comment: '' });
const localErrors = reactive({});

watch(
  () => ({ ...form }),
  () => {
    Object.keys(localErrors).forEach((key) => {
      if (key !== 'submit') { delete localErrors[key]; }
    });
  },
  { deep: true },
);

function resetForm() {
  Object.assign(form, { user_id: null, type: null, date: null, comment: '' });
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
}

function validate() {
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  if (props.isAdmin && !form.user_id) {
    localErrors.user_id = 'Выберите пользователя';
    return false;
  }
  if (!form.type) {
    localErrors.type = 'Выберите тип';
    return false;
  }
  if (!form.date) {
    localErrors.date = 'Выберите дату';
    return false;
  }
  return true;
}

function handleCancel() {
  resetForm();
  emit('cancel');
  emit('update:modelValue', false);
}

function buildPayload() {
  const dateStr = dayjs(form.date).format('YYYY-MM-DD');
  const payload = {
    type: form.type,
    date_from: dateStr,
    date_to: dateStr,
    comment: form.comment || undefined,
  };
  if (props.isAdmin && form.user_id) {
    payload.user_id = form.user_id;
  }
  return payload;
}

function handleSubmit() {
  if (!validate()) {
    return;
  }
  const payload = buildPayload();
  emit('submit', payload);
}

defineExpose({
  resetForm,
});
</script>
