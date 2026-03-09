<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отчёт по пользователю</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        :disabled="!rows.length || loading"
        @click="doExport"
      />
    </div>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-if="isAdmin"
          v-model="filters.user_id"
          :options="userOptions"
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
          dateFormat="dd.mm.yy"
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

    <div v-if="normBlock" class="grid grid-cols-3 gap-4">
      <div class="rounded-xl border border-surface-200 bg-surface-0 p-4 text-center">
        <p class="mb-1 text-xs text-surface-400">Норма</p>
        <p class="text-2xl font-bold text-surface-700">{{ normBlock.norm }} ч</p>
      </div>
      <div class="rounded-xl border border-surface-200 bg-surface-0 p-4 text-center">
        <p class="mb-1 text-xs text-surface-400">Факт</p>
        <p class="text-2xl font-bold text-surface-700">{{ normBlock.fact }} ч</p>
      </div>
      <div
        class="rounded-xl border p-4 text-center"
        :class="normBlock.deviation >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'"
      >
        <p class="mb-1 text-xs opacity-70">Отклонение</p>
        <p class="text-2xl font-bold">
          {{ normBlock.deviation >= 0 ? '+' : '' }}{{ normBlock.deviation }} ч
        </p>
      </div>
    </div>

    <div
      v-if="totals && Object.keys(totals.by_project ?? {}).length"
      class="rounded-xl border border-surface-200 bg-surface-0 p-4"
    >
      <h3 class="mb-3 font-medium text-surface-700">Итоги по проектам</h3>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(hours, name) in totals.by_project"
          :key="name"
          class="rounded-lg bg-primary-50 px-3 py-1.5 text-sm"
        >
          <span class="font-medium text-primary">{{ name }}</span>
          <span class="ml-2 text-surface-500">{{ hours }} ч</span>
        </div>
      </div>
      <p class="mt-3 text-sm text-surface-500">
        Итого:
        <span class="font-semibold text-surface-700">{{ totals.total_hours }} ч</span>
      </p>
    </div>

    <DataTable
      :value="rows"
      :loading="loading"
      paginator
      :rows="50"
      :rowsPerPageOptions="[20, 50, 100]"
      sortMode="single"
      stripedRows
      class="overflow-hidden rounded-xl border border-surface-200"
    >
      <Column field="user_name" header="Пользователь" style="width: 180px">
        <template #body="{ data }">
          {{ data.user_name || '—' }}
        </template>
      </Column>
      <Column field="date" header="Дата" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.date) }}
        </template>
      </Column>
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
      <Column field="duration_hours" header="Длительность (ч)" style="width: 180px">
        <template #body="{ data }">
          {{ data.duration_hours }} ч
        </template>
      </Column>
      <Column field="comment" header="Комментарий">
        <template #body="{ data }">
          <span class="block max-w-xs truncate" :title="data.comment">{{ data.comment }}</span>
        </template>
      </Column>
      <template #empty>
        <div class="py-8 text-center text-surface-400">Нет данных за выбранный период</div>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import dayjs from 'dayjs';
import { useRoute } from 'vue-router';

import { ABSENCE_LABEL } from '@/constants/absences.js';
import { useAbsencesStore } from '@/stores/absences.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useReportsStore } from '@/stores/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

defineOptions({ name: 'UserReportPage' });

const route = useRoute();
const projectsStore = useProjectsStore();
const reportsStore = useReportsStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const absencesStore = useAbsencesStore();
const calendarStore = useCalendarStore();

const isAdmin = computed(() => authStore.isAdmin);

const userOptions = computed(() =>
  absencesStore.users.map((u) => ({
    id: u.id,
    fullName: [u.last_name, u.first_name].filter(Boolean).join(' ') || u.email || u.id,
  })),
);

const typeOptions = [
  { value: 'work', label: 'Работа' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick_leave', label: 'Больничный' },
  { value: 'day_off', label: 'Отгул' },
];

const filters = reactive({
  user_id: null,
  project_id: null,
  type: null,
  dateRange: null,
});

const rows = ref([]);
const totals = ref(null);
const normBlock = ref(null);
const loading = ref(false);
const exporting = ref(false);

function buildParams() {
  const params = {};
  if (isAdmin.value && filters.user_id) { params.user_id = filters.user_id; }
  if (filters.project_id) { params.project_id = filters.project_id; }
  if (filters.type) { params.type = filters.type; }
  const [from, to] = filters.dateRange ?? [];
  if (from) {
    const fromStr = dayjs(from).format('YYYY-MM-DD');
    params.date_from = fromStr;
    // Если в диапазоне выбрана только одна дата, фильтруем ровно по этому дню.
    const toValue = to || from;
    params.date_to = dayjs(toValue).format('YYYY-MM-DD');
  } else if (to) {
    // На всякий случай, если по какой-то причине заполнен только конец диапазона.
    const toStr = dayjs(to).format('YYYY-MM-DD');
    params.date_from = toStr;
    params.date_to = toStr;
  }
  return params;
}

async function loadReport() {
  loading.value = true;
  try {
    const data = await reportsStore.fetchUserReport(buildParams());
    rows.value = data.rows ?? [];
    totals.value = data.totals ?? null;
    normBlock.value = data.norm_block ?? null;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    user_id: null,
    project_id: null,
    type: null,
    dateRange: null,
  });

  // После сброса сразу загружаем отчёт без фильтров
  loadReport();
}

async function doExport() {
  exporting.value = true;
  try {
    const blob = await reportsStore.exportUserReport(buildParams());
    downloadBlob(blob, 'report_user.xlsx');
  } finally {
    exporting.value = false;
  }
}

function formatDate(value) {
  return value ? dayjs(value).format('DD.MM.YYYY') : '';
}

onMounted(async () => {
  uiStore.setPageTitle('Отчёт по пользователю');
  if (!projectsStore.projects.length) {
    await projectsStore.fetchProjects();
  }
  if (authStore.isAdmin && !absencesStore.users.length) {
    await absencesStore.fetchUsers();
  }
  // Переход с дашборда: подставляем user_id и период (год/месяц) из query
  const q = route.query;
  if (q.user_id) {
    filters.user_id = Number(q.user_id) || q.user_id;
  }
  if (q.year && q.month) {
    const y = Number(q.year);
    const m = Number(q.month);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const start = dayjs(`${y}-${m}-01`);
      filters.dateRange = [start.toDate(), start.endOf('month').toDate()];
    }
  } else {
    // По умолчанию используем текущий месяц из календаря
    const y = calendarStore.currentYear;
    const m = calendarStore.currentMonth;
    if (y && m) {
      const start = dayjs(`${y}-${m}-01`);
      filters.dateRange = [start.toDate(), start.endOf('month').toDate()];
    }
  }

  // Для Admin / SuperAdmin по умолчанию показываем отчёт по самому себе
  if (
    !filters.user_id
    && authStore.user
    && (authStore.user.role === 'admin' || authStore.user.role === 'superadmin')
  ) {
    filters.user_id = authStore.user.id;
  }
  await loadReport();
});
</script>
