<template>
  <Dialog
    v-model:visible="visible"
    header="Новое поле"
    modal
    class="w-full max-w-md"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="field-create-name" class="block text-sm font-medium text-surface-700 mb-1">
          Название <span class="text-red-500">*</span>
        </label>
        <InputText
          id="field-create-name"
          v-model="form.name"
          class="w-full"
          :class="{ 'p-invalid': errors.name }"
        />
        <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
      </div>
      <div>
        <label for="field-create-type" class="block text-sm font-medium text-surface-700 mb-1">
          Тип <span class="text-red-500">*</span>
        </label>
        <Select
          id="field-create-type"
          v-model="form.type"
          :options="typeOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>

      <div v-if="form.type === 'dropdown'">
        <span class="block text-sm font-medium text-surface-700 mb-1">Варианты</span>
        <div
          v-for="(option, index) in form.options"
          :key="index"
          class="flex gap-2 mb-2"
        >
          <InputText
            v-model="form.options[index]"
            class="flex-1"
            :placeholder="`Вариант ${index + 1}`"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="danger"
            @click="removeOption(index)"
          />
        </div>
        <Button
          label="Добавить вариант"
          icon="pi pi-plus"
          text
          size="small"
          @click="addOption"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Создать" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'CustomFieldCreateDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  typeOptions: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({
  name: '',
  type: 'text',
  options: [],
});

const errors = reactive({});

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      resetForm();
    }
  },
);

function resetForm() {
  Object.assign(form, { name: '', type: 'text', options: [] });
  Object.keys(errors).forEach((key) => delete errors[key]);
}

function addOption() {
  form.options.push('');
}

function removeOption(index) {
  form.options.splice(index, 1);
}

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key]);
  if (!form.name.trim()) {
    errors.name = 'Название обязательно';
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
  const payload = {
    name: form.name.trim(),
    type: form.type,
  };
  if (form.type === 'dropdown') {
    payload.options = form.options.filter((o) => o.trim());
  }
  emit('submit', payload);
}
</script>
