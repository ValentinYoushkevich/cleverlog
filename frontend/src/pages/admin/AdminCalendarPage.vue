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
          <div class="flex items-center gap-3">
            <InputNumber
              v-model="normValue"
              :min="1"
              :max="400"
              class="w-24 shrink-0 h-[35px]"
              inputClass="!w-20 text-sm"
              :disabled="savingNorm"
            />
            <Button
              label="Сохранить"
              size="small"
              :loading="savingNorm"
              class="shrink-0"
              :disabled="normValue === originalNorm"
              @click="saveNorm"
            />
          </div>
        </div>
      </div>

      <!-- Легенда -->
      <div class="flex gap-4 text-xs text-surface-500">
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-surface-100 block" />
          Рабочий (по умолчанию)
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-gray-200 block" />
          Выходной
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-red-100 block" />
          Праздник
        </div>

      </div>
    </div>

    <!-- Сетка -->
    <div class="bg-surface-0 rounded-xl border border-surface-200 overflow-hidden">
      <div class="grid grid-cols-7 border-b border-surface-200">
        <div
          v-for="day in weekDays"
          :key="day"
          class="py-2 text-center text-xs font-semibold text-surface-500 uppercase"
        >
          {{ day }}
        </div>
      </div>

      <div class="grid grid-cols-7">
        <div
          v-for="offset in firstDayOffset"
          :key="'e' + offset"
          class="min-h-16 border-b border-r border-surface-100"
        />

        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="min-h-16 border-b border-r border-surface-100 p-2 cursor-pointer hover:opacity-80 transition-all relative"
          :class="getDayClass(day)"
          @click="openDayPopover($event, day)"
        >
          <span
            class="text-sm font-medium"
            :class="getDayNumberTextClass(day)"
          >
            {{ day.dayNumber }}
          </span>
          <div
            v-if="day.isOverride"
            class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary"
          />
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
            :class="getDayTypeOptionClass(opt.value)"
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
import { useAdminCalendarStore } from '@/stores/adminCalendar.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { useToast } from 'primevue/usetoast';

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

function getDayNumberTextClass(day) {
  return day?.isOverride ? 'text-primary font-bold' : 'text-surface-700';
}

function getDayTypeOptionClass(dayType) {
  return selectedDay.value?.day_type === dayType
    ? 'bg-primary-50 text-primary font-medium'
    : 'text-surface-700';
}

const normValue = ref(168);
const originalNorm = ref(168);
const savingNorm = ref(false);

onMounted(async () => {
  uiStore.setPageTitle('Управление календарём');
  await loadMonth();
});

const monthLabel = computed(() =>
  dayjs(`${calendarStore.currentYear}-${calendarStore.currentMonth}-01`).format('MMMM YYYY'),
);

async function loadMonth() {
  const y = calendarStore.currentYear;
  const m = calendarStore.currentMonth;
  await calendarStore.fetchMonth(y, m);
  const workingDays = calendarStore.days.filter((d) => d.day_type === 'working').length;
  const autoNorm = workingDays * 8;
  const backendNorm = Number(calendarStore.normHours ?? 0) || autoNorm;
  let effectiveNorm = autoNorm;
  if (backendNorm !== autoNorm) {
    effectiveNorm = backendNorm;
  }
  normValue.value = effectiveNorm;
  originalNorm.value = effectiveNorm;
}

async function prevMonth() {
  await calendarStore.prevMonth();
  await loadMonth();
}

async function nextMonth() {
  await calendarStore.nextMonth();
  await loadMonth();
}

// Сетка
const overrideMap = computed(() =>
  Object.fromEntries(calendarStore.days.map((d) => [d.date, d.day_type])),
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
  if (day.day_type === 'holiday') { return 'bg-red-50'; }
  if (day.day_type === 'weekend') { return 'bg-gray-50'; }
  return '';
}

function getDayTypeTextClass(day) {
  if (day.day_type === 'holiday') { return 'text-red-400'; }
  if (day.day_type === 'weekend') { return 'text-surface-400'; }
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
  if (!selectedDay.value) { return; }
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
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const maxHours = daysInMonth * 24;

  if (normValue.value > maxHours) {
    toast.add({
      severity: 'warn',
      summary: 'Некорректная норма',
      detail: `Максимальное значение для этого месяца — ${maxHours} часов`,
      life: 4000,
    });
    return;
  }

  savingNorm.value = true;
  try {
    await adminCalendarStore.updateNorm(year, month, normValue.value);
    originalNorm.value = normValue.value;
    await calendarStore.fetchMonth(year, month);
    toast.add({ severity: 'success', summary: 'Норма обновлена', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
  } finally {
    savingNorm.value = false;
  }
}
</script>
