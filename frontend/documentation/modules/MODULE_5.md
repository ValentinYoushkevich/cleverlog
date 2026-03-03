# MODULE_5 — Frontend: Work Logs

## Обзор

Страница `/work-logs` — список рабочих логов с фильтрами, форма создания и редактирование через Dialog. Парсинг длительности (`1h 30m`, `2d`, `45m`) — в composable. Предупреждение при >12h/день через Toast. Динамические кастомные поля проекта в форме.

> **Зависимости модуля:**
> - `useProjectsStore` из MODULE_2 — список активных проектов
> - `useCalendarStore` из MODULE_2 — `isClosed` для блокировки действий
> - `useAuthStore` из MODULE_2 — `isAdmin`

---

## Шаг 1. API

`src/api/workLogs.js`:

```js
import http from '@/api/http.js';

export const workLogsApi = {
  list: (params) => http.get('/work-logs', { params }),
  create: (data) => http.post('/work-logs', data),
  update: (id, data) => http.patch(`/work-logs/${id}`, data),
  remove: (id) => http.delete(`/work-logs/${id}`),
};
```

`src/api/customFields.js`:

```js
import http from '@/api/http.js';

export const customFieldsApi = {
  getProjectFields: (projectId) => http.get(`/projects/${projectId}/custom-fields`),
};
```

---

## Шаг 2. Composable: парсинг длительности

`src/composables/useDuration.js`:

```js
/**
 * Парсит строку длительности в часы для отображения.
 * "1h 30m" → 1.5, "2d" → 16, "45m" → 0.75
 * Возвращает null если формат неверный.
 */
export function parseDurationToHours(input) {
  if (!input?.trim()) return null;
  const str = input.trim().toLowerCase();
  const d = str.match(/(\d+(?:\.\d+)?)\s*d/)?.[1] ?? 0;
  const h = str.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0;
  const m = str.match(/(\d+(?:\.\d+)?)\s*m/)?.[1] ?? 0;
  if (!+d && !+h && !+m) return null;
  return parseFloat(d) * 8 + parseFloat(h) + parseFloat(m) / 60;
}

export function formatDuration(hours) {
  if (!hours) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
```

---

## Шаг 3. Composable: форма Work Log

`src/composables/useWorkLogForm.js`:

```js
import { ref, watch } from 'vue';
import { customFieldsApi } from '@/api/customFields.js';

export function useWorkLogForm() {
  const projectFields = ref([]);
  const loadingFields = ref(false);

  async function loadProjectFields(projectId) {
    if (!projectId) { projectFields.value = []; return; }
    loadingFields.value = true;
    try {
      const res = await customFieldsApi.getProjectFields(projectId);
      projectFields.value = res.data.filter(f => f.is_enabled);
    } finally {
      loadingFields.value = false;
    }
  }

  return { projectFields, loadingFields, loadProjectFields };
}
```

---

## Шаг 4. WorkLogsPage

