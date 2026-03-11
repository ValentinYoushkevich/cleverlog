<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Дашборд</h1>

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
          <p class="text-3xl font-bold text-surface-800">
            {{ summary?.cards?.undertime_count ?? 0 }}
          </p>
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
          <p class="text-3xl font-bold text-surface-800">
            {{ summary?.cards?.overtime_count ?? 0 }}
          </p>
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
          <p class="text-3xl font-bold text-surface-800">
            {{ summary?.cards?.unlogged_count ?? 0 }}
          </p>
          <p class="text-xs text-surface-400 mt-1">сотрудников</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div class="bg-surface-0 rounded-xl border border-surface-200 p-5">
          <h3 class="font-medium text-surface-700 mb-4">Часы по проектам</h3>
          <div v-if="showHoursChart" class="relative h-64">
            <Chart
              key="hours"
              type="pie"
              :data="hoursChartData"
              :options="chartOptions"
              class="h-full"
            />
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-8">
            Нет данных
          </p>
        </div>

        <div class="bg-surface-0 rounded-xl border border-surface-200 p-5">
          <h3 class="font-medium text-surface-700 mb-4">Сотрудники по проектам</h3>
          <div v-if="showUsersChart" class="relative h-64">
            <Chart
              key="users"
              type="pie"
              :data="usersChartData"
              :options="chartOptions"
              class="h-full"
            />
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-8">
            Нет данных
          </p>
        </div>
      </div>
    </template>

    <DashboardDetailDialog
      v-model="detailVisible"
      :detailType="detailType"
      :detailUsers="preparedDetailUsers"
      :detailLoading="detailLoading"
      @open-user-report="goToUserReport"
    />
  </div>
</template>

<script setup>
import DashboardDetailDialog from '@/pages/dashboard/DashboardDetailDialog.vue';
import { useDashboardStore } from '@/stores/dashboard.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useRouter } from 'vue-router';

dayjs.locale('ru');
defineOptions({ name: 'DashboardPage' });

const router = useRouter();
const uiStore = useUiStore();
const dashboardStore = useDashboardStore();
const { summary, loading, detailUsers, detailLoading } = storeToRefs(dashboardStore);

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY'),
);

const chartsReady = ref(false);
watch(
  () => [loading.value, summary.value],
  ([loadingVal, summaryVal]) => {
    if (loadingVal) {
      chartsReady.value = false;
    } else if (summaryVal) {
      nextTick(() => {
        chartsReady.value = true;
      });
    }
  },
  { immediate: true },
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
  currentYear.value = d.year();
  currentMonth.value = d.month() + 1;
  loadSummary();
}

function nextMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).add(1, 'month');
  currentYear.value = d.year();
  currentMonth.value = d.month() + 1;
  loadSummary();
}

const CHART_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
];

const hoursChartData = computed(() => {
  const items = summary.value?.charts?.hours_by_project ?? [];
  return {
    labels: items.map((i) => `${i.name} — ${i.hours} ч`),
    datasets: [
      {
        data: items.map((i) => i.hours),
        backgroundColor: CHART_COLORS.slice(0, items.length),
      },
    ],
  };
});

const usersChartData = computed(() => {
  const items = summary.value?.charts?.users_by_project ?? [];
  return {
    labels: items.map((i) => `${i.name} — ${i.user_count} сотрудн.`),
    datasets: [
      {
        data: items.map((i) => i.user_count),
        backgroundColor: CHART_COLORS.slice(0, items.length),
      },
    ],
  };
});

const showHoursChart = computed(
  () => chartsReady.value && (hoursChartData.value.labels?.length ?? 0) > 0,
);
const showUsersChart = computed(
  () => chartsReady.value && (usersChartData.value.labels?.length ?? 0) > 0,
);

const chartOptions = {
  plugins: { legend: { position: 'right' } },
  responsive: true,
  maintainAspectRatio: false,
};

const detailVisible = ref(false);
const detailType = ref('');

const preparedDetailUsers = computed(() =>
  (detailUsers.value ?? []).map((u) => ({
    ...u,
    deviationPrefix: u?.deviation >= 0 ? '+' : '',
    deviationTextClass: u?.deviation >= 0 ? 'text-blue-600' : 'text-red-600',
    unloggedCountClass:
      u?.unlogged_count > 0 ? 'text-orange-600 font-medium' : 'text-surface-400',
  })),
);

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
