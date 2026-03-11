<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Проекты</h1>
      <Button label="Добавить проект" icon="pi pi-plus" @click="openCreateDialog" />
    </div>

    <!-- Фильтр по статусу -->
    <div class="flex gap-2">
      <Button
        v-for="opt in [{ value: null, label: 'Все' }, ...PROJECT_STATUS_OPTIONS]"
        :key="String(opt.value)"
        :label="opt.label"
        :severity="getStatusFilterSeverity(opt.value)"
        size="small"
        @click="setStatusFilter(opt.value)"
      />
    </div>

    <DataTable
      :value="preparedProjects"
      :loading="loading"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="name" header="Название" sortable />
      <Column field="status" header="Статус" style="width: 140px">
        <template #body="{ data }">
          <Tag :value="PROJECT_STATUS_LABEL[data.status]" :severity="PROJECT_STATUS_SEVERITY[data.status]" />
        </template>
      </Column>
      <Column field="created_at" header="Создан" style="width: 130px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400">{{ data.createdAtText }}</span>
        </template>
      </Column>
      <Column header="Поля" style="width: 100px">
        <template #body="{ data }">
          <Button
            v-tooltip.left="'Кастомные поля'"
            icon="pi pi-sliders-h"
            text
            rounded
            size="small"
            @click="openFieldsDrawer(data)"
          />
        </template>
      </Column>
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <Button
            v-tooltip.left="'Редактировать'"
            icon="pi pi-pencil"
            text
            rounded
            size="small"
            @click="openEditDialog(data)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Проекты не найдены</div>
      </template>
    </DataTable>

    <!-- Dialog: создание -->
    <ProjectCreateDialog
      v-model="createDialogVisible"
      :submitting="submitting"
      @submit="handleCreateSubmit"
    />

    <!-- Dialog: редактирование -->
    <ProjectEditDialog
      v-model="editDialogVisible"
      :project="editingProject"
      :statusOptions="PROJECT_STATUS_OPTIONS"
      :submitting="submitting"
      @submit="handleEditSubmit"
    />

    <!-- Drawer: кастомные поля проекта -->
    <Drawer
      v-model:visible="fieldsDrawerVisible"
      :header="`Поля проекта: ${drawerProject?.name}`"
      position="right"
      class="w-full! max-w-lg!"
    >
      <div class="relative">
        <div
          v-if="updatingField"
          class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface-100/80"
          aria-busy="true"
        >
          <ProgressSpinner style="width: 40px; height: 40px" />
        </div>
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium text-surface-700">Привязанные поля</h3>
              <Button label="Привязать поле" icon="pi pi-plus" size="small" text @click="openAttachDialog" />
            </div>

            <div v-if="loadingFields" class="flex justify-center py-4">
              <ProgressSpinner style="width: 28px; height: 28px" />
            </div>

            <div v-else-if="projectFields.length" class="space-y-2">
              <div
                v-for="field in projectFields"
                :key="field.custom_field_id"
                class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-surface-800">{{ field.name }}</p>
                  <p class="text-xs text-surface-400">{{ TYPE_LABEL[field.type] }}</p>
                </div>

                <div class="flex items-center gap-4 text-xs text-surface-500">
                  <span class="flex items-center gap-1.5 cursor-pointer">
                    <ToggleSwitch
                      v-model="field.is_enabled"
                      size="small"
                      @change="updateField(field, 'is_enabled')"
                    />
                    Включено
                  </span>
                  <span class="flex items-center gap-1.5 cursor-pointer">
                    <ToggleSwitch
                      v-model="field.is_required"
                      size="small"
                      @change="updateField(field, 'is_required')"
                    />
                    Обязательное
                  </span>
                </div>

                <Button
                  v-tooltip="'Отвязать'"
                  icon="pi pi-times"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  @click="detachField(field)"
                />
              </div>
            </div>

            <p v-else class="text-sm text-surface-400 py-4 text-center">
              Нет привязанных полей
            </p>
          </div>
        </div>
      </div>
    </Drawer>

    <!-- Dialog: привязка поля -->
    <ProjectAttachFieldDialog
      v-model="attachDialogVisible"
      :fields="availableFields"
      :submitting="submitting"
      @submit="handleAttachSubmit"
    />
  </div>
</template>

