<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Свод по месяцу</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        :disabled="!rows.length"
        @click="doExport"
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
        :value="preparedTableRows"
        :loading="loading"
        scrollable
        scrollHeight="600px"
        :rowClass="getRowClass"
        :pt="{
          bodyRow: (context) => ({ class: getRowClass(context?.data ?? context?.rowData ?? context) })
        }"
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
            <span :class="data.projectCells[proj.id].class">
              {{ data.projectCells[proj.id].text }}
            </span>
          </template>
        </Column>

        <!-- Absence -->
        <Column field="absence_hours" header="Отсутствие (ч)" style="min-width: 140px; text-align: right;">
          <template #body="{ data }">
            <span :class="data.absenceHoursClass">
              {{ data.absenceHoursText }}
            </span>
          </template>
        </Column>

        <!-- Факт -->
        <Column field="fact_hours" header="Факт (ч)" style="min-width: 100px; text-align: right; font-weight: 600;">
          <template #body="{ data }">
            <span :class="data.factHoursClass">
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
import { useReportsStore } from '@/stores/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');
defineOptions({ name: 'MonthlySummaryPage' });

const uiStore = useUiStore();
const reportsStore = useReportsStore();
const {
  monthlyRows: rows,
  monthlyProjects: projects,
  monthlyTotals: totals,
  monthlyNorm: norm,
  monthlyLoading: loading,
  monthlyExporting: exporting,
} = storeToRefs(reportsStore);

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY')
);

function getFactHoursClass(row) {
  if (row?.is_total) { return 'text-surface-800'; }
  return row?.is_on_norm ? 'text-green-700' : 'text-yellow-700';
}

onMounted(() => {
  uiStore.setPageTitle('Свод по месяцу');
  loadReport();
});

function loadReport() {
  reportsStore.fetchMonthlySummary({ year: currentYear.value, month: currentMonth.value });
}

// Строки таблицы: обычные + TOTAL внизу
const tableRows = computed(() => {
  if (!rows.value.length) { return []; }

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

const preparedTableRows = computed(() =>
  (tableRows.value ?? []).map((row) => {
    const projectCells = Object.fromEntries(
      (projects.value ?? []).map((proj) => {
        const v = row?.[`proj_${proj.id}`] ?? 0;
        return [proj.id, { class: v > 0 ? 'text-surface-800' : 'text-surface-300', text: v > 0 ? `${v} ч` : '—' }];
      })
    );

    const absenceHoursValue = row?.absence_hours ?? 0;
    const absenceHoursText = absenceHoursValue > 0 ? `${absenceHoursValue} ч` : '—';
    const absenceHoursClass = absenceHoursValue > 0 ? 'text-blue-600' : 'text-surface-300';

    return {
      ...row,
      projectCells,
      absenceHoursText,
      absenceHoursClass,
      factHoursClass: getFactHoursClass(row),
    };
  })
);

// Цвет строки (без stripedRows, чтобы не перекрывало). row может быть undefined при смене месяца/загрузке.
function getRowClass(row) {
  if (row === null) { return ''; }
  if (row.is_total) { return 'font-bold !bg-surface-100'; }
  if (row.is_on_norm) { return '!bg-green-50'; }
  return '!bg-yellow-50';
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
  const blob = await reportsStore.exportMonthlySummary({
    year: currentYear.value,
    month: currentMonth.value,
  });
  if (blob) {
    downloadBlob(blob, `monthly_summary_${currentYear.value}_${currentMonth.value}.xlsx`);
  }
}
</script>
