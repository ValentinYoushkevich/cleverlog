# MODULE_10 — Frontend: Свод по месяцу (Admin)

## Обзор

Страница `/reports/monthly-summary` — сводная таблица: строки = сотрудники, колонки = проекты + Absence + Факт. Frozen первая колонка (сотрудник), итоговая строка TOTAL внизу, цветовая подсветка строк (зелёный = норма, жёлтый = отклонение). Экспорт Excel.

> **Зависимости модуля:**
> - `reportsApi` из MODULE_8 — `monthlySummary`, `exportMonthlySummary`
> - `downloadBlob` из MODULE_8

---

## Шаг 1. MonthlySummaryPage

`src/pages/reports/MonthlySummaryPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Свод по месяцу</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        @click="doExport"
        :disabled="!rows.length"
      />
    </div>

    <!-- Выбор месяца -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200 flex items-center gap-4">
      <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
      <span class="text-lg font-semibold text-surface-800 min-w-40 text-center capitalize">
        {{ monthLabel }}
      </span>
      <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
      <div class="ml-4 px-3 py-1.5 bg-surface-100 rounded-lg text-sm text-surface-600">
        Норма: <span class="font-semibold">{{ norm }} ч</span>
      </div>
    </div>

    <!-- Легенда -->
    <div class="flex gap-4 text-xs text-surface-500">
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-100 block" />Факт = Норма</div>
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-yellow-100 block" />Отклонение</div>
    </div>

    <!-- Таблица -->
    <div class="border border-surface-200 rounded-xl overflow-hidden">
      <DataTable
        :value="tableRows"
        :loading="loading"
        scrollable
        scrollHeight="600px"
        stripedRows
        :rowClass="getRowClass"
      >
        <!-- Frozen: сотрудник -->
        <Column field="user_name" header="Сотрудник" frozen style="min-width: 180px; font-weight: 500;" />

        <!-- Динамические колонки: проекты -->
        <Column
          v-for="proj in projects"
          :key="proj.id"
          :field="`proj_${proj.id}`"
          :header="proj.name"
          style="min-width: 120px; text-align: right;"
        >
          <template #body="{ data }">
            <span :class="data[`proj_${proj.id}`] > 0 ? 'text-surface-800' : 'text-surface-300'">
              {{ data[`proj_${proj.id}`] > 0 ? data[`proj_${proj.id}`] + ' ч' : '—' }}
            </span>
          </template>
        </Column>

        <!-- Absence -->
        <Column field="absence_hours" header="Отсутствие (ч)" style="min-width: 140px; text-align: right;">
          <template #body="{ data }">
            <span :class="data.absence_hours > 0 ? 'text-blue-600' : 'text-surface-300'">
              {{ data.absence_hours > 0 ? data.absence_hours + ' ч' : '—' }}
            </span>
          </template>
        </Column>

        <!-- Факт -->
        <Column field="fact_hours" header="Факт (ч)" style="min-width: 100px; text-align: right; font-weight: 600;">
          <template #body="{ data }">
            <span :class="data.is_total ? 'text-surface-800' : (data.is_on_norm ? 'text-green-700' : 'text-yellow-700')">
              {{ data.fact_hours }} ч
            </span>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-8 text-surface-400">Нет данных за выбранный месяц</div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import { reportsApi } from '@/api/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

dayjs.locale('ru');
defineOptions({ name: 'MonthlySummaryPage' });

const uiStore = useUiStore();

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);
const rows = ref([]);
const projects = ref([]);
const totals = ref(null);
const norm = ref(168);
const loading = ref(false);
const exporting = ref(false);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY')
);

onMounted(() => {
  uiStore.setPageTitle('Свод по месяцу');
  loadReport();
});

async function loadReport() {
  loading.value = true;
  try {
    const res = await reportsApi.monthlySummary({ year: currentYear.value, month: currentMonth.value });
    rows.value = res.data.rows ?? [];
    projects.value = res.data.projects ?? [];
    totals.value = res.data.totals ?? null;
    norm.value = res.data.norm ?? 168;
  } finally {
    loading.value = false;
  }
}

// Строки таблицы: обычные + TOTAL внизу
const tableRows = computed(() => {
  if (!rows.value.length) return [];

  const dataRows = rows.value.map(r => {
    const row = {
      user_name: r.user_name,
      absence_hours: r.absence_hours,
      fact_hours: r.fact_hours,
      is_on_norm: r.is_on_norm,
      is_total: false,
    };
    for (const proj of projects.value) {
      row[`proj_${proj.id}`] = r.by_project[proj.id] ?? 0;
    }
    return row;
  });

  // Итоговая строка TOTAL
  if (totals.value) {
    const totalRow = {
      user_name: 'TOTAL',
      absence_hours: totals.value.absence_hours,
      fact_hours: totals.value.fact_hours,
      is_on_norm: true,
      is_total: true,
    };
    for (const proj of projects.value) {
      totalRow[`proj_${proj.id}`] = totals.value.by_project[proj.id] ?? 0;
    }
    dataRows.push(totalRow);
  }

  return dataRows;
});

// Цвет строки
function getRowClass(row) {
  if (row.is_total) return 'font-bold bg-surface-50';
  if (row.is_on_norm) return 'bg-green-50';
  return 'bg-yellow-50';
}

function prevMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).subtract(1, 'month');
  currentYear.value = d.year();
  currentMonth.value = d.month() + 1;
  loadReport();
}

function nextMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).add(1, 'month');
  currentYear.value = d.year();
  currentMonth.value = d.month() + 1;
  loadReport();
}

async function doExport() {
  exporting.value = true;
  try {
    const res = await reportsApi.exportMonthlySummary({ year: currentYear.value, month: currentMonth.value });
    downloadBlob(res.data, `monthly_summary_${currentYear.value}_${currentMonth.value}.xlsx`);
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
| 1 | Страница доступна только Admin | User → редирект (MODULE_20) | ✅ выполнено |
| 2 | Таблица загружается | Строки с сотрудниками и колонками проектов | ✅ выполнено |
| 3 | Динамические колонки | Колонка на каждый проект из API | ✅ выполнено |
| 4 | Frozen первая колонка | Горизонтальный скролл → «Сотрудник» остаётся на месте | ✅ выполнено |
| 5 | Зелёная строка | Сотрудник с факт = норма → `bg-green-50` | ✅ выполнено |
| 6 | Жёлтая строка | Отклонение → `bg-yellow-50` | ✅ выполнено |
| 7 | Строка TOTAL | Последняя строка «TOTAL» жирная с суммами | ✅ выполнено |
| 8 | Норма в шапке | Отображается норма из API | ✅ выполнено |
| 9 | Навигация по месяцам | ← → меняет месяц, данные перезагружаются | ✅ выполнено |
| 10 | Экспорт Excel | Скачивается файл с цветными строками и динамическими колонками | ✅ выполнено |
