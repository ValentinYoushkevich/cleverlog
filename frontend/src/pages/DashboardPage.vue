<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Дашборд</h1>

      <!-- Выбор месяца -->
      <div class="flex items-center gap-2">
        <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
        <span class="text-base font-semibold text-surface-700 min-w-36 text-center capitalize">
          {{ monthLabel }}
        </span>
        <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <template v-else>
      <!-- Три карточки -->
      <div class="grid grid-cols-3 gap-4">
        <div
          class="bg-surface-0 rounded-xl border border-surface-200 p-5 cursor-pointer hover:border-red-300 transition-colors"
          @click="openDetail('undertime')"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i class="pi pi-arrow-down text-red-600" />
            </div>
            <span class="text-sm text-surface-500">Недоработка</span>
          </div>
          <p class="text-3xl font-bold text-surface-800">{{ summary?.cards?.undertime_count ?? 0 }}</p>
          <p class="text-xs text-surface-400 mt-1">сотрудников</p>
        </div>

        <div
          class="bg-surface-0 rounded-xl border border-surface-200 p-5 cursor-pointer hover:border-blue-300 transition-colors"
          @click="openDetail('overtime')"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <i class="pi pi-arrow-up text-blue-600" />
            </div>
            <span class="text-sm text-surface-500">Переработка</span>
          </div>
          <p class="text-3xl font-bold text-surface-800">{{ summary?.cards?.overtime_count ?? 0 }}</p>
          <p class="text-xs text-surface-400 mt-1">сотрудников</p>
        </div>

        <div
          class="bg-surface-0 rounded-xl border border-surface-200 p-5 cursor-pointer hover:border-orange-300 transition-colors"
          @click="openDetail('unlogged')"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <i class="pi pi-calendar-times text-orange-600" />
            </div>
            <span class="text-sm text-surface-500">Незаполненные дни</span>
          </div>
          <p class="text-3xl font-bold text-surface-800">{{ summary?.cards?.unlogged_count ?? 0 }}</p>
          <p class="text-xs text-surface-400 mt-1">сотрудников</p>
        </div>
      </div>

      <!-- Диаграммы -->
      <div class="grid grid-cols-2 gap-6">
        <!-- Часы по проектам -->
        <div class="bg-surface-0 rounded-xl border border-surface-200 p-5">
          <h3 class="font-medium text-surface-700 mb-4">Часы по проектам</h3>
          <div v-if="chartsReady && hoursChartData.labels?.length" class="relative h-64">
            <Chart key="hours" type="pie" :data="hoursChartData" :options="chartOptions" class="h-full" />
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-8">Нет данных</p>
        </div>

        <!-- Распределение сотрудников -->
        <div class="bg-surface-0 rounded-xl border border-surface-200 p-5">
          <h3 class="font-medium text-surface-700 mb-4">Сотрудники по проектам</h3>
          <div v-if="chartsReady && usersChartData.labels?.length" class="relative h-64">
            <Chart key="users" type="pie" :data="usersChartData" :options="chartOptions" class="h-full" />
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-8">Нет данных</p>
        </div>
      </div>
    </template>

    <!-- Dialog: детализация -->
    <Dialog
      v-model:visible="detailVisible"
      :header="detailTitle"
      modal
      class="w-full max-w-6xl"
    >
      <DataTable
        :value="detailUsers"
        :loading="detailLoading"
        paginator
        :rows="20"
        stripedRows
      >
        <Column field="user_name" header="Сотрудник" sortable style="min-width: 160px" />
        <Column field="fact_hours" header="Факт (ч)" sortable style="width: 110px">
          <template #body="{ data }">{{ data.fact_hours }} ч</template>
        </Column>
        <Column field="absence_hours" header="Отсутствие (ч)" style="width: 140px">
          <template #body="{ data }">{{ data.absence_hours }} ч</template>
        </Column>
        <Column field="deviation" header="Отклонение" sortable style="width: 120px">
          <template #body="{ data }">
            <span :class="data.deviation >= 0 ? 'text-blue-600' : 'text-red-600'">
              {{ data.deviation >= 0 ? '+' : '' }}{{ data.deviation }} ч
            </span>
          </template>
        </Column>
        <Column field="top2_projects" header="TOP-2 проектов" style="min-width: 180px">
          <template #body="{ data }">
            <div class="space-y-0.5">
              <div v-for="p in data.top2_projects" :key="p.name" class="text-xs">
                <span class="font-medium">{{ p.name }}</span>
                <span class="text-surface-400 ml-1">{{ p.hours }}ч</span>
              </div>
            </div>
          </template>
        </Column>
        <Column field="unlogged_count" header="Незапол. дней" style="width: 130px">
          <template #body="{ data }">
            <span :class="data.unlogged_count > 0 ? 'text-orange-600 font-medium' : 'text-surface-400'">
              {{ data.unlogged_count }}
            </span>
          </template>
        </Column>
        <Column field="last_log_date" header="Последний лог" style="width: 140px">
          <template #body="{ data }">
            <span class="text-surface-500 text-xs">{{ data.last_log_date ?? '—' }}</span>
          </template>
        </Column>
        <Column header="" style="width: 60px">
          <template #body="{ data }">
            <Button
              icon="pi pi-user"
              text rounded size="small"
              v-tooltip="'Отчёт по пользователю'"
              @click="goToUserReport(data.user_id)"
            />
          </template>
        </Column>
        <template #empty>
          <div class="text-center py-6 text-surface-400">Нет данных</div>
        </template>
      </DataTable>
    </Dialog>
  </div>
