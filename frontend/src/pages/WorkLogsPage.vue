<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Рабочие логи</h1>
      <Button label="Добавить лог" icon="pi pi-plus" @click="openCreateDialog" />
    </div>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.project_id"
          :options="projectsStore.activeProjects"
          optionLabel="name"
          optionValue="id"
          placeholder="Все проекты"
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
        <InputText v-model="filters.task_number" placeholder="Task Number" class="w-full" />
        <InputText v-model="filters.comment" placeholder="Поиск по комментарию" class="w-full" />
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Найти" icon="pi pi-search" size="small" @click="loadLogs" />
        <Button
          label="Сбросить"
          icon="pi pi-times"
          size="small"
          severity="secondary"
          @click="resetFilters"
        />
      </div>
    </div>

    <DataTable
      :value="logs"
      :loading="loading"
      paginator
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      sortMode="single"
      stripedRows
      class="overflow-hidden rounded-xl border border-surface-200"
    >
      <Column field="user" header="Пользователь" sortable style="width: 12%">
        <template #body="{ data }">
          {{ [data.first_name, data.last_name].filter(Boolean).join(' ') || '—' }}
        </template>
      </Column>
      <Column field="date" header="Дата" sortable style="width: 12%">
        <template #body="{ data }">
          {{ dayjs(data.date).format('DD.MM.YYYY') }}
        </template>
      </Column>
      <Column field="project_name" header="Проект" sortable style="width: 12%" />
      <Column field="task_number" header="Task Number" style="width: 12%" />
      <Column field="duration_hours" header="Длительность (ч)" style="width: 12%">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
      </Column>
      <Column field="comment" header="Комментарий" style="width: 24%">
        <template #body="{ data }">
          <span class="block max-w-full truncate" :title="data.comment">{{ data.comment }}</span>
        </template>
      </Column>
      <Column header="" style="width: 100px">
        <template #body="{ data }">
          <div class="flex justify-end gap-1">
            <Button
              v-tooltip.top="!isAdmin && isLogInClosedMonth(data) ? 'Месяц закрыт' : ''"
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              :disabled="!isAdmin && isLogInClosedMonth(data)"
              @click="openEditDialog(data)"
            />
            <Button
              v-tooltip.top="!isAdmin && isLogInClosedMonth(data) ? 'Месяц закрыт' : ''"
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :disabled="!isAdmin && isLogInClosedMonth(data)"
              @click="confirmDelete(data)"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <div class="py-8 text-center text-surface-400">Логи не найдены</div>
      </template>
    </DataTable>

    <WorkLogFormDialog
      v-model="dialogVisible"
      :editing-log="editingLog"
      :is-admin="isAdmin"
      :user-options="workLogUserOptions"
      :current-user-label="currentUserLabel"
      @saved="loadLogs"
    />
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
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

import http from '@/api/http.js';
import WorkLogFormDialog from '@/components/WorkLogFormDialog.vue';
import { useAbsencesStore } from '@/stores/absences.js';
import { useAuthStore } from '@/stores/auth.js';
import { useMonthClosuresStore } from '@/stores/monthClosures.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';

defineOptions({ name: 'WorkLogsPage' });

const confirm = useConfirm();
const toast = useToast();
const projectsStore = useProjectsStore();
const monthClosuresStore = useMonthClosuresStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const absencesStore = useAbsencesStore();

const workLogUserOptions = computed(() =>
  absencesStore.users.map((u) => ({
    value: u.id,
    label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id,
  }))
);
const currentUserLabel = computed(() => {
  const me = authStore.user;
  if (!me) { return '—'; }
  return [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email || '—';
});

onMounted(() => {
  uiStore.setPageTitle('Рабочие логи');
  loadLogs();
  if (authStore.isAdmin) { absencesStore.fetchUsers(); }
});

const isAdmin = computed(() => authStore.isAdmin);
const closedMonths = reactive({});

const logs = ref([]);
const loading = ref(false);
const filters = reactive({ project_id: null, dateRange: null, task_number: '', comment: '' });

async function loadLogs() {
  loading.value = true;
  try {
    const params = {};
    if (filters.project_id) { params.project_id = filters.project_id; }
    if (filters.task_number) { params.task_number = filters.task_number; }
    if (filters.comment) { params.comment = filters.comment; }
    if (filters.dateRange?.[0]) {
      params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
      params.date_to = filters.dateRange[1]
        ? dayjs(filters.dateRange[1]).format('YYYY-MM-DD')
        : params.date_from;
    }

    const res = await http.get('/work-logs', { params });
    const data = res.data.data ?? res.data;
    logs.value = data;

    const ymKeys = Array.from(new Set(data.map((log) => dayjs(log.date).format('YYYY-MM'))));
    await Promise.all(
      ymKeys
        .filter((key) => closedMonths[key] === undefined)
        .map(async (key) => {
          const [yearStr, monthStr] = key.split('-');
          const year = Number(yearStr);
          const month = Number(monthStr);
          if (!Number.isFinite(year) || !Number.isFinite(month)) { return; }
          try {
            const status = await monthClosuresStore.fetchStatus(year, month);
            closedMonths[key] = Boolean(status.closed);
          } catch {
            closedMonths[key] = false;
          }
        }),
    );
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { project_id: null, dateRange: null, task_number: '', comment: '' });
  loadLogs();
}

const dialogVisible = ref(false);
const editingLog = ref(null);

function isLogInClosedMonth(log) {
  const key = dayjs(log.date).format('YYYY-MM');
  return Boolean(closedMonths[key]);
}

function openCreateDialog() {
  editingLog.value = null;
  dialogVisible.value = true;
}

function openEditDialog(log) {
  editingLog.value = log;
  dialogVisible.value = true;
}

function confirmDelete(log) {
  confirm.require({
    message: `Удалить лог за ${log.date}?`,
    header: 'Подтверждение',
    icon: 'pi pi-trash',
    acceptSeverity: 'danger',
    acceptProps: { severity: 'danger' },
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await http.delete(`/work-logs/${log.id}`);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
        await loadLogs();
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