<script setup>
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_OPTIONS, PROJECT_STATUS_SEVERITY } from '@/constants/projects.js';
import { useCustomFieldsStore } from '@/stores/customFields.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';

import ProjectAttachFieldDialog from './components/ProjectAttachFieldDialog.vue';
import ProjectCreateDialog from './components/ProjectCreateDialog.vue';
import ProjectEditDialog from './components/ProjectEditDialog.vue';

defineOptions({ name: 'ProjectsPage' });

const toast = useToast();
const projectsStore = useProjectsStore();
const customFieldsStore = useCustomFieldsStore();
const uiStore = useUiStore();
const { projects, loading } = storeToRefs(projectsStore);
const preparedProjects = computed(() =>
  (projects.value ?? []).map((p) => ({
    ...p,
    createdAtText: p.created_at ? dayjs(p.created_at).format('DD.MM.YYYY') : '—',
  })),
);

const TYPE_LABEL = { text: 'Текст', number: 'Число', dropdown: 'Список', checkbox: 'Флажок' };

// --- Drawer с полями ---
const fieldsDrawerVisible = ref(false);
const drawerProject = ref(null);
const projectFields = ref([]);
const loadingFields = ref(false);
const updatingField = ref(false);

async function openFieldsDrawer(project) {
  drawerProject.value = project;
  fieldsDrawerVisible.value = true;
  await loadProjectFields();
}

async function loadProjectFields() {
  loadingFields.value = true;
  try {
    const data = await projectsStore.getProjectFields(drawerProject.value.id);
    projectFields.value = data ?? [];
  } finally {
    loadingFields.value = false;
  }
}

async function updateField(field) {
  updatingField.value = true;
  try {
    await projectsStore.updateProjectField(drawerProject.value.id, field.custom_field_id, {
      is_required: field.is_required,
      is_enabled: field.is_enabled,
    });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
    await loadProjectFields();
  } finally {
    updatingField.value = false;
  }
}

async function detachField(field) {
  try {
    await projectsStore.detachField(drawerProject.value.id, field.custom_field_id);
    await loadProjectFields();
    toast.add({ severity: 'success', summary: 'Поле отвязано', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
  }
}

// --- Dialog: привязка ---
const attachDialogVisible = ref(false);
const allFields = ref([]);

const availableFields = computed(() => {
  const attached = new Set(projectFields.value.map((f) => f.custom_field_id));
  return allFields.value.filter((f) => !attached.has(f.id) && !f.is_deleted);
});

async function openAttachDialog() {
  await customFieldsStore.fetchList();
  allFields.value = customFieldsStore.fields ?? [];
  attachDialogVisible.value = true;
}

async function handleAttachSubmit(payload) {
  if (!drawerProject.value) {
    return;
  }
  submitting.value = true;
  try {
    await projectsStore.attachFieldToProject(drawerProject.value.id, payload);
    toast.add({ severity: 'success', summary: 'Поле привязано', life: 2000 });
    attachDialogVisible.value = false;
    await loadProjectFields();
  } catch (err) {
    toast.add({ severity: 'error', summary: err.response?.data?.message ?? 'Ошибка', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  uiStore.setPageTitle('Проекты');
  loadProjects();
});

const submitting = ref(false);
const filters = reactive({ status: null });

function getStatusFilterSeverity(status) {
  return filters.status === status ? 'primary' : 'secondary';
}

function loadProjects() {
  const params = filters.status ? { status: filters.status } : {};
  projectsStore.fetchProjects(params);
}

function setStatusFilter(val) {
  filters.status = val;
  loadProjects();
}

// Создание
const createDialogVisible = ref(false);

function openCreateDialog() {
  createDialogVisible.value = true;
}

async function handleCreateSubmit(payload) {
  submitting.value = true;
  try {
    await projectsStore.createProject(payload);
    toast.add({ severity: 'success', summary: 'Проект создан', life: 3000 });
    createDialogVisible.value = false;
    await loadProjects();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка создания', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

// Редактирование
const editDialogVisible = ref(false);
const editingProject = ref(null);

function openEditDialog(project) {
  editingProject.value = project;
  editDialogVisible.value = true;
}

async function handleEditSubmit(payload) {
  if (!editingProject.value) {
    return;
  }
  submitting.value = true;
  try {
    await projectsStore.updateProject(editingProject.value.id, payload);
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadProjects();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally {
    submitting.value = false;
  }
}
</script>
