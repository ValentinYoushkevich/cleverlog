<template>
  <Dialog
    v-model:visible="visible"
    header="Новый проект"
    modal
    class="w-full max-w-sm"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="project-create-name" class="block text-sm font-medium text-surface-700 mb-1">
          Название <span class="text-red-500">*</span>
        </label>
        <InputText
          id="project-create-name"
          v-model="form.name"
          class="w-full"
          :class="{ 'p-invalid': localErrors.name }"
        />
        <small v-if="localErrors.name" class="p-error">{{ localErrors.name }}</small>
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Создать" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'ProjectCreateDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({ name: '' });
const localErrors = reactive({});

function resetForm() {
  form.name = '';
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
}

function validate() {
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  if (!form.name.trim()) {
    localErrors.name = 'Название обязательно';
    return false;
  }
  return true;
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
  emit('submit', { name: form.name.trim() });
}
</script>
