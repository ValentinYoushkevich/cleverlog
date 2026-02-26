# MODULE_15 — Frontend: Журнал аудита (Admin)

## Обзор

Страница `/admin/audit-logs` — таблица с фильтрами по event_type, entity_type, периоду, result, IP. Подсказки для фильтров загружаются с API. Детали записи (before/after JSON) раскрываются в Dialog. Экспорт Excel.

> **Зависимости модуля:**
> - `downloadBlob` из MODULE_8
> - Паттерн таблица + фильтры из предыдущих модулей

---

## Шаг 1. API

`src/api/auditLogs.js`:

```js
import http from '@/api/http.js';

export const auditLogsApi = {
  list: (params) => http.get('/audit-logs', { params }),
  filterOptions: () => http.get('/audit-logs/filter-options'),
  export: (params) => http.get('/audit-logs/export', { params, responseType: 'blob' }),
};
```

---

## Шаг 2. AuditLogsPage

`src/pages/admin/AuditLogsPage.vue`:

```vue
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
          :options="filterOptions.event_types"
          placeholder="Тип события"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.entity_type"
          :options="filterOptions.entity_types"
          placeholder="Сущность"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.result"
          :options="[{ label: 'Успешно', value: 'success' }, { label: 'Ошибка', value: 'failure' }]"
          optionLabel="label"
          optionValue="value"
          placeholder="Результат"
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
      :rows="50"
      :rowsPerPageOptions="[20, 50, 100]"
      :totalRecords="totalRecords"
      lazy
      @page="onPage"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
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
          <span class="font-mono text-xs bg-surface-100 px-2 py-0.5 rounded">{{ data.event_type }}</span>
        </template>
      </Column>
      <Column field="entity_type" header="Сущность" style="width: 130px">
        <template #body="{ data }">
          <Tag :value="data.entity_type" severity="secondary" class="text-xs" />
        </template>
      </Column>
      <Column field="result" header="Результат" style="width: 110px">
        <template #body="{ data }">
          <Tag
            :value="data.result === 'success' ? 'OK' : 'Ошибка'"
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
            icon="pi pi-eye"
            text rounded size="small"
            v-tooltip="'Детали'"
            @click="openDetail(data)"
            :disabled="!data.before && !data.after"
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
          <div><span class="text-surface-400">Событие:</span> <span class="font-mono font-medium">{{ selectedLog.event_type }}</span></div>
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
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { auditLogsApi } from '@/api/auditLogs.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';

defineOptions({ name: 'AuditLogsPage' });

const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Журнал аудита');
  loadFilterOptions();
  loadLogs();
});

const logs = ref([]);
const loading = ref(false);
const exporting = ref(false);
const totalRecords = ref(0);
const currentPage = ref(1);
const pageSize = ref(50);

const filterOptions = reactive({ event_types: [], entity_types: [] });
const filters = reactive({
  event_type: null, entity_type: null,
  result: null, dateRange: null,
  search: '', ip: '',
});

async function loadFilterOptions() {
  const res = await auditLogsApi.filterOptions();
  filterOptions.event_types = res.data.event_types;
  filterOptions.entity_types = res.data.entity_types;
}

function buildParams() {
  const params = { page: currentPage.value, limit: pageSize.value };
  if (filters.event_type) params.event_type = filters.event_type;
  if (filters.entity_type) params.entity_type = filters.entity_type;
  if (filters.result) params.result = filters.result;
  if (filters.search) params.search = filters.search;
  if (filters.ip) params.ip = filters.ip;
  if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
  if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');
  return params;
}

async function loadLogs() {
  loading.value = true;
  try {
    const res = await auditLogsApi.list(buildParams());
    logs.value = res.data.data ?? res.data;
    totalRecords.value = res.data.pagination?.total ?? logs.value.length;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { event_type: null, entity_type: null, result: null, dateRange: null, search: '', ip: '' });
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
  exporting.value = true;
  try {
    const res = await auditLogsApi.export(buildParams());
    downloadBlob(res.data, 'audit_log.xlsx');
  } finally {
    exporting.value = false;
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Страница доступна только Admin | User → редирект (MODULE_20) |
| 2 | Список загружается | Записи аудита из всех предыдущих действий видны |
| 3 | Фильтр event_type | Select заполнен вариантами из `/audit-logs/filter-options` |
| 4 | Фильтр по типу события | Выбрать `LOGIN` → только записи входа |
| 5 | Фильтр по result | `failure` → неуспешные попытки |
| 6 | Поиск | Ввести `WORK_LOG` → строки содержащие это значение |
| 7 | Монospace для event_type | Ячейка события отображается в моно-шрифте на серем фоне |
| 8 | Кнопка «Детали» | Клик → Dialog с before/after JSON |
| 9 | before красным, after зелёным | Блоки JSON с цветными фонами |
| 10 | Кнопка disabled без данных | Записи без before/after → кнопка eye disabled |
| 11 | Lazy pagination | Смена страницы → новый запрос к API |
| 12 | Экспорт Excel | Скачивается `audit_log.xlsx` с применёнными фильтрами |
