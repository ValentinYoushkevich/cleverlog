# MODULE_7 — Frontend: Календарь пользователя

## Обзор

Страница `/calendar` — кастомная месячная сетка. Цветовая индикация дней: зелёный (Work Logs), синий (Absence), красный (рабочий без записей), серый (выходной). По клику на день — Drawer со списком записей и формами добавления. Шапка с нормой/фактом/отклонением/статусом месяца. Блокировка при закрытом месяце для User.

> **Зависимости модуля:**
> - `useCalendarStore` из MODULE_2 — `days`, `normHours`, `isClosed`, `fetchMonth`
> - `useAuthStore` из MODULE_2 — `isAdmin`
> - API work-logs и absences из MODULE_5 и MODULE_6
> - `ABSENCE_LABEL` из MODULE_6

---

## Шаг 1. API

`src/api/calendar.js` — дополнить:

```js
getUserCalendarData: (year, month) => http.get('/work-logs', {
  params: { date_from: `${year}-${String(month).padStart(2, '0')}-01`, date_to: `${year}-${String(month).padStart(2, '0')}-31`, limit: 500 }
}),
```

---

## Шаг 2. Composable: данные месяца для календаря

`src/composables/useCalendarData.js`:

```js
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import { workLogsApi } from '@/api/workLogs.js';
import { absencesApi } from '@/api/absences.js';

export function useCalendarData() {
  const workLogs = ref([]);
  const absences = ref([]);
  const loading = ref(false);

  async function fetchData(year, month) {
    loading.value = true;
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');
    try {
      const [wlRes, absRes] = await Promise.all([
        workLogsApi.list({ date_from: dateFrom, date_to: dateTo, limit: 500 }),
        absencesApi.list({ date_from: dateFrom, date_to: dateTo, limit: 500 }),
      ]);
      workLogs.value = wlRes.data.data ?? wlRes.data;
      absences.value = absRes.data.data ?? absRes.data;
    } finally {
      loading.value = false;
    }
  }

  // Карта: дата → { workLogs, absences, totalHours }
  const dayMap = computed(() => {
    const map = {};
    for (const log of workLogs.value) {
      if (!map[log.date]) map[log.date] = { workLogs: [], absences: [], totalHours: 0 };
      map[log.date].workLogs.push(log);
      map[log.date].totalHours += log.duration_hours;
    }
    for (const abs of absences.value) {
      if (!map[abs.date]) map[abs.date] = { workLogs: [], absences: [], totalHours: 0 };
      map[abs.date].absences.push(abs);
      map[abs.date].totalHours += abs.duration_hours;
    }
    return map;
  });

  const factHours = computed(() =>
    [...workLogs.value, ...absences.value].reduce((s, l) => s + (l.duration_hours ?? 0), 0)
  );

  return { workLogs, absences, dayMap, factHours, loading, fetchData };
}
```

---

## Шаг 3. CalendarPage

