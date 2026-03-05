# MODULE_14 — Frontend: Административный календарь

## Обзор

Страница `/admin/calendar` — управление нормой часов на месяц и переопределение статусов дней (рабочий / выходной / праздник). Кликабельная сетка: клик на день → Popover со сменой типа. Норма редактируется инлайн в шапке.

> **Зависимости модуля:**
> - `useCalendarStore` из MODULE_2 — `fetchMonth`, `days`, `normHours`
> - Паттерн сетки из MODULE_7 — переиспользуем структуру `calendarDays` и `firstDayOffset`

---

## Шаг 1. Store adminCalendar

Стор для страницы Административный календарь (`AdminCalendarPage`) — вызовы API в сторе, обёрнуты в try/catch.

`src/stores/adminCalendar.js`:

```js
import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useAdminCalendarStore = defineStore('adminCalendar', {
  actions: {
    async updateDay(date, day_type) {
      try {
        await http.patch(`/calendar/days/${date}`, { day_type });
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateNorm(year, month, norm_hours) {
      try {
        await http.put(`/calendar/norm/${year}/${month}`, { norm_hours });
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getNorm(year, month) {
      try {
        const res = await http.get(`/calendar/norm/${year}/${month}`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
```

---

## Шаг 2. AdminCalendarPage

`src/pages/admin/AdminCalendarPage.vue`:

