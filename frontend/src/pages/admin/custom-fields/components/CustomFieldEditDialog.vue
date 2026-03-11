<template>
  <Dialog
    v-model:visible="visible"
    header="Редактировать поле"
    modal
    class="w-full max-w-md"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="field-edit-name" class="block text-sm font-medium text-surface-700 mb-1">
          Название
        </label>
        <InputText
          id="field-edit-name"
          v-model="form.name"
          class="w-full"
        />
      </div>

      <div v-if="field?.type === 'dropdown'" class="space-y-2">
        <span class="block text-sm font-medium text-surface-700">Варианты</span>
        <div
          v-if="loadingOptions"
          class="flex items-center gap-2 py-2 text-surface-500 text-sm"
        >
          <ProgressSpinner style="width: 20px; height: 20px" />
          Загрузка…
        </div>
        <div
          v-else-if="options.length"
          class="space-y-2"
        >
          <div
            v-for="option in options"
            :key="option.id"
            class="flex items-center gap-2"
          >
            <span class="flex-1 rounded border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800">
              {{ option.label }}
            </span>
            <Button
              icon="pi pi-times"
              text
              rounded
              severity="danger"
              size="small"
              aria-label="Удалить вариант"
              @click="handleRemoveOption(option)"
            />
          </div>
          <p class="text-xs text-surface-400">
            Нажмите крестик, чтобы убрать вариант. Изменения сохранятся по кнопке «Сохранить».
          </p>
        </div>
        <p v-else class="text-sm text-surface-400 py-2">
          Нет сохранённых вариантов
        </p>
      </div>

      <Message severity="info" :closable="false" class="text-xs">
        Тип поля нельзя изменить после создания
      </Message>

      <div class="flex justify-end gap-2">
        <Button type="button" label="Отмена" severity="secondary" @click="handleCancel" />
        <Button type="submit" label="Сохранить" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'CustomFieldEditDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  field: { type: Object, default: null },
  options: { type: Array, default: () => [] },
  loadingOptions: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit', 'remove-option', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const form = reactive({
  name: '',
});

watch(
  () => props.field,
  (field) => {
    if (!field) {
      return;
    }
    form.name = field.name ?? '';
  },
  { immediate: true },
);

function handleCancel() {
  emit('cancel');
  emit('update:modelValue', false);
}

function handleRemoveOption(option) {
  emit('remove-option', option);
}

function handleSubmit() {
  emit('submit', {
    name: form.name,
  });
}
</script>
