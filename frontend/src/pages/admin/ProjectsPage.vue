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
        :severity="filters.status === opt.value ? 'primary' : 'secondary'"
        size="small"
        @click="setStatusFilter(opt.value)"
      />
    </div>

    <DataTable
      :value="projects"
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
          <span class="text-xs text-surface-400">{{ dayjs(data.created_at).format('DD.MM.YYYY') }}</span>
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
    <Dialog v-model:visible="createDialogVisible" header="Новый проект" modal class="w-full max-w-sm">
      <form class="space-y-4" @submit.prevent="onSubmitCreate">
        <div>
          <label for="project-create-name" class="block text-sm font-medium text-surface-700 mb-1">Название *</label>
          <InputText id="project-create-name" v-model="createForm.name" class="w-full" :class="{ 'p-invalid': createErrors.name }" />
          <small v-if="createErrors.name" class="p-error">{{ createErrors.name }}</small>
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: редактирование -->
    <Dialog v-model:visible="editDialogVisible" header="Редактировать проект" modal class="w-full max-w-sm">
      <form class="space-y-4" @submit.prevent="onSubmitEdit">
        <div>
          <label for="project-edit-name" class="block text-sm font-medium text-surface-700 mb-1">Название *</label>
          <InputText id="project-edit-name" v-model="editForm.name" class="w-full" />
        </div>
        <div>
          <label for="project-edit-status" class="block text-sm font-medium text-surface-700 mb-1">Статус</label>
          <Select id="project-edit-status" v-model="editForm.status" :options="PROJECT_STATUS_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="editDialogVisible = false" />
          <Button type="submit" label="Сохранить" :loading="submitting" />
        </div>
      </form>
    </Dialog>

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
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <ToggleSwitch
                    v-model="field.is_enabled"
                    size="small"
                    @change="updateField(field, 'is_enabled')"
                  />
                  Включено
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <ToggleSwitch
                    v-model="field.is_required"
                    size="small"
                    @change="updateField(field, 'is_required')"
                  />
                  Обязательное
                </label>
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
    <Dialog v-model:visible="attachDialogVisible" header="Привязать поле" modal class="w-full max-w-sm">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Поле</label>
          <Select
            v-model="attachForm.field_id"
            :options="availableFields"
            optionLabel="name"
            optionValue="id"
            placeholder="Выберите поле"
            class="w-full"
          />
        </div>
        <div class="flex items-center gap-3">
          <ToggleSwitch v-model="attachForm.is_required" />
          <span class="text-sm text-surface-700">Обязательное</span>
        </div>
        <div class="flex items-center gap-3">
          <ToggleSwitch v-model="attachForm.is_enabled" />
          <span class="text-sm text-surface-700">Включено</span>
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="attachDialogVisible = false" />
          <Button label="Привязать" :loading="submitting" @click="attachField" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_OPTIONS, PROJECT_STATUS_SEVERITY } from '@/constants/projects.js';
import { useCustomFieldsStore } from '@/stores/customFields.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Drawer from 'primevue/drawer';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

defineOptions({ name: 'ProjectsPage' });

const toast = useToast();
const projectsStore = useProjectsStore();
const customFieldsStore = useCustomFieldsStore();
const uiStore = useUiStore();
const { projects, loading } = storeToRefs(projectsStore);

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

async function updateField(field, key) {
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
const attachForm = reactive({ field_id: null, is_required: false, is_enabled: true });

const availableFields = computed(() => {
  const attached = new Set(projectFields.value.map((f) => f.custom_field_id));
  return allFields.value.filter((f) => !attached.has(f.id) && !f.is_deleted);
});

async function openAttachDialog() {
  await customFieldsStore.fetchList();
  allFields.value = customFieldsStore.fields ?? [];
  Object.assign(attachForm, { field_id: null, is_required: false, is_enabled: true });
  attachDialogVisible.value = true;
}

async function attachField() {
  if (!attachForm.field_id) { return; }
  submitting.value = true;
  try {
    await projectsStore.attachFieldToProject(drawerProject.value.id, {
      custom_field_id: attachForm.field_id,
      is_required: attachForm.is_required,
      is_enabled: attachForm.is_enabled,
    });
    toast.add({ severity: 'success', summary: 'Поле привязано', life: 2000 });
    attachDialogVisible.value = false;
    await loadProjectFields();
  } catch (err) {
    toast.add({ severity: 'error', summary: err.response?.data?.message ?? 'Ошибка', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

onMounted(() => { uiStore.setPageTitle('Проекты'); loadProjects(); });

const submitting = ref(false);
const filters = reactive({ status: null });

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
const createForm = reactive({ name: '' });
const createErrors = reactive({});

function openCreateDialog() {
  createForm.name = '';
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  if (!createForm.name.trim()) { createErrors.name = 'Название обязательно'; return; }
  submitting.value = true;
  try {
    await projectsStore.createProject({ name: createForm.name });
    toast.add({ severity: 'success', summary: 'Проект создан', life: 3000 });
    createDialogVisible.value = false;
    await loadProjects();
    await projectsStore.fetchProjects();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка создания', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

// Редактирование
const editDialogVisible = ref(false);
const editingProject = ref(null);
const editForm = reactive({ name: '', status: 'active' });

function openEditDialog(project) {
  editingProject.value = project;
  Object.assign(editForm, { name: project.name, status: project.status });
  editDialogVisible.value = true;
}

async function onSubmitEdit() {
  submitting.value = true;
  try {
    await projectsStore.updateProject(editingProject.value.id, editForm);
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadProjects();
    await projectsStore.fetchProjects();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally {
    submitting.value = false;
  }
}
</script>
