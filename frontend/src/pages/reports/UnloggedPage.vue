<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Незаполнившие дни</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        :disabled="!users.length"
        @click="doExport"
      />
    </div>

    <!-- Выбор месяца -->
    <div class="flex items-center gap-4 rounded-xl border border-surface-200 bg-surface-0 p-4">
      <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
      <span class="min-w-36 text-center text-base font-semibold capitalize text-surface-700">
        {{ monthLabel }}
      </span>
      <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
      <div
        v-if="!loading"
        class="ml-4 rounded-lg px-3 py-1.5 text-sm"
        :class="summaryBadgeClass"
      >
        {{ summaryBadgeText }}
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      v-model:expandedRows="expandedRows"
      :value="users"
      :loading="loading"
      paginator
      :rows="20"
      stripedRows
      expandable
      class="overflow-hidden rounded-xl border border-surface-200"
    >
      <Column expander style="width: 3rem" />
      <Column field="user_name" header="Сотрудник" sortable style="min-width: 160px" />
      <Column field="unlogged_count" header="Незаполнено дней" sortable style="width: 200px">
        <template #body="{ data }">
          <span class="font-semibold text-orange-600">{{ data.unlogged_count }}</span>
        </template>
      </Column>
      <Column field="fact_hours" header="Факт (ч)" sortable style="width: 200px">
        <template #body="{ data }">{{ data.fact_hours }} ч</template>
      </Column>
      <Column field="last_log_date" header="Последний лог" style="width: 200px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400">{{ data.last_log_date ?? 'Нет логов' }}</span>
        </template>
      </Column>

      <template #expansion="{ data }">
        <div class="bg-orange-50 p-3">
          <p class="mb-2 text-sm font-medium text-surface-700">Незаполненные даты:</p>
          <div class="flex flex-wrap gap-1.5">
            <Tag
              v-for="date in data.unlogged_dates"
              :key="date"
              :value="date"
              severity="warn"
              class="text-xs"
            />
          </div>
        </div>
      </template>

      <template #empty>
        <div class="py-8 text-center font-medium text-green-600">
          <i class="pi pi-check-circle mb-2 block text-2xl" />
          Все сотрудники заполнили рабочее время за выбранный месяц
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { storeToRefs } from 'pinia';

import { useReportsStore } from '@/stores/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

dayjs.locale('ru');
defineOptions({ name: 'UnloggedPage' });

const uiStore = useUiStore();
const reportsStore = useReportsStore();
const {
  unloggedUsers: users,
  unloggedLoading: loading,
  unloggedExporting: exporting,
} = storeToRefs(reportsStore);

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);
const expandedRows = ref([]);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY')
);
const summaryBadgeClass = computed(() =>
  (users.value?.length ?? 0) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
);
const summaryBadgeText = computed(() => {
  const count = users.value?.length ?? 0;
  return count > 0 ? `${count} сотрудников с незаполненными днями` : 'Все дни заполнены ✓';
});

onMounted(() => {
  uiStore.setPageTitle('Незаполнившие дни');
  loadReport();
});

function loadReport() {
  reportsStore.fetchUnlogged({ year: currentYear.value, month: currentMonth.value });
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
  const blob = await reportsStore.exportUnlogged({
    year: currentYear.value,
    month: currentMonth.value,
  });
  if (blob) {
    downloadBlob(blob, `unlogged_${currentYear.value}_${currentMonth.value}.xlsx`);
  }
}
</script>