</template>

<script setup>
import { useDashboardStore } from '@/stores/dashboard.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import ProgressSpinner from 'primevue/progressspinner';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

dayjs.locale('ru');
defineOptions({ name: 'DashboardPage' });

const router = useRouter();
const uiStore = useUiStore();
const dashboardStore = useDashboardStore();
const { summary, loading } = storeToRefs(dashboardStore);

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY')
);

// Откладываем монтирование диаграмм на один тик, чтобы canvas был в DOM (избегаем Chart.js "reading 'id' of null")
const chartsReady = ref(false);
watch(
  () => [loading.value, summary.value],
  ([loadingVal, summaryVal]) => {
    if (loadingVal) chartsReady.value = false;
    else if (summaryVal) nextTick(() => { chartsReady.value = true; });
  },
  { immediate: true }
);

onMounted(() => {
  uiStore.setPageTitle('Дашборд');
  loadSummary();
});

function loadSummary() {
  dashboardStore.fetchSummary({ year: currentYear.value, month: currentMonth.value });
}

function prevMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).subtract(1, 'month');
  currentYear.value = d.year(); currentMonth.value = d.month() + 1;
  loadSummary();
}

function nextMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).add(1, 'month');
  currentYear.value = d.year(); currentMonth.value = d.month() + 1;
  loadSummary();
}

// Цвета для диаграмм
const CHART_COLORS = [
  '#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4',
];

const hoursChartData = computed(() => {
  const items = summary.value?.charts?.hours_by_project ?? [];
  return {
    labels: items.map(i => i.name),
    datasets: [{
      data: items.map(i => i.hours),
      backgroundColor: CHART_COLORS.slice(0, items.length),
    }],
  };
});

const usersChartData = computed(() => {
  const items = summary.value?.charts?.users_by_project ?? [];
  return {
    labels: items.map(i => i.name),
    datasets: [{
      data: items.map(i => i.user_count),
      backgroundColor: CHART_COLORS.slice(0, items.length),
    }],
  };
});

const chartOptions = {
  plugins: { legend: { position: 'right' } },
  responsive: true,
  maintainAspectRatio: false,
};

// Детализация
const detailVisible = ref(false);
const detailType = ref('');
const { detailUsers, detailLoading } = storeToRefs(dashboardStore);

const DETAIL_TITLES = {
  undertime: 'Сотрудники с недоработкой',
  overtime: 'Сотрудники с переработкой',
  unlogged: 'Сотрудники с незаполненными днями',
};
const detailTitle = computed(() => DETAIL_TITLES[detailType.value] ?? '');

function openDetail(type) {
  detailType.value = type;
  detailVisible.value = true;
  dashboardStore.fetchDetailList({ year: currentYear.value, month: currentMonth.value, type });
}

function goToUserReport(userId) {
  router.push({
    name: 'reports-user',
    query: {
      user_id: userId,
      year: currentYear.value,
      month: currentMonth.value,
    },
  });
}
</script>
