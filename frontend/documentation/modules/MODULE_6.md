# MODULE_6 — Frontend: Absences

## Обзор

Страница `/absences` — список отсутствий с фильтрами, форма создания диапазоном с выбором типа, Dialog с информацией о пропущенных днях после создания. Редактирование и удаление отдельных записей.

> **Зависимости модуля:**
> - `useCalendarStore` из MODULE_2 — `isClosed`
> - `useAuthStore` из MODULE_2 — `isAdmin`
> - Паттерн DataTable + Dialog из MODULE_5 — переиспользуется

---

## Шаг 1. API

`src/api/absences.js`:

```js
import http from '@/api/http.js';

export const absencesApi = {
  list: (params) => http.get('/absences', { params }),
  create: (data) => http.post('/absences', data),
  update: (id, data) => http.patch(`/absences/${id}`, data),
  remove: (id) => http.delete(`/absences/${id}`),
};
```

---

## Шаг 2. Константы типов отсутствий

`src/constants/absences.js`:

```js
export const ABSENCE_TYPES = [
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick_leave', label: 'Больничный' },
  { value: 'day_off', label: 'Отгул' },
];

export const ABSENCE_LABEL = {
  vacation: 'Отпуск',
  sick_leave: 'Больничный',
  day_off: 'Отгул',
};

export const ABSENCE_SEVERITY = {
  vacation: 'info',
  sick_leave: 'warn',
  day_off: 'secondary',
};
```

---

## Шаг 3. AbsencesPage

