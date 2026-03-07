# MODULE_17 — Frontend: Незаполнившие дни (Admin) + JS Error Logging

## Обзор

Два небольших модуля. Страница `/reports/unlogged` — таблица сотрудников с незаполненными рабочими днями, даты списком, экспорт. Глобальный обработчик JS-ошибок на фронтенде — отправляет ошибки на `POST /api/log-js-error`.

> **Зависимости модуля:**
> - `useReportsStore` — методы `fetchUnlogged`, `exportUnlogged` (вызовы API в сторе, try/catch)
> - `downloadBlob` из MODULE_8
>
> **Важно (не потерять при реализации):**
> - Модуль включает правки в двух уже существующих файлах:
>   - добавить роут `reports-unlogged` в `router/index.js`;
>   - добавить пункт в `adminNavItems` в `AppLayout.vue`.

---

## Шаг 1. Store reports — незаполнившие дни и страница

В `src/stores/reports.js` добавить state и actions для страницы «Незаполнившие дни» (имя стора `reports` соответствует группе отчётов; страница `UnloggedPage` использует этот же store):

```js
// В state добавить:
unloggedUsers: [],
unloggedLoading: false,
unloggedExporting: false,

// В actions добавить:
async fetchUnlogged({ year, month }) {
  this.unloggedLoading = true;
  try {
    const res = await http.get('/reports/unlogged', { params: { year, month } });
    this.unloggedUsers = res.data?.users ?? [];
  } catch (err) {
    showError(err);
    throw err;
  } finally {
    this.unloggedLoading = false;
  }
},

async exportUnlogged({ year, month }) {
  this.unloggedExporting = true;
  try {
    const res = await http.get('/reports/unlogged/export', {
      params: { year, month },
      responseType: 'blob',
    });
    return res.data;
  } catch (err) {
    showError(err);
    throw err;
  } finally {
    this.unloggedExporting = false;
  }
},
```

`src/pages/reports/UnloggedPage.vue`:

> Добавить роут в `router/index.js`:

```js
{
  path: 'reports/unlogged',
  name: 'reports-unlogged',
  component: () => import('@/pages/reports/UnloggedPage.vue'),
  meta: { adminOnly: true },
},
```

> Добавить в `adminNavItems` в `AppLayout.vue`:

```js
{ name: 'reports-unlogged', label: 'Незаполнившие дни', icon: 'pi pi-exclamation-triangle' },
```

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Незаполнившие дни</h1>
      <Button
        label="Экспорт Excel"
        icon="pi pi-download"
        severity="secondary"
        :loading="exporting"
        @click="doExport"
        :disabled="!users.length"
      />
    </div>

    <!-- Выбор месяца -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200 flex items-center gap-4">
      <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
      <span class="text-base font-semibold text-surface-700 min-w-36 text-center capitalize">
        {{ monthLabel }}
      </span>
      <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
      <div v-if="!loading" class="ml-4 px-3 py-1.5 rounded-lg text-sm"
        :class="users.length ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'">
        {{ users.length ? `${users.length} сотрудников с незаполненными днями` : 'Все дни заполнены ✓' }}
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="users"
      :loading="loading"
      paginator
      :rows="20"
      stripedRows
      expandable
      v-model:expandedRows="expandedRows"
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column expander style="width: 3rem" />
      <Column field="user_name" header="Сотрудник" sortable style="min-width: 160px" />
      <Column field="unlogged_count" header="Незаполнено дней" sortable style="width: 170px">
        <template #body="{ data }">
          <span class="font-semibold text-orange-600">{{ data.unlogged_count }}</span>
        </template>
      </Column>
      <Column field="fact_hours" header="Факт (ч)" sortable style="width: 110px">
        <template #body="{ data }">{{ data.fact_hours }} ч</template>
      </Column>
      <Column field="last_log_date" header="Последний лог" style="width: 140px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400">{{ data.last_log_date ?? 'Нет логов' }}</span>
        </template>
      </Column>

      <!-- Раскрывающаяся строка с датами -->
      <template #expansion="{ data }">
        <div class="p-3 bg-orange-50">
          <p class="text-sm font-medium text-surface-700 mb-2">Незаполненные даты:</p>
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
        <div class="text-center py-8 text-green-600 font-medium">
          <i class="pi pi-check-circle text-2xl block mb-2" />
          Все сотрудники заполнили рабочее время за выбранный месяц
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useReportsStore } from '@/stores/reports.js';
import { useUiStore } from '@/stores/ui.js';
import { downloadBlob } from '@/utils/download.js';
import { storeToRefs } from 'pinia';

