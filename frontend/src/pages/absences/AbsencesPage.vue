<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Отсутствия</h1>
      <Button
        label="Добавить отсутствие"
        icon="pi pi-plus"
        :disabled="isClosed && !isAdmin"
        @click="openCreateDialog"
      />
    </div>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.type"
          :options="ABSENCE_TYPES"
          optionLabel="label"
          optionValue="value"
          placeholder="Все типы"
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
        <div />
        <div />
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Найти" icon="pi pi-search" size="small" @click="loadAbsences" />
        <Button label="Сбросить" severity="secondary" size="small" @click="resetFilters" />
      </div>
    </div>

    <DataTable
      :value="preparedAbsences"
      :loading="loading"
      paginator
      :rows="20"
      stripedRows
      class="overflow-hidden rounded-xl border border-surface-200"
    >
      <Column field="user" header="Пользователь" sortable style="width: 12%">
        <template #body="{ data }">
          {{ data.userNameText }}
        </template>
      </Column>
      <Column field="date" header="Дата" sortable style="width: 12%">
        <template #body="{ data }">
          {{ data.dateText }}
        </template>
      </Column>
      <Column field="type" header="Тип" style="width: 12%">
        <template #body="{ data }">
          <Tag
            :value="ABSENCE_LABEL[data.type]"
            :severity="ABSENCE_SEVERITY[data.type]"
          />
        </template>
      </Column>
      <Column field="duration_hours" header="Длительность (ч)" style="width: 12%">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
      </Column>
      <Column field="comment" header="Комментарий" style="width: 24%" />
      <Column header="" style="width: 100px">
        <template #body="{ data }">
          <div class="flex justify-end gap-1">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              :disabled="isClosed && !isAdmin"
              @click="openEditDialog(data)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :disabled="isClosed && !isAdmin"
              @click="confirmDelete(data)"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <EmptyState
          icon="pi pi-calendar-times"
          title="Записи не найдены"
          description="Добавьте отсутствие или измените фильтры"
        />
      </template>
    </DataTable>

    <AbsenceCreateDialog
      v-model="createDialogVisible"
      :isAdmin="isAdmin"
      :userOptions="userOptions"
      :usersLoading="usersLoading"
      :currentUserLabel="currentUserLabel"
      :submitting="submitting"
      @submit="handleCreateSubmit"
      @cancel="handleCreateCancel"
    />

    <AbsenceEditDialog
      v-model="editDialogVisible"
      :absence="editingAbsence"
      :submitting="submitting"
      @submit="handleEditSubmit"
      @cancel="handleEditCancel"
    />
  </div>
</template>

<script setup>
import dayjs from 'dayjs';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

import EmptyState from '@/components/EmptyState.vue';
import { ABSENCE_LABEL, ABSENCE_SEVERITY, ABSENCE_TYPES } from '@/constants/absences.js';
import AbsenceCreateDialog from '@/pages/absences/components/AbsenceCreateDialog.vue';
import AbsenceEditDialog from '@/pages/absences/components/AbsenceEditDialog.vue';
import { useAbsencesStore } from '@/stores/absences.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useUiStore } from '@/stores/ui.js';

defineOptions({ name: 'AbsencesPage' });

const confirm = useConfirm();
const toast = useToast();
const absencesStore = useAbsencesStore();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

const filters = reactive({ type: null, dateRange: null });

const absences = computed(() => absencesStore.list);
const preparedAbsences = computed(() =>
  (absences.value ?? []).map((absence) => ({
    ...absence,
    userNameText: [absence.first_name, absence.last_name].filter(Boolean).join(' ') || '—',
    dateText: absence.date ? dayjs(absence.date).format('DD.MM.YYYY') : '—',
  })),
);
const loading = computed(() => absencesStore.loading);
const users = computed(() => absencesStore.users);
const usersLoading = computed(() => absencesStore.usersLoading);

const userOptions = computed(() =>
  users.value.map((user) => ({
    value: user.id,
    label: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.id,
  })),
);
const currentUserLabel = computed(() => {
  const me = authStore.user;
  if (!me) { return '—'; }
  return [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email || '—';
});

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);

function getTypeFilterValue() {
  const type = filters.type;
  if (type === null || type === undefined) { return undefined; }
  if (typeof type === 'object' && type !== null && 'value' in type) { return type.value; }
  return typeof type === 'string' ? type : undefined;
}

function getListParams() {
  const params = {};
  const typeValue = getTypeFilterValue();
  if (typeValue) { params.type = typeValue; }
  if (filters.dateRange?.[0]) { params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD'); }
  if (filters.dateRange?.[1]) { params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD'); }
  return params;
}

function loadAbsences() {
  absencesStore.fetchList(getListParams());
}

function resetFilters() {
  Object.assign(filters, { type: null, dateRange: null });
  loadAbsences();
}

onMounted(() => {
  uiStore.setPageTitle('Отсутствия');
  if (authStore.isAdmin) { absencesStore.fetchUsers(); }
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  if (year && month) {
    const start = dayjs(`${year}-${month}-01`);
    filters.dateRange = [start.toDate(), start.endOf('month').toDate()];
  }
  loadAbsences();
});

const createDialogVisible = ref(false);
const editDialogVisible = ref(false);
const submitting = ref(false);
const editingAbsence = ref(null);

function openCreateDialog() {
  if (isAdmin.value && users.value.length === 0) { absencesStore.fetchUsers(); }
  createDialogVisible.value = true;
}

function handleCreateCancel() {
  createDialogVisible.value = false;
}

async function handleCreateSubmit(payload) {
  submitting.value = true;
  try {
    await absencesStore.create(payload);
    createDialogVisible.value = false;
    loadAbsences();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: err.response?.data?.message ?? 'Ошибка создания',
      life: 5000,
    });
  } finally {
    submitting.value = false;
  }
}

function openEditDialog(absence) {
  editingAbsence.value = absence;
  editDialogVisible.value = true;
}

function handleEditCancel() {
  editingAbsence.value = null;
  editDialogVisible.value = false;
}

async function handleEditSubmit(payload) {
  if (!editingAbsence.value) { return; }
  submitting.value = true;
  try {
    await absencesStore.update(editingAbsence.value.id, payload);
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    editingAbsence.value = null;
    loadAbsences();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: err.response?.data?.message ?? 'Ошибка сохранения',
      life: 5000,
    });
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(absence) {
  confirm.require({
    message: `Удалить запись об отсутствии за ${absence.date}?`,
    header: 'Подтверждение',
    icon: 'pi pi-trash',
    acceptSeverity: 'danger',
    acceptProps: { severity: 'danger' },
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await absencesStore.remove(absence.id);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
        loadAbsences();
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