`src/pages/WorkLogsPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <!-- Шапка -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Рабочие логи</h1>
      <Button
        label="Добавить лог"
        icon="pi pi-plus"
        @click="openCreateDialog"
        :disabled="isClosed && !isAdmin"
      />
    </div>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.project_id"
          :options="projectsStore.activeProjects"
          optionLabel="name"
          optionValue="id"
          placeholder="Все проекты"
          showClear
          class="w-full"
        />
        <DatePicker
          v-model="filters.dateRange"
          selectionMode="range"
          placeholder="Период"
          class="w-full"
          showIcon
        />
        <InputText
          v-model="filters.task_number"
          placeholder="Task Number"
          class="w-full"
        />
        <InputText
          v-model="filters.comment"
          placeholder="Поиск по комментарию"
          class="w-full"
        />
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Найти" icon="pi pi-search" size="small" @click="loadLogs" />
        <Button label="Сбросить" icon="pi pi-times" size="small" severity="secondary" @click="resetFilters" />
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="logs"
      :loading="loading"
      paginator
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      sortMode="single"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="date" header="Дата" sortable style="width: 120px" />
      <Column field="project_name" header="Проект" sortable />
      <Column field="task_number" header="Task Number" style="width: 140px" />
      <Column field="duration_hours" header="Длительность (ч)" sortable style="width: 160px">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
      </Column>
      <Column field="comment" header="Комментарий">
        <template #body="{ data }">
          <span class="truncate max-w-xs block" :title="data.comment">{{ data.comment }}</span>
        </template>
      </Column>
      <Column header="" style="width: 100px">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button
              icon="pi pi-pencil"
              text rounded size="small"
              @click="openEditDialog(data)"
              :disabled="isClosed && !isAdmin"
            />
            <Button
              icon="pi pi-trash"
              text rounded size="small"
              severity="danger"
              @click="confirmDelete(data)"
              :disabled="isClosed && !isAdmin"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Логи не найдены</div>
      </template>
    </DataTable>

    <!-- Dialog: создание/редактирование -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="editingLog ? 'Редактировать лог' : 'Новый лог'"
      modal
      class="w-full max-w-lg"
    >
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Дата *</label>
          <DatePicker
            v-model="form.date"
            :maxDate="today"
            class="w-full"
            :class="{ 'p-invalid': formErrors.date }"
            dateFormat="yy-mm-dd"
          />
          <small v-if="formErrors.date" class="p-error">{{ formErrors.date }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Проект *</label>
          <Select
            v-model="form.project_id"
            :options="projectsStore.activeProjects"
            optionLabel="name"
            optionValue="id"
            placeholder="Выберите проект"
            class="w-full"
            :class="{ 'p-invalid': formErrors.project_id }"
            @change="onProjectChange"
          />
          <small v-if="formErrors.project_id" class="p-error">{{ formErrors.project_id }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">
            Длительность * <span class="text-surface-400 font-normal">(например: 1h 30m, 2d, 45m)</span>
          </label>
          <InputText
            v-model="form.duration"
            placeholder="1h 30m"
            class="w-full"
            :class="{ 'p-invalid': formErrors.duration }"
          />
          <small v-if="formErrors.duration" class="p-error">{{ formErrors.duration }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Task Number *</label>
          <InputText
            v-model="form.task_number"
            placeholder="TASK-123"
            class="w-full"
            :class="{ 'p-invalid': formErrors.task_number }"
          />
          <small v-if="formErrors.task_number" class="p-error">{{ formErrors.task_number }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Комментарий *</label>
          <Textarea
            v-model="form.comment"
            rows="3"
            class="w-full"
            :class="{ 'p-invalid': formErrors.comment }"
            placeholder="Что было сделано..."
          />
          <small v-if="formErrors.comment" class="p-error">{{ formErrors.comment }}</small>
        </div>

        <!-- Кастомные поля -->
        <template v-if="projectFields.length">
          <Divider />
          <div v-for="field in projectFields" :key="field.custom_field_id" class="space-y-1">
            <label class="block text-sm font-medium text-surface-700">
              {{ field.name }}
              <span v-if="field.is_required" class="text-red-500 ml-0.5">*</span>
            </label>

            <InputText
              v-if="field.type === 'text'"
              v-model="form.custom_fields[field.custom_field_id]"
              class="w-full"
            />
            <InputNumber
              v-else-if="field.type === 'number'"
              v-model="form.custom_fields[field.custom_field_id]"
              class="w-full"
            />
            <Select
              v-else-if="field.type === 'dropdown'"
              v-model="form.custom_fields[field.custom_field_id]"
              :options="field.options?.filter(o => !o.is_deprecated)"
              optionLabel="label"
              optionValue="label"
              class="w-full"
            />
            <Checkbox
              v-else-if="field.type === 'checkbox'"
              v-model="form.custom_fields[field.custom_field_id]"
              :binary="true"
            />
          </div>
        </template>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="dialogVisible = false" />
          <Button type="submit" :label="editingLog ? 'Сохранить' : 'Создать'" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- ConfirmDialog для удаления -->
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import dayjs from 'dayjs';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Divider from 'primevue/divider';
import ConfirmDialog from 'primevue/confirmdialog';
import { workLogsApi } from '@/api/workLogs.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { useWorkLogForm } from '@/composables/useWorkLogForm.js';

defineOptions({ name: 'WorkLogsPage' });

const confirm = useConfirm();
const toast = useToast();
const projectsStore = useProjectsStore();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Рабочие логи');
  loadLogs();
});

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);
const today = new Date();

// --- Список ---
const logs = ref([]);
const loading = ref(false);
const filters = reactive({ project_id: null, dateRange: null, task_number: '', comment: '' });

async function loadLogs() {
  loading.value = true;
  try {
    const params = {};
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.task_number) params.task_number = filters.task_number;
    if (filters.comment) params.comment = filters.comment;
    if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
    if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
    const res = await workLogsApi.list(params);
    logs.value = res.data.data ?? res.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { project_id: null, dateRange: null, task_number: '', comment: '' });
  loadLogs();
}

// --- Форма ---
const dialogVisible = ref(false);
const editingLog = ref(null);
const submitting = ref(false);
const formErrors = reactive({});

const form = reactive({
  date: null,
  project_id: null,
  duration: '',
  task_number: '',
  comment: '',
  custom_fields: {},
});

const { projectFields, loadProjectFields } = useWorkLogForm();

function openCreateDialog() {
  editingLog.value = null;
  Object.assign(form, { date: new Date(), project_id: null, duration: '', task_number: '', comment: '', custom_fields: {} });
  Object.keys(formErrors).forEach(k => delete formErrors[k]);
  projectFields.value = [];
  dialogVisible.value = true;
}

function openEditDialog(log) {
  editingLog.value = log;
  Object.assign(form, {
    date: new Date(log.date),
    project_id: log.project_id,
    duration: `${log.duration_hours}h`,
    task_number: log.task_number,
    comment: log.comment,
    custom_fields: {},
  });
  loadProjectFields(log.project_id);
  dialogVisible.value = true;
}

async function onProjectChange() {
  form.custom_fields = {};
  await loadProjectFields(form.project_id);
}

function validateForm() {
  Object.keys(formErrors).forEach(k => delete formErrors[k]);
  let valid = true;
  if (!form.date) { formErrors.date = 'Дата обязательна'; valid = false; }
  if (!form.project_id) { formErrors.project_id = 'Проект обязателен'; valid = false; }
  if (!form.duration?.trim()) { formErrors.duration = 'Длительность обязательна'; valid = false; }
  if (!form.task_number?.trim()) { formErrors.task_number = 'Task Number обязателен'; valid = false; }
  if (!form.comment?.trim()) { formErrors.comment = 'Комментарий обязателен'; valid = false; }
  return valid;
}

async function onSubmit() {
  if (!validateForm()) return;
  submitting.value = true;
  try {
    const payload = {
      date: dayjs(form.date).format('YYYY-MM-DD'),
      project_id: form.project_id,
      duration: form.duration,
      task_number: form.task_number,
      comment: form.comment,
      custom_fields: form.custom_fields,
    };

    let res;
    if (editingLog.value) {
      res = await workLogsApi.update(editingLog.value.id, payload);
    } else {
      res = await workLogsApi.create(payload);
    }

    // Предупреждение при >12h
    if (res.data.warning) {
      toast.add({ severity: 'warn', summary: 'Внимание', detail: res.data.warning, life: 5000 });
    }

    toast.add({ severity: 'success', summary: 'Готово', detail: editingLog.value ? 'Лог обновлён' : 'Лог создан', life: 3000 });
    dialogVisible.value = false;
    await loadLogs();
  } catch (err) {
    const msg = err.response?.data?.message ?? 'Произошла ошибка';
    toast.add({ severity: 'error', summary: 'Ошибка', detail: msg, life: 5000 });
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(log) {
  confirm.require({
    message: `Удалить лог за ${log.date}?`,
    header: 'Подтверждение',
    icon: 'pi pi-trash',
    acceptSeverity: 'danger',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await workLogsApi.remove(log.id);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
        await loadLogs();
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Страница открывается | `/work-logs` → таблица, кнопка «Добавить лог» | Прошло ✅ |
| 2 | Список загружается | Логи из БД отображаются в таблице | Прошло ✅ |
| 3 | Фильтр по проекту | Выбрать проект → только его логи | Прошло ✅ |
| 4 | Фильтр по Task Number | Ввести `TASK-1` → совпадения | Прошло ✅ |
| 5 | Создание лога | Заполнить форму → «Создать» → лог появился в таблице | Прошло ✅ |
| 6 | Длительность `1h 30m` | Создать с `1h 30m` → в таблице `1.5 ч` | Прошло ✅ |
| 7 | Предупреждение >12h | Создать логи суммарно >12h → Toast с предупреждением, лог создан | Прошло ✅ |
| 8 | Обязательные поля | Пустая форма → ошибки под всеми обязательными полями | Прошло ✅ |
| 9 | Редактирование | Клик по карандашу → Dialog с заполненными данными → сохранить | Прошло ✅ |
| 10 | Удаление | Клик по корзине → ConfirmDialog → подтвердить → лог удалён | Прошло ✅ |
| 11 | Кастомные поля | Выбрать проект с кастомными полями → поля появляются в форме | Прошло ✅ |
| 12 | Закрытый месяц | `isClosed = true`, User → кнопки добавления/редактирования disabled | Прошло ✅ |
