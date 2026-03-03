<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отчёт по проекту</h1>
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
          :options="userOptions"
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

    <div
      v-if="totals?.by_user && Object.keys(totals.by_user).length"
      class="rounded-xl border border-surface-200 bg-surface-0 p-4"
    >
      <h3 class="mb-3 font-medium text-surface-700">Итоги по сотрудникам</h3>
      <div class="mb-3 flex flex-wrap gap-2">
        <div
          v-for="(hours, name) in totals.by_user"
          :key="name"
          class="rounded-lg bg-primary-50 px-3 py-1.5 text-sm"
        >
          <span class="font-medium text-primary">{{ name }}</span>
          <span class="ml-2 text-surface-500">{{ hours }} ч</span>
        </div>
      </div>
      <p class="text-sm text-surface-500">
        Итого по проекту:
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
      <Column field="user" header="Сотрудник" sortable style="width: 180px" />
      <Column field="position" header="Должность" style="width: 150px" />
      <Column field="date" header="Дата" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.date) }}
        </template>
      </Column>
      <Column field="project_name" header="Проект" sortable />
      <Column field="task_number" header="Task Number" style="width: 140px" />
      <Column field="duration_hours" header="Длительность (ч)" style="width: 180px">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
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
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, onMounted, reactive, ref } from 'vue';

import { useAbsencesStore } from '@/stores/absences.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useReportsStore } from '@/stores/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

defineOptions({ name: 'ProjectReportPage' });

const projectsStore = useProjectsStore();
const reportsStore = useReportsStore();
const uiStore = useUiStore();
const absencesStore = useAbsencesStore();

const userOptions = computed(() =>
  absencesStore.users.map((u) => ({
    id: u.id,
    fullName: [u.last_name, u.first_name].filter(Boolean).join(' ') || u.email || u.id,
  })),
);

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
  if (filters.task_number?.trim()) params.task_number = filters.task_number.trim();
  if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
  if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
  return params;
}

async function loadReport() {
  loading.value = true;
  try {
    const data = await reportsStore.fetchProjectReport(buildParams());
    rows.value = data.rows ?? [];
    totals.value = data.totals ?? null;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    project_id: null,
    user_id: null,
    task_number: '',
    dateRange: [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()],
  });
  loadReport();
}

async function doExport() {
  exporting.value = true;
  try {
    const blob = await reportsStore.exportProjectReport(buildParams());
    downloadBlob(blob, 'report_project.xlsx');
  } finally {
    exporting.value = false;
  }
}

function formatDate(value) {
  return value ? dayjs(value).format('DD.MM.YYYY') : '';
}

onMounted(async () => {
  uiStore.setPageTitle('Отчёт по проекту');
  if (!projectsStore.projects.length) await projectsStore.fetchProjects();
  await absencesStore.fetchUsers();
  await loadReport();
});
</script>
