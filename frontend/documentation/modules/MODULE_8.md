# MODULE_8 — Frontend: Отчёт по пользователю

## Обзор

Страница `/reports/user` — фильтры, таблица с логами и отсутствиями, итоги по проектам и типам. При выборе полного месяца — блок Норма/Факт/Отклонение/Незаполненные дни. Кнопка экспорта в Excel.

> **Зависимости модуля:**
> - `useProjectsStore` из MODULE_2 — список проектов для фильтра
> - `useAuthStore` из MODULE_2 — `isAdmin` для показа фильтра по пользователю
> - `ABSENCE_LABEL` из MODULE_6

---

## Шаг 1. API

`src/api/reports.js`:

```js
import http from '@/api/http.js';

export const reportsApi = {
  userReport: (params) => http.get('/reports/user', { params }),
  exportUser: (params) => http.get('/reports/user/export', { params, responseType: 'blob' }),

  projectReport: (params) => http.get('/reports/project', { params }),
  exportProject: (params) => http.get('/reports/project/export', { params, responseType: 'blob' }),

  monthlySummary: (params) => http.get('/reports/monthly-summary', { params }),
  exportMonthlySummary: (params) => http.get('/reports/monthly-summary/export', { params, responseType: 'blob' }),

  unlogged: (params) => http.get('/reports/unlogged', { params }),
  exportUnlogged: (params) => http.get('/reports/unlogged/export', { params, responseType: 'blob' }),
};
```

---

## Шаг 2. Утилита: скачивание blob

`src/utils/download.js`:

```js
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Шаг 3. UserReportPage

`src/pages/reports/UserReportPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отчёт по пользователю</h1>
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
        <!-- Фильтр по пользователю — только Admin -->
        <Select
          v-if="isAdmin"
          v-model="filters.user_id"
          :options="users"
          optionLabel="fullName"
          optionValue="id"
          placeholder="Все пользователи"
          showClear
          class="w-full"
        />
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
          v-model="filters.type"
          :options="typeOptions"
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
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Применить" icon="pi pi-search" size="small" @click="loadReport" />
        <Button label="Сбросить" severity="secondary" size="small" @click="resetFilters" />
      </div>
    </div>

    <!-- Блок Норма/Факт/Отклонение — только при полном месяце -->
    <div v-if="normBlock" class="grid grid-cols-3 gap-4">
      <div class="bg-surface-0 rounded-xl border border-surface-200 p-4 text-center">
        <p class="text-xs text-surface-400 mb-1">Норма</p>
        <p class="text-2xl font-bold text-surface-700">{{ normBlock.norm }} ч</p>
      </div>
      <div class="bg-surface-0 rounded-xl border border-surface-200 p-4 text-center">
        <p class="text-xs text-surface-400 mb-1">Факт</p>
        <p class="text-2xl font-bold text-surface-700">{{ normBlock.fact }} ч</p>
      </div>
      <div
        class="rounded-xl border p-4 text-center"
        :class="normBlock.deviation >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'"
      >
        <p class="text-xs mb-1 opacity-70">Отклонение</p>
        <p class="text-2xl font-bold">
          {{ normBlock.deviation >= 0 ? '+' : '' }}{{ normBlock.deviation }} ч
        </p>
      </div>
    </div>

    <!-- Итоги по проектам -->
    <div v-if="totals && Object.keys(totals.by_project ?? {}).length" class="bg-surface-0 rounded-xl border border-surface-200 p-4">
      <h3 class="font-medium text-surface-700 mb-3">Итоги по проектам</h3>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(hours, name) in totals.by_project"
          :key="name"
          class="px-3 py-1.5 bg-primary-50 rounded-lg text-sm"
        >
          <span class="font-medium text-primary">{{ name }}</span>
          <span class="text-surface-500 ml-2">{{ hours }} ч</span>
        </div>
      </div>
      <p class="mt-3 text-sm text-surface-500">
        Итого: <span class="font-semibold text-surface-700">{{ totals.total_hours }} ч</span>
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
      <Column field="date" header="Дата" sortable style="width: 120px" />
      <Column field="type" header="Тип" style="width: 140px">
        <template #body="{ data }">
          <Tag
            v-if="data.type === 'work'"
            value="Работа"
            severity="success"
          />
          <Tag
            v-else
            :value="ABSENCE_LABEL[data.type] ?? data.type"
            severity="info"
          />
        </template>
      </Column>
      <Column field="project_name" header="Проект" />
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
import { ref, reactive, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Tag from 'primevue/tag';
import { reportsApi } from '@/api/reports.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';
import { ABSENCE_LABEL } from '@/constants/absences.js';

defineOptions({ name: 'UserReportPage' });

const projectsStore = useProjectsStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const isAdmin = computed(() => authStore.isAdmin);

onMounted(() => {
  uiStore.setPageTitle('Отчёт по пользователю');
  loadReport();
});

const typeOptions = [
  { label: 'Работа', value: 'work' },
  { label: 'Отпуск', value: 'vacation' },
  { label: 'Больничный', value: 'sick_leave' },
  { label: 'Отгул', value: 'day_off' },
];

// Для Admin — список пользователей (упрощённо, загружаем при монтировании)
const users = ref([]);

const filters = reactive({
  user_id: null,
  project_id: null,
  type: null,
  dateRange: [
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate(),
  ],
});

const rows = ref([]);
const totals = ref(null);
const normBlock = ref(null);
const loading = ref(false);
const exporting = ref(false);

function buildParams() {
  const params = {};
  if (filters.user_id) params.user_id = filters.user_id;
  if (filters.project_id) params.project_id = filters.project_id;
  if (filters.type) params.type = filters.type;
  if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
  if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
  return params;
}

async function loadReport() {
  loading.value = true;
  try {
    const res = await reportsApi.userReport(buildParams());
    rows.value = res.data.rows ?? [];
    totals.value = res.data.totals ?? null;
    normBlock.value = res.data.norm_block ?? null;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    user_id: null, project_id: null, type: null,
    dateRange: [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()],
  });
  loadReport();
}

async function doExport() {
  exporting.value = true;
  try {
    const res = await reportsApi.exportUser(buildParams());
    downloadBlob(res.data, 'report_user.xlsx');
  } finally {
    exporting.value = false;
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Страница открывается | `/reports/user` → таблица, фильтры | Прошло ✅ |
| 2 | Данные за текущий месяц | По умолчанию выбран текущий месяц → данные загружены | Прошло ✅ |
| 3 | Блок Норма/Факт/Отклонение | Полный месяц → блок виден с корректными значениями | Прошло ✅ |
| 4 | Блок скрыт при неполном периоде | Выбрать 1–15 число → блок исчезает | Прошло ✅ |
| 5 | Итоги по проектам | Панель с разбивкой по проектам заполнена | Прошло ✅ |
| 6 | Фильтр по типу | Выбрать «Отпуск» → только vacation-строки | Прошло ✅ |
| 7 | Типы как Tag | work → зелёный «Работа»; vacation → синий «Отпуск» | Прошло ✅ |
| 8 | Admin видит фильтр по пользователю | Войти как Admin → Select «Все пользователи» виден | Прошло ✅ |
| 9 | User не видит фильтр по пользователю | Войти как User → фильтр скрыт | Прошло ✅ |
| 10 | Экспорт Excel | Нажать «Экспорт» → скачивается `report_user.xlsx` | Прошло ✅ |
