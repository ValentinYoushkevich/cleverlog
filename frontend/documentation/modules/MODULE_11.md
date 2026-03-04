# MODULE_11 — Frontend: Дашборд (Admin)

## Обзор

Страница `/dashboard` — выбор месяца, три кликабельных Card (недоработка / переработка / незаполненные дни), две круговые диаграммы (часы по проектам, распределение сотрудников), Dialog с детализацией по карточке.

> **Зависимости модуля:**
> - `downloadBlob` из MODULE_8 — для экспорта незаполнивших
> - Данные дашборда загружаются через store

---

## Шаг 1. Store dashboard

Стор для страницы Дашборд — вызовы API в сторе, обёрнуты в try/catch. Имя стора соответствует странице: `DashboardPage` → store `dashboard`.

`src/stores/dashboard.js`:

```js
import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    summary: null,
    loading: false,
    detailUsers: [],
    detailLoading: false,
  }),

  actions: {
    async fetchSummary({ year, month }) {
      this.loading = true;
      try {
        const res = await http.get('/dashboard', { params: { year, month } });
        this.summary = res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchDetailList({ year, month, type }) {
      this.detailLoading = true;
      try {
        const res = await http.get('/dashboard/users', { params: { year, month, type } });
        this.detailUsers = res.data?.users ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.detailLoading = false;
      }
    },
  },
});
```

---

## Шаг 2. DashboardPage

`src/pages/DashboardPage.vue`:

```vue
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
          <div v-if="hoursChartData.labels?.length" class="relative h-64">
            <Chart type="pie" :data="hoursChartData" :options="chartOptions" class="h-full" />
          </div>
          <p v-else class="text-sm text-surface-400 text-center py-8">Нет данных</p>
        </div>

        <!-- Распределение сотрудников -->
        <div class="bg-surface-0 rounded-xl border border-surface-200 p-5">
          <h3 class="font-medium text-surface-700 mb-4">Сотрудники по проектам</h3>
          <div v-if="usersChartData.labels?.length" class="relative h-64">
            <Chart type="pie" :data="usersChartData" :options="chartOptions" class="h-full" />
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
      class="w-full max-w-4xl"
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
              icon="pi pi-calendar"
              text rounded size="small"
              v-tooltip="'Перейти в календарь'"
              @click="goToCalendar(data.user_id)"
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
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Chart from 'primevue/chart';
import ProgressSpinner from 'primevue/progressspinner';
import { useDashboardStore } from '@/stores/dashboard.js';
import { useUiStore } from '@/stores/ui.js';
import { storeToRefs } from 'pinia';

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

function goToCalendar(userId) {
  // Переход в календарь — передаём user_id как query для Admin-просмотра
  router.push({ name: 'calendar', query: { user_id: userId } });
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Страница доступна только Admin | User → редирект (MODULE_20) |
| 2 | Карточки загружаются | Три Card с цифрами из API |
| 3 | Диаграмма часов по проектам | Круговая диаграмма с легендой справа |
| 4 | Диаграмма сотрудников | Вторая диаграмма с количеством сотрудников |
| 5 | Клик по карточке «Недоработка» | Dialog открывается с таблицей сотрудников, `deviation < 0` |
| 6 | Клик по карточке «Переработка» | Dialog с `deviation > 0` |
| 7 | Клик по карточке «Незаполненные» | Dialog с `unlogged_count > 0` |
| 8 | TOP-2 проектов в таблице | Колонка содержит до 2 проектов с часами |
| 9 | Переход в календарь | Кнопка-иконка → роут `/calendar?user_id=...` |
| 10 | Навигация по месяцам | ← → меняет месяц, данные обновляются |
