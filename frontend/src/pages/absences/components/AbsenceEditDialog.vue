<template>
  <Dialog
    v-model:visible="visible"
    header="Редактировать отсутствие"
    modal
    class="w-full max-w-md"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="absence-edit-user" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь
        </label>
        <InputText
          id="absence-edit-user"
          :modelValue="userLabel"
          class="w-full"
          disabled
        />
      </div>
      <div>
        <label for="absence-edit-type" class="mb-1 block text-sm font-medium text-surface-700">
          Тип
        </label>
        <Select
          id="absence-edit-type"
          v-model="form.type"
          :options="ABSENCE_TYPES"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
      <div>
        <label for="absence-edit-date" class="mb-1 block text-sm font-medium text-surface-700">
          Дата
        </label>
        <DatePicker
          id="absence-edit-date"
          v-model="form.date"
          class="w-full"
          dateFormat="dd.mm.yy"
          showIcon
        />
      </div>
      <div>
        <label for="absence-edit-duration" class="mb-1 block text-sm font-medium text-surface-700">
          Длительность <span class="text-red-500">*</span>
          <span class="font-normal text-surface-400">(макс. 24ч или 1д)</span>
        </label>
        <InputText
          id="absence-edit-duration"
          v-model="form.duration"
          class="w-full"
          :class="{ 'p-invalid': localErrors.duration }"
          placeholder="1d"
        />
        <small v-if="localErrors.duration" class="p-error">{{ localErrors.duration }}</small>
      </div>
      <div>
        <label for="absence-edit-comment" class="mb-1 block text-sm font-medium text-surface-700">
          Комментарий
        </label>
        <Textarea
          id="absence-edit-comment"
          v-model="form.comment"
          rows="2"
          class="w-full"
        />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Сохранить" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
import dayjs from 'dayjs';

import { parseDurationToHours } from '@/composables/useDuration.js';
import { ABSENCE_TYPES } from '@/constants/absences.js';

defineOptions({ name: 'AbsenceEditDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  absence: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const userLabel = computed(() => {
  const a = props.absence;
  if (!a) { return ''; }
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || '—';
});

const form = reactive({ type: null, date: null, duration: '', comment: '' });
const localErrors = reactive({});

watch(
  () => props.absence,
  (absence) => {
    if (!absence) {
      return;
    }
    Object.assign(form, {
      type: absence.type,
      date: new Date(absence.date),
      duration: `${absence.duration_hours}h`,
      comment: absence.comment ?? '',
    });
    Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  },
  { immediate: true },
);

function resetForm() {
  Object.assign(form, { type: null, date: null, duration: '', comment: '' });
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
}

function validate() {
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  if (!form.duration?.trim()) {
    localErrors.duration = 'Укажите длительность';
    return false;
  }
  const hours = parseDurationToHours(form.duration);
  if (hours === null) {
    localErrors.duration = 'Неверный формат (например: 4h, 0.5d)';
    return false;
  }
  if (hours <= 0) {
    localErrors.duration = 'Длительность должна быть больше 0';
    return false;
  }
  if (hours > 24) {
    localErrors.duration = 'Максимум 24ч или 1д';
    return false;
  }
  return true;
}

function buildPayload() {
  return {
    type: form.type,
    date: form.date ? dayjs(form.date).format('YYYY-MM-DD') : undefined,
    duration: form.duration || undefined,
    comment: form.comment || undefined,
  };
}

function handleCancel() {
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
