<template>
  <div class="space-y-4">
    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button icon="pi pi-chevron-left" text rounded @click="prevMonth" />
          <h2 class="min-w-40 text-center text-xl font-semibold capitalize text-surface-800">
            {{ calendarStore.monthLabel }}
          </h2>
          <Button icon="pi pi-chevron-right" text rounded @click="nextMonth" />
        </div>
        <Tag v-if="isClosed" value="Месяц закрыт" severity="danger" icon="pi pi-lock" />
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="rounded-lg bg-surface-50 p-3 text-center">
          <p class="mb-1 text-xs text-surface-400">Норма</p>
          <p class="text-lg font-semibold text-surface-700">{{ calendarStore.normHours }} ч</p>
        </div>
        <div class="rounded-lg bg-surface-50 p-3 text-center">
          <p class="mb-1 text-xs text-surface-400">Факт</p>
          <p class="text-lg font-semibold text-surface-700">{{ factHours.toFixed(1) }} ч</p>
        </div>
        <div class="rounded-lg p-3 text-center" :class="deviationClass">
          <p class="mb-1 text-xs opacity-70">Отклонение</p>
          <p class="text-lg font-semibold">
            {{ deviation >= 0 ? '+' : '' }}{{ deviation.toFixed(1) }} ч
          </p>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-surface-200 bg-surface-0">
      <div class="grid grid-cols-7 border-b border-surface-200">
        <div
          v-for="day in weekDays"
          :key="day"
          class="py-2 text-center text-xs font-semibold uppercase text-surface-500"
        >
          {{ day }}
        </div>
      </div>

      <div class="grid grid-cols-7">
        <div
          v-for="_ in firstDayOffset"
          :key="'empty-' + _"
          class="min-h-16 border-b border-r border-surface-100"
        />

        <div
          v-for="day in calendarDays"
          :key="day.date"
          v-tooltip.top="getDayTooltip(day)"
          class="min-h-16 cursor-pointer border-b border-r border-surface-100 p-1.5 transition-all hover:opacity-80"
          :class="getDayClass(day)"
          @click="openDayDrawer(day)"
        >
          <div class="flex items-start justify-between">
            <span class="text-sm font-medium" :class="getDayNumberClass(day)">
              {{ day.dayNumber }}
            </span>
            <span v-if="dayMap[day.date]" class="text-right text-xs opacity-75">
              <span v-if="dayMap[day.date].workLogs.length">
                {{ dayMap[day.date].workLogs.length }} лог(ов)
              </span>
              <span v-if="dayMap[day.date].totalHours" class="block">
                {{ dayMap[day.date].totalHours.toFixed(1) }}ч
              </span>
            </span>
          </div>

          <div class="mt-1 space-y-0.5">
            <div
              v-for="log in (dayMap[day.date]?.workLogs ?? []).slice(0, 2)"
              :key="log.id"
              class="truncate rounded bg-green-100 px-1 text-xs text-green-700"
            >
              {{ log.project_name }}
            </div>
            <div
              v-for="abs in (dayMap[day.date]?.absences ?? []).slice(0, 1)"
              :key="abs.id"
              class="truncate rounded bg-blue-100 px-1 text-xs text-blue-700"
            >
              {{ ABSENCE_LABEL[abs.type] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-4 text-xs text-surface-500">
      <div class="flex items-center gap-1.5">
        <span class="block h-3 w-3 rounded bg-green-200" />
        Логи заполненные
      </div>
      <div class="flex items-center gap-1.5">
        <span class="block h-3 w-3 rounded bg-yellow-200" />
        Логи неполные
      </div>
      <div class="flex items-center gap-1.5">
        <span class="block h-3 w-3 rounded bg-blue-200" />
        Отсутствие
      </div>
      <div class="flex items-center gap-1.5">
        <span class="block h-3 w-3 rounded bg-surface-100" />
        Выходной
      </div>
    </div>

    <Drawer
      v-model:visible="drawerVisible"
      :header="selectedDay?.date ?? ''"
      position="right"
      class="w-full! max-w-md!"
    >
      <div v-if="selectedDay" class="space-y-4">
        <Tag
          v-if="selectedDay.day_type !== 'working'"
          :value="selectedDay.day_type === 'weekend' ? 'Выходной' : 'Праздник'"
          severity="secondary"
        />
        <Tag v-if="isClosed && !isAdmin" value="Месяц закрыт" severity="danger" />

        <div>
          <div class="mb-2 flex items-center justify-between">
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
              class="flex items-start justify-between rounded-lg border border-green-100 bg-green-50 p-3"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-surface-800">{{ log.project_name }}</p>
                <p class="text-xs text-surface-500">{{ log.task_number }} · {{ log.duration_hours }}ч</p>
                <p class="mt-0.5 truncate text-xs text-surface-400">{{ log.comment }}</p>
              </div>
              <Button
                v-if="canEdit"
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                @click="confirmDelete(log)"
              />
            </div>
          </div>
          <p v-else class="text-sm text-surface-400">Нет записей</p>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="font-medium text-surface-700">Отсутствия</h3>
            <Button
              v-if="canEdit && selectedDay.day_type === 'working'"
              label="Добавить"
              icon="pi pi-plus"
              size="small"
              text
              @click="openAddAbsence"
            />
          </div>
          <div v-if="dayMap[selectedDay.date]?.absences?.length" class="space-y-2">
            <div
              v-for="abs in dayMap[selectedDay.date].absences"
              :key="abs.id"
              class="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 p-3"
            >
              <div>
                <Tag :value="ABSENCE_LABEL[abs.type]" :severity="ABSENCE_SEVERITY[abs.type]" />
                <span class="ml-2 text-xs text-surface-500">{{ abs.duration_hours }}ч</span>
              </div>
              <Button
                v-if="canEdit"
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                @click="confirmDeleteAbsence(abs)"
              />
            </div>
          </div>
          <p v-else class="text-sm text-surface-400">Нет записей</p>
        </div>
      </div>
    </Drawer>

    <WorkLogFormDialog
      v-model="workLogDialogVisible"
      :initial-date="selectedDay?.date ?? null"
      :is-admin="isAdmin"
      :user-options="workLogUserOptions"
      :current-user-label="currentUserLabel"
      @saved="onWorkLogSaved"
    />

    <Dialog
      v-model:visible="absenceDialogVisible"
      header="Добавить отсутствие"
      modal
      class="w-full max-w-md"
    >
      <form class="space-y-4" @submit.prevent="onSubmitAbsence">
        <div v-if="isAdmin">
          <label for="calendar-absence-user" class="mb-1 block text-sm font-medium text-surface-700">
            Пользователь <span class="text-red-500">*</span>
          </label>
          <Select
            id="calendar-absence-user"
            v-model="absenceForm.user_id"
            :options="workLogUserOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите пользователя"
            class="w-full"
            :class="{ 'p-invalid': absenceErrors.user_id }"
          />
          <small v-if="absenceErrors.user_id" class="p-error">{{ absenceErrors.user_id }}</small>
        </div>
        <div v-else>
          <label for="calendar-absence-user-readonly" class="mb-1 block text-sm font-medium text-surface-700">
            Пользователь
          </label>
          <InputText
            id="calendar-absence-user-readonly"
            :model-value="currentUserLabel"
            class="w-full"
            disabled
          />
        </div>

        <div>
          <label for="calendar-absence-type" class="mb-1 block text-sm font-medium text-surface-700">
            Тип <span class="text-red-500">*</span>
          </label>
          <Select
            id="calendar-absence-type"
            v-model="absenceForm.type"
            :options="ABSENCE_TYPES"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите тип"
            class="w-full"
            :class="{ 'p-invalid': absenceErrors.type }"
          />
          <small v-if="absenceErrors.type" class="p-error">{{ absenceErrors.type }}</small>
        </div>

        <div>
          <label for="calendar-absence-date" class="mb-1 block text-sm font-medium text-surface-700">
            Дата <span class="text-red-500">*</span>
          </label>
          <DatePicker
            id="calendar-absence-date"
            v-model="absenceForm.date"
            class="w-full"
            dateFormat="dd.mm.yy"
            :class="{ 'p-invalid': absenceErrors.date }"
            placeholder="Выберите дату"
            showIcon
          />
          <small v-if="absenceErrors.date" class="p-error">{{ absenceErrors.date }}</small>
        </div>

        <div>
          <label for="calendar-absence-comment" class="mb-1 block text-sm font-medium text-surface-700">
            Комментарий
          </label>
          <Textarea
            id="calendar-absence-comment"
            v-model="absenceForm.comment"
            rows="2"
            class="w-full"
            placeholder="Необязательно"
          />
        </div>

        <Message v-if="absenceErrors.submit" severity="error" :closable="false" class="w-full">
          {{ absenceErrors.submit }}
        </Message>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="absenceDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="absenceSubmitting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import http from '@/api/http.js';
import WorkLogFormDialog from '@/components/WorkLogFormDialog.vue';
import { useCalendarData } from '@/composables/useCalendarData.js';
import { ABSENCE_LABEL, ABSENCE_SEVERITY, ABSENCE_TYPES } from '@/constants/absences.js';
import { useAbsencesStore } from '@/stores/absences.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useUiStore } from '@/stores/ui.js';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

dayjs.extend(isoWeek);
dayjs.locale('ru');

defineOptions({ name: 'CalendarPage' });

const confirm = useConfirm();
const toast = useToast();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const absencesStore = useAbsencesStore();

const { dayMap, factHours, fetchData } = useCalendarData();

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);
const canEdit = computed(() => isAdmin.value || !isClosed.value);

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

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

onMounted(async () => {
  uiStore.setPageTitle('Календарь');
  const y = calendarStore.currentYear;
  const m = calendarStore.currentMonth;
  await Promise.all([calendarStore.fetchMonth(y, m), fetchData(y, m)]);
  if (authStore.isAdmin) { absencesStore.fetchUsers(); }
});

async function prevMonth() {
  await calendarStore.prevMonth();
  await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
}

async function nextMonth() {
  await calendarStore.nextMonth();
  await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
}

const calendarDays = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const start = dayjs(`${year}-${month}-01`);
  const total = start.daysInMonth();
  const dayTypeMap = Object.fromEntries(calendarStore.days.map((d) => [d.date, d.day_type]));

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

const firstDayOffset = computed(() => {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  return dayjs(`${year}-${month}-01`).isoWeekday() - 1;
});

const deviation = computed(() => factHours.value - calendarStore.normHours);
const deviationClass = computed(() => {
  if (Math.abs(deviation.value) < 0.1) { return 'bg-green-50 text-green-700'; }
  return deviation.value > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700';
});

function getDayClass(day) {
  if (day.day_type !== 'working') { return 'bg-surface-50'; }
  const data = dayMap.value[day.date];
  if (!data) {
    return day.isFuture ? '' : 'bg-red-50';
  }
  if (data.absences.length > 0 && data.workLogs.length === 0) { return 'bg-blue-50'; }
  const h = data.totalHours ?? 0;
  if (h < 8) { return 'bg-yellow-50'; }
  if (Math.abs(h - 8) < 0.05) { return 'bg-green-50'; }
  if (h <= 12) { return 'bg-orange-200'; }
  return 'bg-red-200';
}

function getDayTooltip(day) {
  if (day.day_type !== 'working') { return 'Выходной'; }
  const data = dayMap.value[day.date];
  if (!data) { return 'Логи не добавлены'; }
  if (data.absences.length > 0 && data.workLogs.length === 0) { return 'Отсутствие'; }
  const h = data.totalHours ?? 0;
  if (h < 8) { return `Залогировано ${h.toFixed(1)} ч`; }
  if (h <= 12) { return `Превышение ${(h - 8).toFixed(1)} ч`; }
  return 'Проверьте логи, у вас залогировано много часов';
}

function getDayNumberClass(day) {
  if (day.isToday) { return 'text-primary font-bold'; }
  if (day.day_type !== 'working') { return 'text-surface-400'; }
  return 'text-surface-700';
}

const drawerVisible = ref(false);
const selectedDay = ref(null);
const workLogDialogVisible = ref(false);
const absenceDialogVisible = ref(false);
const absenceForm = reactive({ user_id: null, type: null, date: null, comment: '' });
const absenceErrors = reactive({});
const absenceSubmitting = ref(false);

function openDayDrawer(day) {
  selectedDay.value = day;
  drawerVisible.value = true;
}

function openAddWorkLog() {
  workLogDialogVisible.value = true;
}

function openAddAbsence() {
  Object.assign(absenceForm, { user_id: null, type: null, date: null, comment: '' });
  if (selectedDay.value) {
    absenceForm.date = new Date(selectedDay.value.date);
  }
  if (isAdmin.value && absencesStore.users.length === 0) {
    absencesStore.fetchUsers();
  }
  Object.keys(absenceErrors).forEach((key) => delete absenceErrors[key]);
  absenceDialogVisible.value = true;
}

async function onWorkLogSaved() {
  await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
}

async function onSubmitAbsence() {
  Object.keys(absenceErrors).forEach((key) => delete absenceErrors[key]);

  if (isAdmin.value && !absenceForm.user_id) {
    absenceErrors.user_id = 'Выберите пользователя';
    return;
  }
  if (!absenceForm.type) {
    absenceErrors.type = 'Выберите тип';
    return;
  }
  if (!absenceForm.date) {
    absenceErrors.date = 'Выберите дату';
    return;
  }

  absenceSubmitting.value = true;
  delete absenceErrors.submit;

  try {
    const dateStr = dayjs(absenceForm.date).format('YYYY-MM-DD');
    const body = {
      type: absenceForm.type,
      date_from: dateStr,
      date_to: dateStr,
      comment: absenceForm.comment || undefined,
    };
    if (isAdmin.value && absenceForm.user_id) {
      body.user_id = absenceForm.user_id;
    }
    await absencesStore.create(body);
    absenceDialogVisible.value = false;
    await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
    toast.add({ severity: 'success', summary: 'Создано', life: 3000 });
  } catch (err) {
    absenceErrors.submit = err.response?.data?.message ?? 'Ошибка создания';
  } finally {
    absenceSubmitting.value = false;
  }
}

function confirmDelete(log) {
  confirm.require({
    message: `Удалить лог «${log.project_name}»?`,
    header: 'Подтверждение',
    acceptSeverity: 'danger',
    acceptProps: { severity: 'danger' },
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await http.delete(`/work-logs/${log.id}`);
        await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}

function confirmDeleteAbsence(abs) {
  confirm.require({
    message: 'Удалить запись об отсутствии?',
    header: 'Подтверждение',
    acceptSeverity: 'danger',
    acceptProps: { severity: 'danger' },
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await absencesStore.remove(abs.id);
        await fetchData(calendarStore.currentYear, calendarStore.currentMonth);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
