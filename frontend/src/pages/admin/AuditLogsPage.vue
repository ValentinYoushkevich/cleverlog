<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Журнал аудита</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        @click="doExport"
      />
    </div>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.event_type"
          :options="eventTypeOptions"
          optionLabel="name"
          optionValue="type"
          placeholder="Тип события"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.entity_type"
          :options="entityTypeOptions"
          optionLabel="name"
          optionValue="type"
          placeholder="Сущность"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.result"
          :options="resultOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Результат"
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
        <InputText v-model="filters.search" placeholder="Поиск по событию / сущности" class="w-64" />
        <InputText v-model="filters.ip" placeholder="IP адрес" class="w-40" />
        <Button label="Применить" icon="pi pi-search" size="small" @click="loadLogs" />
        <Button label="Сбросить" severity="secondary" size="small" @click="resetFilters" />
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="logs"
      :loading="loading"
      paginator
      :first="(currentPage - 1) * pageSize"
      :rows="pageSize"
      :rowsPerPageOptions="[20, 50, 100]"
      :totalRecords="totalRecords"
      lazy
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
      @page="onPage"
    >
      <Column field="timestamp" header="Время" style="width: 170px">
        <template #body="{ data }">
          <span class="text-xs text-surface-600">{{ formatDateTime(data.timestamp) }}</span>
        </template>
      </Column>
      <Column field="actor" header="Актор" style="width: 180px">
        <template #body="{ data }">
          <div>
            <p class="text-sm font-medium text-surface-800 truncate max-w-40">
              {{ data.last_name ? `${data.last_name} ${data.first_name}` : 'Система' }}
            </p>
            <p class="text-xs text-surface-400">{{ data.actor_role ?? '—' }}</p>
          </div>
        </template>
      </Column>
      <Column field="event_type" header="Событие" style="width: 200px">
        <template #body="{ data }">
          <div class="min-w-0">
            <p class="text-sm font-medium text-surface-800 truncate max-w-56">
              {{ data.event?.name ?? '—' }}
            </p>
            <p class="font-mono text-xs text-surface-400 truncate max-w-56">{{ data.event?.type ?? '—' }}</p>
          </div>
        </template>
      </Column>
      <Column field="entity_type" header="Сущность" style="width: 130px">
        <template #body="{ data }">
          <Tag :value="data.entity?.name ?? data.entity_type" severity="secondary" class="text-xs" />
        </template>
      </Column>
      <Column field="result" header="Результат" style="width: 110px">
        <template #body="{ data }">
          <Tag
            :value="data.result === 'success' ? 'Успешно' : 'Ошибка'"
            :severity="data.result === 'success' ? 'success' : 'danger'"
          />
        </template>
      </Column>
      <Column field="ip" header="IP" style="width: 130px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400 font-mono">{{ data.ip ?? '—' }}</span>
        </template>
      </Column>
      <Column header="" style="width: 60px">
        <template #body="{ data }">
          <Button
            v-tooltip.left="'Детали'"
            icon="pi pi-eye"
            text
            rounded
            size="small"
            :disabled="!data.before && !data.after"
            @click="openDetail(data)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Записей нет</div>
      </template>
    </DataTable>

    <!-- Dialog: детали записи -->
    <Dialog v-model:visible="detailVisible" header="Детали записи" modal class="w-full max-w-2xl">
      <div v-if="selectedLog" class="space-y-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-surface-400">Событие:</span>
            <span class="font-medium">{{ selectedLog.event?.name ?? '—' }}</span>
            <span class="font-mono text-xs text-surface-400">({{ selectedLog.event?.type ?? '—' }})</span>
          </div>
          <div><span class="text-surface-400">Время:</span> {{ formatDateTime(selectedLog.timestamp) }}</div>
          <div><span class="text-surface-400">Актор:</span> {{ selectedLog.last_name ? `${selectedLog.last_name} ${selectedLog.first_name}` : 'Система' }}</div>
          <div><span class="text-surface-400">IP:</span> <span class="font-mono">{{ selectedLog.ip ?? '—' }}</span></div>
        </div>

        <div v-if="selectedLog.before" class="space-y-1">
          <p class="text-sm font-medium text-surface-700">До:</p>
          <pre class="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-auto max-h-48">{{ JSON.stringify(selectedLog.before, null, 2) }}</pre>
        </div>

        <div v-if="selectedLog.after" class="space-y-1">
          <p class="text-sm font-medium text-surface-700">После:</p>
          <pre class="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-auto max-h-48">{{ JSON.stringify(selectedLog.after, null, 2) }}</pre>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { useAuditLogsStore } from '@/stores/auditLogs.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { computed, onMounted, reactive, ref } from 'vue';

defineOptions({ name: 'AuditLogsPage' });

const resultOptions = [{ label: 'Успешно', value: 'success' }, { label: 'Ошибка', value: 'failure' }];

const uiStore = useUiStore();
const auditLogsStore = useAuditLogsStore();
const { logs, loading, exporting, totalRecords, filterOptions } = storeToRefs(auditLogsStore);

const eventTypeOptions = computed(() => (Array.isArray(filterOptions.value?.event_types) ? filterOptions.value.event_types : []));
const entityTypeOptions = computed(() => (Array.isArray(filterOptions.value?.entity_types) ? filterOptions.value.entity_types : []));

onMounted(() => {
  uiStore.setPageTitle('Журнал аудита');
  loadFilterOptions();
  loadLogs();
});

const currentPage = ref(1);
const pageSize = ref(50);
const filters = reactive({
  event_type: null,
  entity_type: null,
  result: null,
  dateRange: null,
  search: '',
  ip: '',
});

async function loadFilterOptions() {
  await auditLogsStore.fetchFilterOptions();
}

function buildParams() {
  const params = { page: currentPage.value, limit: pageSize.value };
  if (filters.event_type) { params.event_type = filters.event_type; }
  if (filters.entity_type) { params.entity_type = filters.entity_type; }
  if (filters.result) { params.result = filters.result; }
  if (filters.search) { params.search = filters.search; }
  if (filters.ip) { params.ip = filters.ip; }
  if (filters.dateRange?.[0]) { params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD'); }
  if (filters.dateRange?.[1]) { params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD'); }
  return params;
}

function loadLogs() {
  auditLogsStore.fetchList(buildParams());
}

function resetFilters() {
  Object.assign(filters, {
    event_type: null,
    entity_type: null,
    result: null,
    dateRange: null,
    search: '',
    ip: '',
  });
  currentPage.value = 1;
  loadLogs();
}

function onPage(event) {
  currentPage.value = event.page + 1;
  pageSize.value = event.rows;
  loadLogs();
}

function formatDateTime(ts) {
  return ts ? dayjs(ts).format('DD.MM.YYYY HH:mm:ss') : '—';
}

// Детали
const detailVisible = ref(false);
const selectedLog = ref(null);

function openDetail(log) {
  selectedLog.value = log;
  detailVisible.value = true;
}

async function doExport() {
  try {
    const blob = await auditLogsStore.exportExcel(buildParams());
    if (blob) { downloadBlob(blob, 'audit_log.xlsx'); }
  } catch {
    // showError уже вызван в сторе
  }
}
</script>
