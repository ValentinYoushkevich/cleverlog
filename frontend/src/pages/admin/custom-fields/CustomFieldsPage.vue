<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Кастомные поля</h1>
      <div class="flex gap-2">
        <Button
          :label="showDeletedToggleLabel"
          severity="secondary"
          size="small"
          @click="toggleShowDeleted"
        />
        <Button label="Добавить поле" icon="pi pi-plus" @click="openCreateDialog" />
      </div>
    </div>

    <DataTable
      :value="fields"
      :loading="loading"
      stripedRows
      :rowClass="getFieldRowClass"
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="name" header="Название" sortable />
      <Column field="type" header="Тип" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="TYPE_LABEL[data.type]" severity="secondary" />
        </template>
      </Column>
      <Column field="deleted_at" header="Статус" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="getFieldStatusLabel(data)" :severity="getFieldStatusSeverity(data)" />
        </template>
      </Column>
      <Column header="" style="width: 120px">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button
              v-tooltip.left="'Редактировать'"
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              :disabled="!!data.deleted_at"
              @click="openEditDialog(data)"
            />
            <Button
              v-if="!data.deleted_at"
              v-tooltip.left="'Удалить'"
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              @click="softDelete(data)"
            />
            <Button
              v-else
              v-tooltip.left="'Восстановить'"
              icon="pi pi-refresh"
              text
              rounded
              size="small"
              severity="secondary"
              @click="restore(data)"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Полей нет</div>
      </template>
    </DataTable>

    <CustomFieldCreateDialog
      v-model="createDialogVisible"
      :typeOptions="CUSTOM_FIELD_TYPES"
      :submitting="submitting"
      @submit="handleCreateSubmit"
    />

    <CustomFieldEditDialog
      v-model="editDialogVisible"
      :field="editingField"
      :options="editOptions"
      :loadingOptions="loadingEditOptions"
      :submitting="submitting"
      @submit="handleEditSubmit"
      @remove-option="handleRemoveEditOption"
    />
  </div>
</template>

<script setup>
import { CUSTOM_FIELD_TYPES } from '@/constants/projects.js';
import { useCustomFieldsStore } from '@/stores/customFields.js';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';

import CustomFieldCreateDialog from './components/CustomFieldCreateDialog.vue';
import CustomFieldEditDialog from './components/CustomFieldEditDialog.vue';

defineOptions({ name: 'CustomFieldsPage' });

const toast = useToast();
const uiStore = useUiStore();
const customFieldsStore = useCustomFieldsStore();
const { fields, loading } = storeToRefs(customFieldsStore);

const TYPE_LABEL = { text: 'Текст', number: 'Число', dropdown: 'Список', checkbox: 'Флажок' };

onMounted(() => {
  uiStore.setPageTitle('Кастомные поля');
  loadFields();
});

const submitting = ref(false);
const showDeleted = ref(false);
const showDeletedToggleLabel = computed(() => (showDeleted.value ? 'Скрыть удалённые' : 'Показать удалённые'));

function getFieldStatusLabel(field) {
  return field?.deleted_at ? 'Удалено' : 'Активно';
}

function getFieldStatusSeverity(field) {
  return field?.deleted_at ? 'danger' : 'success';
}

function loadFields() {
  customFieldsStore.fetchList(showDeleted.value ? { include_deleted: true } : {});
}

function getFieldRowClass(data) {
  return data?.deleted_at ? '!bg-yellow-100' : '';
}

function toggleShowDeleted() {
  showDeleted.value = !showDeleted.value;
  loadFields();
}

// Создание
const createDialogVisible = ref(false);

function openCreateDialog() {
  createDialogVisible.value = true;
}

async function handleCreateSubmit(payload) {
  submitting.value = true;
  try {
    await customFieldsStore.create(payload);
    toast.add({ severity: 'success', summary: 'Поле создано', life: 3000 });
    createDialogVisible.value = false;
    await loadFields();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка создания', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

// Редактирование
const editDialogVisible = ref(false);
const editingField = ref(null);
const editOptions = ref([]);
const optionsToRemove = ref(new Set());
const loadingEditOptions = ref(false);

async function openEditDialog(field) {
  editingField.value = field;
  editOptions.value = [];
  optionsToRemove.value = new Set();
  editDialogVisible.value = true;

  if (field.type === 'dropdown') {
    loadingEditOptions.value = true;
    try {
      const data = await customFieldsStore.getOptions(field.id);
      editOptions.value = (data || []).filter((o) => !o.is_deprecated);
    } finally {
      loadingEditOptions.value = false;
    }
  }
}

function handleRemoveEditOption(option) {
  optionsToRemove.value.add(option.id);
  editOptions.value = editOptions.value.filter((o) => o.id !== option.id);
}

async function handleEditSubmit(payload) {
  if (!editingField.value) {
    return;
  }
  submitting.value = true;
  try {
    const fieldId = editingField.value.id;
    await customFieldsStore.update(fieldId, { name: payload.name });

    const idsToRemove = [...optionsToRemove.value];
    for (const optionId of idsToRemove) {
      await customFieldsStore.deprecateOption(fieldId, optionId);
    }

    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadFields();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

async function softDelete(field) {
  try {
    await customFieldsStore.softDelete(field.id);
    toast.add({ severity: 'success', summary: 'Поле скрыто', life: 3000 });
    await loadFields();
  } catch (err) {
    toast.add({ severity: 'error', summary: err.response?.data?.message ?? 'Ошибка', life: 3000 });
  }
}

async function restore(field) {
  try {
    await customFieldsStore.restore(field.id);
    toast.add({ severity: 'success', summary: 'Поле восстановлено', life: 3000 });
    await loadFields();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка восстановления', life: 3000 });
  }
}
</script>
