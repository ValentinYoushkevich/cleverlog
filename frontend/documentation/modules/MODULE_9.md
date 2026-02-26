# MODULE_9 — Frontend: Отчёт по проекту (Admin)

## Обзор

Страница `/reports/project` — только Work Logs, фильтры по проекту/периоду/пользователю/Task Number, таблица с разбивкой по сотрудникам, итоги, экспорт Excel. Доступна только Admin.

> **Зависимости модуля:**
> - `reportsApi` из MODULE_8 — уже реализован
> - `downloadBlob` из MODULE_8
> - `useProjectsStore` из MODULE_2

---

## Шаг 1. API пользователей (для фильтра)

`src/api/users.js`:

```js
import http from '@/api/http.js';

export const usersApi = {
  list: (params) => http.get('/users', { params }),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.patch(`/users/${id}`, data),
  resendInvite: (id) => http.post(`/users/${id}/resend-invite`),
};
```

---

## Шаг 2. ProjectReportPage

`src/pages/reports/ProjectReportPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отчёт по проекту</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        @click="doExport"
        :disabled="!rows.length"
      />
    </div>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.project_id"
          :options="projectsStore.projects"
          optionLabel="name"
          optionValue="id"
          placeholder="Все проекты"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.user_id"
          :options="users"
          optionLabel="fullName"
          optionValue="id"
          placeholder="Все сотрудники"
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
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Применить" icon="pi pi-search" size="small" @click="loadReport" />
        <Button label="Сбросить" severity="secondary" size="small" @click="resetFilters" />
      </div>
    </div>

    <!-- Итоги по пользователям -->
    <div v-if="totals?.by_user && Object.keys(totals.by_user).length" class="bg-surface-0 rounded-xl border border-surface-200 p-4">
      <h3 class="font-medium text-surface-700 mb-3">Итоги по сотрудникам</h3>
      <div class="flex flex-wrap gap-2 mb-3">
        <div
          v-for="(hours, name) in totals.by_user"
          :key="name"
          class="px-3 py-1.5 bg-primary-50 rounded-lg text-sm"
        >
          <span class="font-medium text-primary">{{ name }}</span>
          <span class="text-surface-500 ml-2">{{ hours }} ч</span>
        </div>
      </div>
      <p class="text-sm text-surface-500">
        Итого по проекту: <span class="font-semibold text-surface-700">{{ totals.total_hours }} ч</span>
      </p>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="rows"
      :loading="loading"
      paginator
      :rows="50"
      :rowsPerPageOptions="[20, 50, 100]"
      sortMode="single"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="user" header="Сотрудник" sortable style="width: 180px" />
      <Column field="position" header="Должность" style="width: 150px" />
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
      <template #empty>
        <div class="text-center py-8 text-surface-400">Нет данных за выбранный период</div>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import { reportsApi } from '@/api/reports.js';
import { usersApi } from '@/api/users.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

defineOptions({ name: 'ProjectReportPage' });

const projectsStore = useProjectsStore();
const uiStore = useUiStore();

onMounted(async () => {
  uiStore.setPageTitle('Отчёт по проекту');
  const res = await usersApi.list({ status: 'active' });
  users.value = res.data.map(u => ({ ...u, fullName: `${u.last_name} ${u.first_name}` }));
  loadReport();
});

const users = ref([]);

const filters = reactive({
  project_id: null,
  user_id: null,
  task_number: '',
  dateRange: [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()],
});

const rows = ref([]);
const totals = ref(null);
const loading = ref(false);
const exporting = ref(false);

function buildParams() {
  const params = {};
  if (filters.project_id) params.project_id = filters.project_id;
  if (filters.user_id) params.user_id = filters.user_id;
  if (filters.task_number) params.task_number = filters.task_number;
  if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
  if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
  return params;
}

async function loadReport() {
  loading.value = true;
  try {
    const res = await reportsApi.projectReport(buildParams());
    rows.value = res.data.rows ?? [];
    totals.value = res.data.totals ?? null;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    project_id: null, user_id: null, task_number: '',
    dateRange: [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()],
  });
  loadReport();
}

async function doExport() {
  exporting.value = true;
  try {
    const res = await reportsApi.exportProject(buildParams());
    downloadBlob(res.data, 'report_project.xlsx');
  } finally {
    exporting.value = false;
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Страница доступна только Admin | User → редирект (в MODULE_20) |
| 2 | Данные загружаются | Таблица заполнена строками с Work Logs |
| 3 | Отсутствия не отображаются | В таблице нет записей vacation/sick_leave/day_off |
| 4 | Фильтр по проекту | Выбрать проект → только его логи |
| 5 | Фильтр по сотруднику | Выбрать пользователя → только его строки |
| 6 | Итоги по сотрудникам | Панель показывает суммы часов по каждому |
| 7 | Итого по проекту | Общая сумма часов под панелью сотрудников |
| 8 | Экспорт Excel | Скачивается `report_project.xlsx` с колонкой «Должность» |
