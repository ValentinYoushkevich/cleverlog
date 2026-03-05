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
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <Button icon="pi pi-pencil" text rounded size="small" @click="openEditDialog(data)" />
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Проекты не найдены</div>
      </template>
    </DataTable>

    <!-- Dialog: создание -->
    <Dialog v-model:visible="createDialogVisible" header="Новый проект" modal class="w-full max-w-sm">
      <form @submit.prevent="onSubmitCreate" class="space-y-4">
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
      <form @submit.prevent="onSubmitEdit" class="space-y-4">
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
  </div>
</template>

<script setup>
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_OPTIONS, PROJECT_STATUS_SEVERITY } from '@/constants/projects.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

defineOptions({ name: 'ProjectsPage' });

const toast = useToast();
const projectsStore = useProjectsStore();
const uiStore = useUiStore();
const { projects, loading } = storeToRefs(projectsStore);

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