```vue
<template>
  <div class="space-y-4">
    <!-- Шапка: навигация + норма -->
    <div class="bg-surface-0 rounded-xl border border-surface-200 p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
          <h2 class="text-xl font-semibold text-surface-800 capitalize min-w-40 text-center">
            {{ monthLabel }}
          </h2>
          <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
        </div>

        <!-- Редактирование нормы -->
        <div class="flex items-center gap-3">
          <span class="text-sm text-surface-500">Норма часов:</span>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="normValue"
              :min="1"
              :max="400"
              class="w-28"
              :disabled="savingNorm"
            />
            <Button
              label="Сохранить"
              size="small"
              :loading="savingNorm"
              @click="saveNorm"
              :disabled="normValue === originalNorm"
            />
          </div>
        </div>
      </div>

      <!-- Легенда -->
      <div class="flex gap-4 text-xs text-surface-500">
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-surface-100 block" />Рабочий (по умолчанию)</div>
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-gray-200 block" />Выходной</div>
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-100 block" />Праздник</div>
      </div>
    </div>

    <!-- Сетка -->
    <div class="bg-surface-0 rounded-xl border border-surface-200 overflow-hidden">
      <div class="grid grid-cols-7 border-b border-surface-200">
        <div v-for="day in weekDays" :key="day" class="py-2 text-center text-xs font-semibold text-surface-500 uppercase">
          {{ day }}
        </div>
      </div>

      <div class="grid grid-cols-7">
        <div v-for="_ in firstDayOffset" :key="'e' + _" class="min-h-16 border-b border-r border-surface-100" />

        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="min-h-16 border-b border-r border-surface-100 p-2 cursor-pointer hover:opacity-80 transition-all relative"
          :class="getDayClass(day)"
          @click="openDayPopover($event, day)"
        >
          <span
            class="text-sm font-medium"
            :class="day.isOverride ? 'text-primary font-bold' : 'text-surface-700'"
          >
            {{ day.dayNumber }}
          </span>
          <div v-if="day.isOverride" class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          <p class="text-xs mt-1" :class="getDayTypeTextClass(day)">
            {{ DAY_TYPE_LABEL[day.day_type] }}
          </p>
        </div>
      </div>
    </div>

    <!-- Popover: смена типа дня -->
    <Popover ref="popoverRef">
      <div v-if="selectedDay" class="p-2 w-48">
        <p class="text-sm font-medium text-surface-700 mb-3">{{ selectedDay.date }}</p>
        <div class="space-y-1">
          <button
            v-for="opt in DAY_TYPE_OPTIONS"
            :key="opt.value"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-surface-100 transition-colors text-left"
            :class="selectedDay.day_type === opt.value ? 'bg-primary-50 text-primary font-medium' : 'text-surface-700'"
            @click="setDayType(opt.value)"
          >
            <span class="w-3 h-3 rounded block shrink-0" :class="opt.colorClass" />
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Popover from 'primevue/popover';
import { useAdminCalendarStore } from '@/stores/adminCalendar.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useUiStore } from '@/stores/ui.js';

dayjs.extend(isoWeek);
dayjs.locale('ru');
defineOptions({ name: 'AdminCalendarPage' });

const toast = useToast();
const calendarStore = useCalendarStore();
const adminCalendarStore = useAdminCalendarStore();
const uiStore = useUiStore();

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const DAY_TYPE_LABEL = { working: 'Рабочий', weekend: 'Выходной', holiday: 'Праздник' };
const DAY_TYPE_OPTIONS = [
  { value: 'working', label: 'Рабочий', colorClass: 'bg-surface-200' },
  { value: 'weekend', label: 'Выходной', colorClass: 'bg-gray-300' },
  { value: 'holiday', label: 'Праздник', colorClass: 'bg-red-200' },
];

const normValue = ref(168);
const originalNorm = ref(168);
const savingNorm = ref(false);

onMounted(async () => {
  uiStore.setPageTitle('Управление календарём');
  await loadMonth();
});

const monthLabel = computed(() =>
  dayjs(`${calendarStore.currentYear}-${calendarStore.currentMonth}-01`).format('MMMM YYYY')
);

async function loadMonth() {
  const y = calendarStore.currentYear;
  const m = calendarStore.currentMonth;
  await calendarStore.fetchMonth(y, m);
  normValue.value = calendarStore.normHours;
  originalNorm.value = calendarStore.normHours;
}

async function prevMonth() { calendarStore.prevMonth(); await loadMonth(); }
async function nextMonth() { calendarStore.nextMonth(); await loadMonth(); }

// Сетка
const overrideMap = computed(() =>
  Object.fromEntries(calendarStore.days.map(d => [d.date, d.day_type]))
);

const calendarDays = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const start = dayjs(`${year}-${month}-01`);
  const total = start.daysInMonth();

  return Array.from({ length: total }, (_, i) => {
    const date = start.date(i + 1);
    const dateStr = date.format('YYYY-MM-DD');
    const defaultType = date.isoWeekday() >= 6 ? 'weekend' : 'working';
    const isOverride = dateStr in overrideMap.value;
    const day_type = overrideMap.value[dateStr] ?? defaultType;
    return {
      date: dateStr,
      dayNumber: i + 1,
      day_type,
      isOverride,
      isToday: dateStr === dayjs().format('YYYY-MM-DD'),
    };
  });
});

const firstDayOffset = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  return dayjs(`${year}-${month}-01`).isoWeekday() - 1;
});

function getDayClass(day) {
  if (day.day_type === 'holiday') return 'bg-red-50';
  if (day.day_type === 'weekend') return 'bg-gray-50';
  return '';
}

function getDayTypeTextClass(day) {
  if (day.day_type === 'holiday') return 'text-red-400';
  if (day.day_type === 'weekend') return 'text-surface-400';
  return 'text-green-500';
}

// Popover
const popoverRef = ref(null);
const selectedDay = ref(null);

function openDayPopover(event, day) {
  selectedDay.value = day;
  popoverRef.value.toggle(event);
}

async function setDayType(type) {
  if (!selectedDay.value) return;
  popoverRef.value.hide();
  try {
    await adminCalendarStore.updateDay(selectedDay.value.date, type);
    await calendarStore.fetchMonth(calendarStore.currentYear, calendarStore.currentMonth);
    toast.add({ severity: 'success', summary: 'Тип дня обновлён', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка обновления', life: 3000 });
  }
}

// Норма
async function saveNorm() {
  savingNorm.value = true;
  try {
    await adminCalendarStore.updateNorm(calendarStore.currentYear, calendarStore.currentMonth, normValue.value);
    originalNorm.value = normValue.value;
    await calendarStore.fetchMonth(calendarStore.currentYear, calendarStore.currentMonth);
    toast.add({ severity: 'success', summary: 'Норма обновлена', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally {
    savingNorm.value = false;
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Сетка рендерится корректно | Первый день в правильной колонке недели |
| 2 | Выходные серые по умолчанию | Сб/Вс имеют `bg-gray-50` без каких-либо переопределений |
| 3 | Клик → Popover | Клик на день → Popover с тремя опциями типа |
| 4 | Смена типа дня | Рабочий → Праздник → сетка обновилась, день красный |
| 5 | Индикатор переопределения | Переопределённый день — точка primary в углу |
| 6 | Норма отображается | InputNumber заполнен текущей нормой из API |
| 7 | Кнопка «Сохранить» disabled | Пока норма не изменена → кнопка disabled |
| 8 | Сохранение нормы | Изменить значение → «Сохранить» → Toast + норма сохранена |
| 9 | Навигация по месяцам | ← → переключает, переопределения корректно обновляются |
| 10 | Изменения видны в USER-календаре | После смены праздника → в MODULE_7 день перекрашен |
