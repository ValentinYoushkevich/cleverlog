<template>
  <Dialog
    v-model:visible="visible"
    header="Редактировать проект"
    modal
    class="w-full max-w-sm"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="project-edit-name" class="block text-sm font-medium text-surface-700 mb-1">
          Название <span class="text-red-500">*</span>
        </label>
        <InputText
          id="project-edit-name"
          v-model="form.name"
          class="w-full"
          :class="{ 'p-invalid': localErrors.name }"
        />
        <small v-if="localErrors.name" class="p-error">{{ localErrors.name }}</small>
      </div>
      <div>
        <label for="project-edit-status" class="block text-sm font-medium text-surface-700 mb-1">
          Статус
        </label>
        <Select
          id="project-edit-status"
          v-model="form.status"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Сохранить" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'ProjectEditDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  project: { type: Object, default: null },
  statusOptions: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({ name: '', status: 'active' });
const localErrors = reactive({});

watch(
  () => props.project,
  (project) => {
    if (!project) {
      return;
    }
    form.name = project.name ?? '';
    form.status = project.status ?? 'active';
    Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  },
  { immediate: true },
);

function validate() {
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  if (!form.name.trim()) {
    localErrors.name = 'Название обязательно';
    return false;
  }
  return true;
}

function handleCancel() {
  emit('cancel');
  emit('update:modelValue', false);
}

function handleSubmit() {
  if (!validate()) {
    return;
  }
  emit('submit', {
    name: form.name.trim(),
    status: form.status,
  });
}
</script>
