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

    <!-- Dialog: создание -->
    <Dialog v-model:visible="createDialogVisible" header="Новое поле" modal class="w-full max-w-md">
      <form class="space-y-4" @submit.prevent="onSubmitCreate">
        <div>
          <label for="field-create-name" class="block text-sm font-medium text-surface-700 mb-1">
            Название <span class="text-red-500">*</span>
          </label>
          <InputText id="field-create-name" v-model="createForm.name" class="w-full" :class="{ 'p-invalid': createErrors.name }" />
          <small v-if="createErrors.name" class="p-error">{{ createErrors.name }}</small>
        </div>
        <div>
          <label for="field-create-type" class="block text-sm font-medium text-surface-700 mb-1">
            Тип <span class="text-red-500">*</span>
          </label>
          <Select id="field-create-type" v-model="createForm.type" :options="CUSTOM_FIELD_TYPES" optionLabel="label" optionValue="value" class="w-full" />
        </div>

        <!-- Опции для dropdown -->
        <div v-if="createForm.type === 'dropdown'">
          <span class="block text-sm font-medium text-surface-700 mb-1">Варианты</span>
          <div v-for="(option, index) in createForm.options" :key="index" class="flex gap-2 mb-2">
            <InputText v-model="createForm.options[index]" class="flex-1" :placeholder="`Вариант ${index + 1}`" />
            <Button icon="pi pi-times" text rounded severity="danger" @click="createForm.options.splice(index, 1)" />
          </div>
          <Button label="Добавить вариант" icon="pi pi-plus" text size="small" @click="createForm.options.push('')" />
        </div>

        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: редактирование (название + варианты для списка) -->
    <Dialog v-model:visible="editDialogVisible" header="Редактировать поле" modal class="w-full max-w-md">
      <form class="space-y-4" @submit.prevent="onSubmitEdit">
        <div>
          <label for="field-edit-name" class="block text-sm font-medium text-surface-700 mb-1">Название</label>
          <InputText id="field-edit-name" v-model="editForm.name" class="w-full" />
        </div>

        <!-- Сохранённые варианты для типа «список» -->
        <div v-if="editingField?.type === 'dropdown'" class="space-y-2">
          <span class="block text-sm font-medium text-surface-700">Варианты</span>
          <div v-if="loadingEditOptions" class="flex items-center gap-2 py-2 text-surface-500 text-sm">
            <ProgressSpinner style="width: 20px; height: 20px" />
            Загрузка…
          </div>
          <div v-else-if="editOptions.length" class="space-y-2">
            <div
              v-for="option in editOptions"
              :key="option.id"
              class="flex items-center gap-2"
            >
              <span class="flex-1 rounded border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800">{{ option.label }}</span>
              <Button
                icon="pi pi-times"
                text
                rounded
                severity="danger"
                size="small"
                aria-label="Удалить вариант"
                @click="removeEditOption(opt)"
              />
            </div>
            <p class="text-xs text-surface-400">Нажмите крестик, чтобы убрать вариант. Изменения сохранятся по кнопке «Сохранить».</p>
          </div>
          <p v-else class="text-sm text-surface-400 py-2">Нет сохранённых вариантов</p>
        </div>

        <Message severity="info" :closable="false" class="text-xs">
          Тип поля нельзя изменить после создания
        </Message>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="editDialogVisible = false" />
          <Button type="submit" label="Сохранить" :loading="submitting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import { CUSTOM_FIELD_TYPES } from '@/constants/projects.js';
import { useCustomFieldsStore } from '@/stores/customFields.js';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';

defineOptions({ name: 'CustomFieldsPage' });

const toast = useToast();
const uiStore = useUiStore();
const customFieldsStore = useCustomFieldsStore();
const { fields, loading } = storeToRefs(customFieldsStore);

const TYPE_LABEL = { text: 'Текст', number: 'Число', dropdown: 'Список', checkbox: 'Флажок' };

onMounted(() => { uiStore.setPageTitle('Кастомные поля'); loadFields(); });

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

function toggleShowDeleted() { showDeleted.value = !showDeleted.value; loadFields(); }

// Создание
const createDialogVisible = ref(false);
const createForm = reactive({ name: '', type: 'text', options: [] });
const createErrors = reactive({});

function openCreateDialog() {
  Object.assign(createForm, { name: '', type: 'text', options: [] });
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  if (!createForm.name.trim()) { createErrors.name = 'Название обязательно'; return; }
  submitting.value = true;
  try {
    const payload = { name: createForm.name, type: createForm.type };
    if (createForm.type === 'dropdown') { payload.options = createForm.options.filter(o => o.trim()); }
    await customFieldsStore.create(payload);
    toast.add({ severity: 'success', summary: 'Поле создано', life: 3000 });
    createDialogVisible.value = false;
    await loadFields();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка создания', life: 3000 });
  } finally { submitting.value = false; }
}

// Редактирование
const editDialogVisible = ref(false);
const editingField = ref(null);
const editForm = reactive({ name: '' });
const editOptions = ref([]);
const optionsToRemove = ref(new Set());
const loadingEditOptions = ref(false);

async function openEditDialog(field) {
  editingField.value = field;
  editForm.name = field.name;
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

function removeEditOption(opt) {
  optionsToRemove.value.add(opt.id);
  editOptions.value = editOptions.value.filter((o) => o.id !== opt.id);
}

async function onSubmitEdit() {
  submitting.value = true;
  try {
    const fieldId = editingField.value.id;
    await customFieldsStore.update(fieldId, { name: editForm.name });

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
