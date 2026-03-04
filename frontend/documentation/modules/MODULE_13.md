# MODULE_13 — Frontend: Управление проектами и кастомными полями (Admin)

## Обзор

Страница `/admin/projects` — CRUD проектов со статусами. Страница `/admin/custom-fields` — CRUD кастомных полей глобально и управление привязкой к проектам. Переиспользует паттерн DataTable + Dialog из предыдущих модулей.

> **Зависимости модуля:**
> - Паттерн Dialog + Toast из MODULE_12
> - `useProjectsStore` из MODULE_2 — после создания/изменения проекта вызвать `fetchProjects()` для обновления стора

---

## Шаг 1. Store projects и Store customFields

Сторы для страниц ProjectsPage и CustomFieldsPage — вызовы API в сторах, обёрнуты в try/catch.

**`src/stores/projects.js`** — дополнить (или создать, если только список): помимо `fetchProjects` добавить методы для CRUD и кастомных полей проекта:

```js
import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loading: false,
  }),

  getters: {
    activeProjects: (state) => state.projects.filter((p) => p.status === 'active'),
  },

  actions: {
    async fetchProjects(params) {
      this.loading = true;
      try {
        const res = await http.get('/projects', { params });
        this.projects = res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async create(data) {
      try {
        await http.post('/projects', data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async update(id, data) {
      try {
        await http.patch(`/projects/${id}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getProjectFields(projectId) {
      try {
        const res = await http.get(`/projects/${projectId}/custom-fields`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async attachField(projectId, data) {
      try {
        await http.post(`/projects/${projectId}/custom-fields`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateProjectField(projectId, fieldId, data) {
      try {
        await http.patch(`/projects/${projectId}/custom-fields/${fieldId}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async detachField(projectId, fieldId) {
      try {
        await http.delete(`/projects/${projectId}/custom-fields/${fieldId}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
```

**`src/stores/customFields.js`** — стор для страницы CustomFieldsPage:

```js
import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useCustomFieldsStore = defineStore('customFields', {
  state: () => ({
    fields: [],
    loading: false,
  }),

  actions: {
    async fetchList(params = {}) {
      this.loading = true;
      try {
        const res = await http.get('/custom-fields', { params });
        this.fields = res.data ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async create(data) {
      try {
        await http.post('/custom-fields', data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async update(id, data) {
      try {
        await http.patch(`/custom-fields/${id}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async softDelete(id) {
      try {
        await http.delete(`/custom-fields/${id}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async restore(id) {
      try {
        await http.post(`/custom-fields/${id}/restore`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getProjectFields(projectId) {
      try {
        const res = await http.get(`/projects/${projectId}/custom-fields`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getOptions(id) {
      try {
        const res = await http.get(`/custom-fields/${id}/options`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async addOption(id, data) {
      try {
        await http.post(`/custom-fields/${id}/options`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async deprecateOption(id, optionId) {
      try {
        await http.delete(`/custom-fields/${id}/options/${optionId}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
```

---

## Шаг 2. Константы проектов

`src/constants/projects.js`:

```js
export const PROJECT_STATUS_OPTIONS = [
  { value: 'active', label: 'Активный' },
  { value: 'on_hold', label: 'На паузе' },
  { value: 'closed', label: 'Закрыт' },
];

export const PROJECT_STATUS_SEVERITY = {
  active: 'success',
  on_hold: 'warn',
  closed: 'danger',
};

export const PROJECT_STATUS_LABEL = {
  active: 'Активный',
  on_hold: 'На паузе',
  closed: 'Закрыт',
};

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'dropdown', label: 'Список' },
  { value: 'checkbox', label: 'Флажок' },
];
```

---

## Шаг 3. ProjectsPage

`src/pages/admin/ProjectsPage.vue`:

```vue
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
        :key="opt.value"
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
          <label class="block text-sm font-medium text-surface-700 mb-1">Название *</label>
          <InputText v-model="createForm.name" class="w-full" :class="{ 'p-invalid': createErrors.name }" />
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
          <label class="block text-sm font-medium text-surface-700 mb-1">Название *</label>
          <InputText v-model="editForm.name" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Статус</label>
          <Select v-model="editForm.status" :options="PROJECT_STATUS_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
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
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_LABEL, PROJECT_STATUS_SEVERITY } from '@/constants/projects.js';

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
    await projectsStore.create({ name: createForm.name });
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
    await projectsStore.update(editingProject.value.id, editForm);
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
```

---

## Шаг 4. CustomFieldsPage

`src/pages/admin/CustomFieldsPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Кастомные поля</h1>
      <div class="flex gap-2">
        <Button
          :label="showDeleted ? 'Скрыть удалённые' : 'Показать удалённые'"
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
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="name" header="Название" sortable />
      <Column field="type" header="Тип" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="TYPE_LABEL[data.type]" severity="secondary" />
        </template>
      </Column>
      <Column field="is_deleted" header="Статус" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="data.is_deleted ? 'Удалено' : 'Активно'" :severity="data.is_deleted ? 'danger' : 'success'" />
        </template>
      </Column>
      <Column header="" style="width: 120px">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button icon="pi pi-pencil" text rounded size="small" @click="openEditDialog(data)" :disabled="data.is_deleted" />
            <Button
              v-if="!data.is_deleted"
              icon="pi pi-trash" text rounded size="small" severity="danger"
              @click="softDelete(data)"
            />
            <Button
              v-else
              icon="pi pi-refresh" text rounded size="small" severity="secondary"
              v-tooltip="'Восстановить'"
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
      <form @submit.prevent="onSubmitCreate" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Название *</label>
          <InputText v-model="createForm.name" class="w-full" :class="{ 'p-invalid': createErrors.name }" />
          <small v-if="createErrors.name" class="p-error">{{ createErrors.name }}</small>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Тип *</label>
          <Select v-model="createForm.type" :options="CUSTOM_FIELD_TYPES" optionLabel="label" optionValue="value" class="w-full" />
        </div>

        <!-- Опции для dropdown -->
        <div v-if="createForm.type === 'dropdown'">
          <label class="block text-sm font-medium text-surface-700 mb-1">Варианты</label>
          <div v-for="(opt, i) in createForm.options" :key="i" class="flex gap-2 mb-2">
            <InputText v-model="createForm.options[i]" class="flex-1" :placeholder="`Вариант ${i + 1}`" />
            <Button icon="pi pi-times" text rounded severity="danger" @click="createForm.options.splice(i, 1)" />
          </div>
          <Button label="Добавить вариант" icon="pi pi-plus" text size="small" @click="createForm.options.push('')" />
        </div>

        <div class="flex justify-end gap-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: редактирование (только название) -->
    <Dialog v-model:visible="editDialogVisible" header="Редактировать поле" modal class="w-full max-w-sm">
      <form @submit.prevent="onSubmitEdit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Название</label>
          <InputText v-model="editForm.name" class="w-full" />
        </div>
        <Message severity="info" :closable="false" class="text-xs">
          Тип поля изменить нельзя после создания
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
import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { useCustomFieldsStore } from '@/stores/customFields.js';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';
import { CUSTOM_FIELD_TYPES } from '@/constants/projects.js';

defineOptions({ name: 'CustomFieldsPage' });

const toast = useToast();
const uiStore = useUiStore();
const customFieldsStore = useCustomFieldsStore();
const { fields, loading } = storeToRefs(customFieldsStore);

const TYPE_LABEL = { text: 'Текст', number: 'Число', dropdown: 'Список', checkbox: 'Флажок' };

onMounted(() => { uiStore.setPageTitle('Кастомные поля'); loadFields(); });

const submitting = ref(false);
const showDeleted = ref(false);

function loadFields() {
  customFieldsStore.fetchList(showDeleted.value ? { include_deleted: true } : {});
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
    if (createForm.type === 'dropdown') payload.options = createForm.options.filter(o => o.trim());
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

function openEditDialog(field) {
  editingField.value = field;
  editForm.name = field.name;
  editDialogVisible.value = true;
}

async function onSubmitEdit() {
  submitting.value = true;
  try {
    await customFieldsStore.update(editingField.value.id, { name: editForm.name });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadFields();
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally { submitting.value = false; }
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
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | ProjectsPage: список загружается | Все проекты видны в таблице |
| 2 | Фильтр по статусу | Кнопки «Активный / На паузе / Закрыт» фильтруют таблицу |
| 3 | Создание проекта | Заполнить имя → «Создать» → проект в таблице + обновился стор |
| 4 | Редактирование статуса | Active → On Hold → Tag обновился |
| 5 | CustomFieldsPage: список | Поля с типами отображаются |
| 6 | Создание text-поля | Заполнить имя + тип → создаётся |
| 7 | Создание dropdown с вариантами | Добавить 3 варианта → созданы в БД |
| 8 | Тип нельзя изменить | При редактировании — только поле имени, Message-подсказка |
| 9 | Soft delete | Кнопка корзины → поле показывает «Удалено», при `showDeleted=false` — скрыто |
| 10 | Restore | «Показать удалённые» → кнопка восстановить → поле снова «Активно» |
