<template>
  <Dialog
    v-model:visible="visible"
    header="Добавить отсутствие"
    modal
    class="w-full max-w-md"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div v-if="isAdmin">
        <label for="calendar-absence-user" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь <span class="text-red-500">*</span>
        </label>
        <Select
          id="calendar-absence-user"
          v-model="form.user_id"
          :options="workLogUserOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите пользователя"
          class="w-full"
          :class="{ 'p-invalid': localErrors.user_id }"
        />
        <small v-if="localErrors.user_id" class="p-error">{{ localErrors.user_id }}</small>
      </div>
      <div v-else>
        <label for="calendar-absence-user-readonly" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь
        </label>
        <InputText
          id="calendar-absence-user-readonly"
          :modelValue="currentUserLabel"
          class="w-full"
          disabled
        />
      </div>

      <div>
        <label for="calendar-absence-type" class="mb-1 block text-sm font-medium text-surface-700">
          Тип <span class="text-red-500">*</span>
        </label>
        <Select
          id="calendar-absence-type"
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
        <label for="calendar-absence-date" class="mb-1 block text-sm font-medium text-surface-700">
          Дата <span class="text-red-500">*</span>
        </label>
        <DatePicker
          id="calendar-absence-date"
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
        <label for="calendar-absence-comment" class="mb-1 block text-sm font-medium text-surface-700">
          Комментарий
        </label>
        <Textarea
          id="calendar-absence-comment"
          v-model="form.comment"
          rows="2"
          class="w-full"
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

defineOptions({ name: 'CalendarAbsenceDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  isAdmin: { type: Boolean, required: true },
  workLogUserOptions: { type: Array, default: () => [] },
  currentUserLabel: { type: String, default: '—' },
  initialDate: { type: String, default: null },
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
  () => props.initialDate,
  (initial) => {
    if (!initial) { return; }
    form.date = new Date(initial);
  },
  { immediate: true },
);

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

function handleCancel() {
  resetForm();
  emit('cancel');
  emit('update:modelValue', false);
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