dayjs.locale('ru');
defineOptions({ name: 'UnloggedPage' });

const uiStore = useUiStore();
const reportsStore = useReportsStore();
const { unloggedUsers: users, unloggedLoading: loading, unloggedExporting: exporting } = storeToRefs(reportsStore);

const currentYear = ref(dayjs().year());
const currentMonth = ref(dayjs().month() + 1);
const expandedRows = ref([]);

const monthLabel = computed(() =>
  dayjs(`${currentYear.value}-${currentMonth.value}-01`).format('MMMM YYYY')
);

onMounted(() => { uiStore.setPageTitle('Незаполнившие дни'); loadReport(); });

function loadReport() {
  reportsStore.fetchUnlogged({ year: currentYear.value, month: currentMonth.value });
}

function prevMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).subtract(1, 'month');
  currentYear.value = d.year(); currentMonth.value = d.month() + 1;
  loadReport();
}

function nextMonth() {
  const d = dayjs(`${currentYear.value}-${currentMonth.value}-01`).add(1, 'month');
  currentYear.value = d.year(); currentMonth.value = d.month() + 1;
  loadReport();
}

async function doExport() {
  const blob = await reportsStore.exportUnlogged({ year: currentYear.value, month: currentMonth.value });
  if (blob) downloadBlob(blob, `unlogged_${currentYear.value}_${currentMonth.value}.xlsx`);
}
</script>
```

---

## Шаг 2. Глобальный обработчик JS-ошибок

`src/utils/errorLogger.js`:

```js
import http from '@/api/http.js';

export function setupErrorLogger() {
  // Необработанные JS-ошибки
  window.addEventListener('error', (event) => {
    sendError({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });

  // Unhandled Promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    sendError({
      message: event.reason?.message ?? String(event.reason),
      stack: event.reason?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });
}

async function sendError(data) {
  try {
    await http.post('/log-js-error', data);
  } catch {
    // Молча игнорируем — не ронять приложение при ошибке логирования
  }
}
```

Подключить в `main.js` после монтирования:

```js
import { setupErrorLogger } from '@/utils/errorLogger.js';

// После app.mount('#app'):
setupErrorLogger();
```

---

## Критерии приёмки

**Незаполнившие дни:**

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Страница в сайдбаре | Admin → в разделе «Администрирование» пункт «Незаполнившие дни» | ✅ выполнено |
| 2 | Таблица загружается | Сотрудники без логов за месяц отображаются | ✅ выполнено |
| 3 | Счётчик дней | `unlogged_count` оранжевым цветом | ✅ выполнено |
| 4 | Раскрытие строки | Клик по стрелке → список дат в оранжевом блоке | ✅ выполнено |
| 5 | Пустой список → успех | Все заполнили → зелёное сообщение с иконкой ✓ | ✅ выполнено |
| 6 | Навигация по месяцам | ← → перегружает данные | ✅ выполнено |
| 7 | Экспорт Excel | Скачивается файл | ✅ выполнено |

**JS Error Logger:**

| # | Проверка | Как проверить |
|---|----------|---------------|
| 8 | Ошибки уходят на бэк | `throw new Error('test')` в консоли → в `logs/error.log` запись |
| 9 | Promise rejection | `Promise.reject('test')` → в логах запись с message |
| 10 | Ошибка логгера не ронит приложение | Заблокировать сеть → ошибка тихо игнорируется |


РАССМОТРЕТЬ СОХРАНЕНИЕ В БД И ПРОСМОТР В ИНТЕРФЕЙСЕ
