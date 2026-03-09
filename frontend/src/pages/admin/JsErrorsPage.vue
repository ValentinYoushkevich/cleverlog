<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-semibold text-surface-800">Ошибки фронта</h1>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="flex items-end gap-2 flex-wrap">
        <div class="flex flex-col gap-1">
          <label for="js-errors-url-filter" class="text-xs font-medium text-surface-500">Страница (точно)</label>
          <InputText id="js-errors-url-filter" v-model="filters.url" placeholder="/calendar или http://localhost:5173/calendar" class="w-80" />
        </div>
        <Button label="Применить" icon="pi pi-search" @click="applyFilters" />
        <Button label="Сбросить" severity="secondary" @click="resetFilters" />
      </div>
    </div>

    <DataTable
      :value="list"
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
      <Column field="created_at" header="Время" style="width: 155px">
        <template #body="{ data }">
          <span class="text-xs text-surface-600">{{ formatDateTime(data.created_at) }}</span>
        </template>
      </Column>
      <Column field="message" header="Сообщение">
        <template #body="{ data }">
          <span class="text-sm text-surface-800 line-clamp-2" :title="data.message">{{ data.message }}</span>
        </template>
      </Column>
      <Column field="source" header="Файл" style="width: 180px">
        <template #body="{ data }">
          <span class="text-xs text-surface-500 truncate block max-w-44" :title="data.source">{{ data.source || '—' }}</span>
        </template>
      </Column>
      <Column field="url" header="Страница" style="width: 160px">
        <template #body="{ data }">
          <span class="text-xs text-surface-500 truncate block max-w-36" :title="data.url">{{ shortUrl(data.url) }}</span>
        </template>
      </Column>
      <Column field="ip" header="IP" style="width: 110px">
        <template #body="{ data }">
          <span class="text-xs font-mono text-surface-500">{{ data.ip || '—' }}</span>
        </template>
      </Column>
      <Column header="" style="width: 60px">
        <template #body="{ data }">
          <Button
            v-tooltip.left="'Подробнее'"
            icon="pi pi-eye"
            text
            rounded
            size="small"
            @click="openDetail(data)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Ошибок пока нет</div>
      </template>
    </DataTable>

    <Dialog v-model:visible="detailVisible" header="Детали ошибки" modal class="w-full max-w-2xl">
      <div v-if="selected" class="space-y-4 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div><span class="text-surface-400">Время:</span> {{ formatDateTime(selected.created_at) }}</div>
          <div><span class="text-surface-400">IP:</span> <span class="font-mono">{{ selected.ip || '—' }}</span></div>
        </div>
        <div>
          <p class="text-surface-400 mb-1">Сообщение</p>
          <p class="font-medium text-surface-800 wrap-break-word">{{ selected.message }}</p>
        </div>
        <div v-if="selected.source">
          <p class="text-surface-400 mb-1">Источник (файл)</p>
          <p class="font-mono text-xs break-all">{{ selected.source }}</p>
        </div>
        <div v-if="selected.lineno !== null || selected.colno !== null" class="flex gap-4">
          <span v-if="selected.lineno !== null"><span class="text-surface-400">Строка:</span> {{ selected.lineno }}</span>
          <span v-if="selected.colno !== null"><span class="text-surface-400">Колонка:</span> {{ selected.colno }}</span>
        </div>
        <div v-if="selected.url">
          <p class="text-surface-400 mb-1">URL страницы</p>
          <p class="font-mono text-xs break-all">{{ selected.url }}</p>
        </div>
        <div v-if="selected.stack">
          <p class="text-surface-400 mb-1">Стек</p>
          <pre class="text-xs bg-surface-100 border border-surface-200 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">{{ selected.stack }}</pre>
        </div>
        <div v-if="selected.user_agent">
          <p class="text-surface-400 mb-1">User-Agent</p>
          <p class="text-xs break-all text-surface-600">{{ selected.user_agent }}</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { useJsErrorsStore } from '@/stores/jsErrors.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { onMounted, reactive, ref } from 'vue';

defineOptions({ name: 'JsErrorsPage' });

const uiStore = useUiStore();
const jsErrorsStore = useJsErrorsStore();
const { list, loading, totalRecords } = storeToRefs(jsErrorsStore);

onMounted(() => {
  uiStore.setPageTitle('Ошибки фронта');
  load();
});

const currentPage = ref(1);
const pageSize = ref(50);
const detailVisible = ref(false);
const selected = ref(null);
const filters = reactive({
  url: '',
});

function load() {
  const params = { page: currentPage.value, limit: pageSize.value };
  if (filters.url?.trim()) {
    params.url = filters.url.trim();
  }
  jsErrorsStore.fetchList(params);
}

function onPage(event) {
  currentPage.value = event.page + 1;
  pageSize.value = event.rows;
  load();
}

function applyFilters() {
  currentPage.value = 1;
  load();
}

function resetFilters() {
  filters.url = '';
  currentPage.value = 1;
  load();
}

function formatDateTime(ts) {
  return ts ? dayjs(ts).format('DD.MM.YYYY HH:mm:ss') : '—';
}

function shortUrl(url) {
  if (!url) { return '—'; }
  try {
    const u = new URL(url);
    return u.pathname + (u.search || '') || u.href;
  } catch {
    return url.length > 40 ? url.slice(0, 37) + '…' : url;
  }
}

function openDetail(row) {
  selected.value = row;
  detailVisible.value = true;
}
</script>
