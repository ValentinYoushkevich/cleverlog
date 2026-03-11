<template>
  <Dialog
    v-model:visible="visible"
    header="Привязать поле"
    modal
    class="w-full max-w-sm"
  >
    <div class="space-y-4">
      <div>
        <label for="project-attach-field" class="block text-sm font-medium text-surface-700 mb-1">
          Поле
        </label>
        <Select
          id="project-attach-field"
          v-model="form.field_id"
          :options="fields"
          optionLabel="name"
          optionValue="id"
          placeholder="Выберите поле"
          class="w-full"
          :class="{ 'p-invalid': localErrors.field_id }"
        />
        <small v-if="localErrors.field_id" class="p-error">{{ localErrors.field_id }}</small>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch v-model="form.is_required" />
        <span class="text-sm text-surface-700">Обязательное</span>
      </div>
      <div class="flex items-center gap-3">
        <ToggleSwitch v-model="form.is_enabled" />
        <span class="text-sm text-surface-700">Включено</span>
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button label="Привязать" :loading="submitting" @click="handleSubmit" />
      </div>
    </div>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'ProjectAttachFieldDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  fields: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({
  field_id: null,
  is_required: false,
  is_enabled: true,
});

const localErrors = reactive({});

function resetForm() {
  form.field_id = null;
  form.is_required = false;
  form.is_enabled = true;
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
}

function validate() {
  Object.keys(localErrors).forEach((key) => delete localErrors[key]);
  if (!form.field_id) {
    localErrors.field_id = 'Выберите поле';
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

  emit('submit', {
    custom_field_id: form.field_id,
    is_required: form.is_required,
    is_enabled: form.is_enabled,
  });
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      resetForm();
    }
  },
);
</script>