`src/pages/AbsencesPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <!-- Шапка -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отсутствия</h1>
      <Button
        label="Добавить отсутствие"
        icon="pi pi-plus"
        @click="openCreateDialog"
        :disabled="isClosed && !isAdmin"
      />
    </div>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="grid grid-cols-3 gap-3">
        <Select
          v-model="filters.type"
          :options="ABSENCE_TYPES"
          optionLabel="label"
          optionValue="value"
          placeholder="Все типы"
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
        <div class="flex gap-2">
          <Button label="Найти" icon="pi pi-search" @click="loadAbsences" class="flex-1" />
          <Button label="Сбросить" severity="secondary" @click="resetFilters" class="flex-1" />
        </div>
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="absences"
      :loading="loading"
      paginator
      :rows="20"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="date" header="Дата" sortable style="width: 130px" />
      <Column field="type" header="Тип" style="width: 140px">
        <template #body="{ data }">
          <Tag
            :value="ABSENCE_LABEL[data.type]"
            :severity="ABSENCE_SEVERITY[data.type]"
          />
        </template>
      </Column>
      <Column field="duration_hours" header="Длительность (ч)" style="width: 160px">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
      </Column>
      <Column field="comment" header="Комментарий" />
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
        <div class="text-center py-8 text-surface-400">Записи не найдены</div>
      </template>
    </DataTable>

    <!-- Dialog: создание -->
    <Dialog
      v-model:visible="createDialogVisible"
      header="Добавить отсутствие"
      modal
      class="w-full max-w-md"
    >
      <form @submit.prevent="onSubmitCreate" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Тип *</label>
          <Select
            v-model="createForm.type"
            :options="ABSENCE_TYPES"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите тип"
            class="w-full"
            :class="{ 'p-invalid': createErrors.type }"
          />
          <small v-if="createErrors.type" class="p-error">{{ createErrors.type }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Период *</label>
          <DatePicker
            v-model="createForm.dateRange"
            selectionMode="range"
            class="w-full"
            :class="{ 'p-invalid': createErrors.dateRange }"
            placeholder="Выберите даты"
            showIcon
          />
          <small v-if="createErrors.dateRange" class="p-error">{{ createErrors.dateRange }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Комментарий</label>
          <Textarea v-model="createForm.comment" rows="2" class="w-full" placeholder="Необязательно" />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: результат создания (пропущенные дни) -->
    <Dialog
      v-model:visible="resultDialogVisible"
      header="Результат создания"
      modal
      class="w-full max-w-md"
    >
      <div class="space-y-3">
        <Message severity="success" :closable="false">
          Создано записей: {{ createResult.created?.length ?? 0 }}
        </Message>

        <div v-if="createResult.skipped?.work_logs?.length">
          <p class="text-sm font-medium text-surface-700 mb-1">Пропущены (есть рабочий лог):</p>
          <div class="flex flex-wrap gap-1">
            <Tag
              v-for="d in createResult.skipped.work_logs"
              :key="d"
              :value="d"
              severity="warn"
            />
          </div>
        </div>

        <div v-if="createResult.skipped?.weekends?.length">
          <p class="text-sm font-medium text-surface-700 mb-1">Пропущены (выходные):</p>
          <div class="flex flex-wrap gap-1">
            <Tag
              v-for="d in createResult.skipped.weekends"
              :key="d"
              :value="d"
              severity="secondary"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Закрыть" @click="resultDialogVisible = false" />
      </template>
    </Dialog>

    <!-- Dialog: редактирование -->
    <Dialog
      v-model:visible="editDialogVisible"
      header="Редактировать отсутствие"
      modal
      class="w-full max-w-md"
    >
      <form @submit.prevent="onSubmitEdit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Тип</label>
          <Select
            v-model="editForm.type"
            :options="ABSENCE_TYPES"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Дата</label>
          <DatePicker v-model="editForm.date" class="w-full" dateFormat="dd.mm.yy" showIcon />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">
            Длительность <span class="text-surface-400 font-normal">(например: 4h, 0.5d)</span>
          </label>
          <InputText v-model="editForm.duration" class="w-full" placeholder="1d" />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Комментарий</label>
          <Textarea v-model="editForm.comment" rows="2" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="editDialogVisible = false" />
          <Button type="submit" label="Сохранить" :loading="submitting" />
        </div>
      </form>
    </Dialog>

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
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import ConfirmDialog from 'primevue/confirmdialog';
import { absencesApi } from '@/api/absences.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { ABSENCE_TYPES, ABSENCE_LABEL, ABSENCE_SEVERITY } from '@/constants/absences.js';

defineOptions({ name: 'AbsencesPage' });

const confirm = useConfirm();
const toast = useToast();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Отсутствия');
  loadAbsences();
});

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);

// --- Список ---
const absences = ref([]);
const loading = ref(false);
const filters = reactive({ type: null, dateRange: null });

async function loadAbsences() {
  loading.value = true;
  try {
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
    if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
    const res = await absencesApi.list(params);
    absences.value = res.data.data ?? res.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { type: null, dateRange: null });
  loadAbsences();
}

// --- Создание ---
const createDialogVisible = ref(false);
const createForm = reactive({ type: null, dateRange: null, comment: '' });
const createErrors = reactive({});
const submitting = ref(false);

const createResult = ref({ created: [], skipped: {} });
const resultDialogVisible = ref(false);

function openCreateDialog() {
  Object.assign(createForm, { type: null, dateRange: null, comment: '' });
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  if (!createForm.type) { createErrors.type = 'Выберите тип'; return; }
  if (!createForm.dateRange?.[0]) { createErrors.dateRange = 'Выберите период'; return; }

  submitting.value = true;
  try {
    const res = await absencesApi.create({
      type: createForm.type,
      date_from: dayjs(createForm.dateRange[0]).format('YYYY-MM-DD'),
      date_to: dayjs(createForm.dateRange[1] ?? createForm.dateRange[0]).format('YYYY-MM-DD'),
      comment: createForm.comment || undefined,
    });
    createDialogVisible.value = false;
    createResult.value = res.data;
    resultDialogVisible.value = true;
    await loadAbsences();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: err.response?.data?.message ?? 'Ошибка создания', life: 5000 });
  } finally {
    submitting.value = false;
  }
}

// --- Редактирование ---
const editDialogVisible = ref(false);
const editingAbsence = ref(null);
const editForm = reactive({ type: null, date: null, duration: '', comment: '' });

function openEditDialog(absence) {
  editingAbsence.value = absence;
  Object.assign(editForm, {
    type: absence.type,
    date: new Date(absence.date),
    duration: `${absence.duration_hours}h`,
    comment: absence.comment ?? '',
  });
  editDialogVisible.value = true;
}

async function onSubmitEdit() {
  submitting.value = true;
  try {
    await absencesApi.update(editingAbsence.value.id, {
      type: editForm.type,
      date: dayjs(editForm.date).format('YYYY-MM-DD'),
      duration: editForm.duration || undefined,
      comment: editForm.comment || undefined,
    });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadAbsences();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: err.response?.data?.message ?? 'Ошибка сохранения', life: 5000 });
  } finally {
    submitting.value = false;
  }
}

// --- Удаление ---
function confirmDelete(absence) {
  confirm.require({
    message: `Удалить запись об отсутствии за ${absence.date}?`,
    header: 'Подтверждение',
    icon: 'pi pi-trash',
    acceptSeverity: 'danger',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await absencesApi.remove(absence.id);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
        await loadAbsences();
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
| 1 | Страница открывается | `/absences` → таблица без ошибок | Прошло ✅ |
| 2 | Список загружается | Записи из БД отображаются с типами | Прошло ✅ |
| 3 | Тип отображается как Tag | `vacation` → синий Tag «Отпуск» | Прошло ✅ |
| 4 | Фильтр по типу | Выбрать «Больничный» → только sick_leave | Прошло ✅ |
| 5 | Создание диапазоном | Выбрать пн–пт → создаётся 5 записей | Прошло ✅ |
| 6 | Диалог пропущенных дней | Диапазон с выходными → resultDialog показывает пропущенные даты | Прошло ✅ |
| 7 | Пропуск дней с Work Log | Диапазон включает день с Work Log → он в `skipped.work_logs` | Прошло ✅ |
| 8 | Редактирование | Изменить тип → сохранить → обновилось в таблице | Прошло ✅ |
| 9 | Запрет переноса на выходной | Редактировать дату → выходной → Toast с ошибкой | Прошло ✅ |
| 10 | Удаление через ConfirmDialog | Подтвердить → запись удалена | Прошло ✅ |
| 11 | Закрытый месяц | `isClosed = true`, User → кнопки disabled | Прошло ✅ |