`src/pages/CalendarPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <!-- Шапка: навигация и статистика -->
    <div class="bg-surface-0 rounded-xl border border-surface-200 p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
          <h2 class="text-xl font-semibold text-surface-800 capitalize min-w-40 text-center">
            {{ calendarStore.monthLabel }}
          </h2>
          <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
        </div>
        <Tag v-if="isClosed" value="Месяц закрыт" severity="danger" icon="pi pi-lock" />
      </div>

      <!-- Норма / Факт / Отклонение -->
      <div class="grid grid-cols-3 gap-4">
        <div class="text-center p-3 bg-surface-50 rounded-lg">
          <p class="text-xs text-surface-400 mb-1">Норма</p>
          <p class="text-lg font-semibold text-surface-700">{{ calendarStore.normHours }} ч</p>
        </div>
        <div class="text-center p-3 bg-surface-50 rounded-lg">
          <p class="text-xs text-surface-400 mb-1">Факт</p>
          <p class="text-lg font-semibold text-surface-700">{{ factHours.toFixed(1) }} ч</p>
        </div>
        <div class="text-center p-3 rounded-lg" :class="deviationClass">
          <p class="text-xs mb-1 opacity-70">Отклонение</p>
          <p class="text-lg font-semibold">
            {{ deviation >= 0 ? '+' : '' }}{{ deviation.toFixed(1) }} ч
          </p>
        </div>
      </div>
    </div>

    <!-- Сетка календаря -->
    <div class="bg-surface-0 rounded-xl border border-surface-200 overflow-hidden">
      <!-- Заголовки дней недели -->
      <div class="grid grid-cols-7 border-b border-surface-200">
        <div
          v-for="day in weekDays"
          :key="day"
          class="py-2 text-center text-xs font-semibold text-surface-500 uppercase"
        >
          {{ day }}
        </div>
      </div>

      <!-- Дни -->
      <div class="grid grid-cols-7">
        <!-- Пустые ячейки до первого дня -->
        <div v-for="_ in firstDayOffset" :key="'empty-' + _" class="min-h-16 border-b border-r border-surface-100" />

        <!-- Дни месяца -->
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="min-h-16 border-b border-r border-surface-100 p-1.5 cursor-pointer transition-all hover:opacity-80"
          :class="getDayClass(day)"
          @click="openDayDrawer(day)"
        >
          <div class="flex items-start justify-between">
            <span class="text-sm font-medium" :class="getDayNumberClass(day)">
              {{ day.dayNumber }}
            </span>
            <span v-if="dayMap[day.date]?.totalHours" class="text-xs opacity-75">
              {{ dayMap[day.date].totalHours.toFixed(1) }}ч
            </span>
          </div>

          <!-- Индикаторы записей -->
          <div class="mt-1 space-y-0.5">
            <div
              v-for="log in (dayMap[day.date]?.workLogs ?? []).slice(0, 2)"
              :key="log.id"
              class="text-xs truncate px-1 rounded bg-green-100 text-green-700"
            >
              {{ log.project_name }}
            </div>
            <div
              v-for="abs in (dayMap[day.date]?.absences ?? []).slice(0, 1)"
              :key="abs.id"
              class="text-xs truncate px-1 rounded bg-blue-100 text-blue-700"
            >
              {{ ABSENCE_LABEL[abs.type] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Легенда -->
    <div class="flex gap-4 text-xs text-surface-500">
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-200 block" />Есть логи</div>
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-200 block" />Отсутствие</div>
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-100 block" />Незаполнен</div>
      <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-surface-100 block" />Выходной</div>
    </div>

    <!-- Drawer: клик на день -->
    <Drawer
      v-model:visible="drawerVisible"
      :header="selectedDay?.date ?? ''"
      position="right"
      class="!w-full !max-w-md"
    >
      <div v-if="selectedDay" class="space-y-4">
        <!-- Статус дня -->
        <Tag
          v-if="selectedDay.day_type !== 'working'"
          :value="selectedDay.day_type === 'weekend' ? 'Выходной' : 'Праздник'"
          severity="secondary"
        />
        <Tag v-if="isClosed && !isAdmin" value="Месяц закрыт" severity="danger" />

        <!-- Work Logs -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-surface-700">Рабочие логи</h3>
            <Button
              v-if="canEdit && selectedDay.day_type === 'working'"
              label="Добавить"
              icon="pi pi-plus"
              size="small"
              text
              @click="openAddWorkLog"
            />
          </div>
          <div v-if="dayMap[selectedDay.date]?.workLogs?.length" class="space-y-2">
            <div
              v-for="log in dayMap[selectedDay.date].workLogs"
              :key="log.id"
              class="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-100"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-surface-800 truncate">{{ log.project_name }}</p>
                <p class="text-xs text-surface-500">{{ log.task_number }} · {{ log.duration_hours }}ч</p>
                <p class="text-xs text-surface-400 truncate mt-0.5">{{ log.comment }}</p>
              </div>
              <Button
                v-if="canEdit"
                icon="pi pi-trash"
                text rounded size="small"
                severity="danger"
                @click="confirmDeleteLog(log)"
              />
            </div>
          </div>
          <p v-else class="text-sm text-surface-400">Нет записей</p>
        </div>

        <!-- Absences -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-surface-700">Отсутствия</h3>
          </div>
          <div v-if="dayMap[selectedDay.date]?.absences?.length" class="space-y-2">
            <div
              v-for="abs in dayMap[selectedDay.date].absences"
              :key="abs.id"
              class="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
            >
              <div>
                <Tag :value="ABSENCE_LABEL[abs.type]" :severity="ABSENCE_SEVERITY[abs.type]" />
                <span class="ml-2 text-xs text-surface-500">{{ abs.duration_hours }}ч</span>
              </div>
              <Button
                v-if="canEdit"
                icon="pi pi-trash"
                text rounded size="small"
                severity="danger"
                @click="confirmDeleteAbsence(abs)"
              />
            </div>
          </div>
          <p v-else class="text-sm text-surface-400">Нет записей</p>
        </div>
      </div>
    </Drawer>

    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Drawer from 'primevue/drawer';
import ConfirmDialog from 'primevue/confirmdialog';
import { useCalendarStore } from '@/stores/calendar.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { useCalendarData } from '@/composables/useCalendarData.js';
import { workLogsApi } from '@/api/workLogs.js';
import { absencesApi } from '@/api/absences.js';
import { ABSENCE_LABEL, ABSENCE_SEVERITY } from '@/constants/absences.js';

dayjs.extend(isoWeek);
dayjs.locale('ru');

defineOptions({ name: 'CalendarPage' });

const confirm = useConfirm();
const toast = useToast();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

const { dayMap, factHours, fetchData } = useCalendarData();

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);
const canEdit = computed(() => isAdmin.value || !isClosed.value);

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

onMounted(async () => {
  uiStore.setPageTitle('Календарь');
  const y = calendarStore.currentYear;
  const m = calendarStore.currentMonth;
  await Promise.all([calendarStore.fetchMonth(y, m), fetchData(y, m)]);
});

async function prevMonth() {
  calendarStore.prevMonth();
  await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
}

async function nextMonth() {
  calendarStore.nextMonth();
  await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
}

// Построение сетки
const calendarDays = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const start = dayjs(`${year}-${month}-01`);
  const total = start.daysInMonth();
  const dayTypeMap = Object.fromEntries(calendarStore.days.map(d => [d.date, d.day_type]));

  return Array.from({ length: total }, (_, i) => {
    const date = start.date(i + 1);
    const dateStr = date.format('YYYY-MM-DD');
    return {
      date: dateStr,
      dayNumber: i + 1,
      day_type: dayTypeMap[dateStr] ?? (date.isoWeekday() >= 6 ? 'weekend' : 'working'),
      isToday: dateStr === dayjs().format('YYYY-MM-DD'),
      isFuture: date.isAfter(dayjs(), 'day'),
    };
  });
});

// Отступ до первого дня (ISO: пн=1)
const firstDayOffset = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  return dayjs(`${year}-${month}-01`).isoWeekday() - 1;
});

// Отклонение
const deviation = computed(() => factHours.value - calendarStore.normHours);
const deviationClass = computed(() => {
  if (Math.abs(deviation.value) < 0.1) return 'bg-green-50 text-green-700';
  return deviation.value > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700';
});

// Цвет дня
function getDayClass(day) {
  if (day.day_type !== 'working') return 'bg-surface-50';
  const data = dayMap.value[day.date];
  if (!data) {
    return day.isFuture ? '' : 'bg-red-50';
  }
  if (data.absences.length > 0 && data.workLogs.length === 0) return 'bg-blue-50';
  return 'bg-green-50';
}

function getDayNumberClass(day) {
  if (day.isToday) return 'text-primary font-bold';
  if (day.day_type !== 'working') return 'text-surface-400';
  return 'text-surface-700';
}

// Drawer
const drawerVisible = ref(false);
const selectedDay = ref(null);

function openDayDrawer(day) {
  selectedDay.value = day;
  drawerVisible.value = true;
}

function openAddWorkLog() {
  // TODO: открыть форму создания Work Log с предзаполненной датой
  // Можно использовать router.push с query-параметром или emit
  toast.add({ severity: 'info', summary: 'Перейдите на страницу Рабочие логи', life: 3000 });
}

async function confirmDeleteLog(log) {
  confirm.require({
    message: `Удалить лог «${log.project_name}»?`,
    header: 'Подтверждение',
    acceptSeverity: 'danger',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await workLogsApi.remove(log.id);
        await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}

async function confirmDeleteAbsence(abs) {
  confirm.require({
    message: 'Удалить запись об отсутствии?',
    header: 'Подтверждение',
    acceptSeverity: 'danger',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await absencesApi.remove(abs.id);
        await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Сетка рендерится | `/calendar` → корректная сетка 7 колонок, первый день в правильной позиции |
| 2 | Зелёные дни | Дни с Work Logs подсвечены зелёным |
| 3 | Синие дни | Дни с Absence (без Work Logs) — синие |
| 4 | Красные дни | Прошедшие рабочие дни без записей — красные |
| 5 | Серые дни | Выходные — светло-серые |
| 6 | Норма/Факт/Отклонение | В шапке корректные значения из API |
| 7 | Навигация по месяцам | Кнопки ← → меняют месяц, данные перезагружаются |
| 8 | Клик на день → Drawer | Drawer открывается с записями за день |
| 9 | Удаление лога из Drawer | ConfirmDialog → подтвердить → лог удалён, день перекрасился |
| 10 | Закрытый месяц | `isClosed = true`, User → кнопки в Drawer disabled/скрыты |
| 11 | Сегодняшний день | Число выделено цветом primary |
