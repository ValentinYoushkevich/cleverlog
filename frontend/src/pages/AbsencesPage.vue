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
      <div class="grid grid-cols-3 gap-3">
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
          placeholder="Период"
          class="w-full"
          showIcon
        />
        <div class="flex gap-2">
          <Button label="Найти" icon="pi pi-search" class="flex-1" @click="loadAbsences" />
          <Button label="Сбросить" severity="secondary" class="flex-1" @click="resetFilters" />
        </div>
      </div>
    </div>

    <DataTable
      :value="absences"
      :loading="loading"
      paginator
      :rows="20"
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
        <div class="py-8 text-center text-surface-400">Записи не найдены</div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="createDialogVisible"
      header="Добавить отсутствие"
      modal
      class="w-full max-w-md"
    >
      <form class="space-y-4" @submit.prevent="onSubmitCreate">
        <div v-if="isAdmin">
          <label for="absence-create-user" class="mb-1 block text-sm font-medium text-surface-700">
            Пользователь *
          </label>
          <Select
            id="absence-create-user"
            v-model="createForm.user_id"
            :options="userOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите пользователя"
            class="w-full"
            :class="{ 'p-invalid': createErrors.user_id }"
            :loading="usersLoading"
          />
          <small v-if="createErrors.user_id" class="p-error">{{ createErrors.user_id }}</small>
        </div>
        <div v-else>
          <label for="absence-create-user-readonly" class="mb-1 block text-sm font-medium text-surface-700">
            Пользователь
          </label>
          <InputText id="absence-create-user-readonly" :model-value="currentUserLabel" class="w-full" disabled />
        </div>
        <div>
          <label for="absence-create-type" class="mb-1 block text-sm font-medium text-surface-700">
            Тип *
          </label>
          <Select
            id="absence-create-type"
            v-model="createForm.type"
            :options="ABSENCE_TYPES"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите тип"
            class="w-full"
            :class="{ 'p-invalid': createErrors.type }"
          />
          <small v-if="createErrors.type" class="p-error">{{ createErrors.type }}</small>
        </div>

        <div>
          <label for="absence-create-range" class="mb-1 block text-sm font-medium text-surface-700">
            Период *
          </label>
          <DatePicker
            id="absence-create-range"
            v-model="createForm.dateRange"
            selectionMode="range"
            class="w-full"
            :class="{ 'p-invalid': createErrors.dateRange }"
            placeholder="Выберите даты"
            showIcon
          />
          <small v-if="createErrors.dateRange" class="p-error">{{ createErrors.dateRange }}</small>
        </div>

        <div>
          <label for="absence-create-comment" class="mb-1 block text-sm font-medium text-surface-700">
            Комментарий
          </label>
          <Textarea
            id="absence-create-comment"
            v-model="createForm.comment"
            rows="2"
            class="w-full"
            placeholder="Необязательно"
          />
        </div>

        <Message v-if="createErrors.submit" severity="error" :closable="false" class="w-full">
          {{ createErrors.submit }}
        </Message>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="editDialogVisible"
      header="Редактировать отсутствие"
      modal
      class="w-full max-w-md"
    >
      <form class="space-y-4" @submit.prevent="onSubmitEdit">
        <div>
          <label for="absence-edit-user" class="mb-1 block text-sm font-medium text-surface-700">
            Пользователь
          </label>
          <InputText
            id="absence-edit-user"
            :model-value="editingAbsence ? [editingAbsence.first_name, editingAbsence.last_name].filter(Boolean).join(' ') || '—' : ''"
            class="w-full"
            disabled
          />
        </div>
        <div>
          <label for="absence-edit-type" class="mb-1 block text-sm font-medium text-surface-700">
            Тип
          </label>
          <Select
            id="absence-edit-type"
            v-model="editForm.type"
            :options="ABSENCE_TYPES"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div>
          <label for="absence-edit-date" class="mb-1 block text-sm font-medium text-surface-700">
            Дата
          </label>
          <DatePicker
            id="absence-edit-date"
            v-model="editForm.date"
            class="w-full"
            dateFormat="dd.mm.yy"
            showIcon
          />
        </div>
        <div>
          <label for="absence-edit-duration" class="mb-1 block text-sm font-medium text-surface-700">
            Длительность <span class="font-normal text-surface-400">(например: 4h, 0.5d)</span>
          </label>
          <InputText
            id="absence-edit-duration"
            v-model="editForm.duration"
            class="w-full"
            placeholder="1d"
          />
        </div>
        <div>
          <label for="absence-edit-comment" class="mb-1 block text-sm font-medium text-surface-700">
            Комментарий
          </label>
          <Textarea
            id="absence-edit-comment"
            v-model="editForm.comment"
            rows="2"
            class="w-full"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="editDialogVisible = false" />
          <Button type="submit" label="Сохранить" :loading="submitting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import dayjs from 'dayjs';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { ABSENCE_LABEL, ABSENCE_SEVERITY, ABSENCE_TYPES } from '@/constants/absences.js';
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
const loading = computed(() => absencesStore.loading);
const users = computed(() => absencesStore.users);
const usersLoading = computed(() => absencesStore.usersLoading);

const userOptions = computed(() =>
  users.value.map((u) => ({
    value: u.id,
    label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id,
  }))
);
const currentUserLabel = computed(() => {
  const me = authStore.user;
  if (!me) { return '—'; }
  return [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email || '—';
});

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);

function getTypeFilterValue() {
  const t = filters.type;
  if (t === null || t === undefined) { return undefined; }
  if (typeof t === 'object' && t !== null && 'value' in t) { return t.value; }
  return typeof t === 'string' ? t : undefined;
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

watch(
  () => ({ type: filters.type, dateRange: filters.dateRange }),
  () => loadAbsences(),
  { deep: true, immediate: true }
);

function resetFilters() {
  Object.assign(filters, { type: null, dateRange: null });
}

onMounted(() => {
  uiStore.setPageTitle('Отсутствия');
  if (authStore.isAdmin) { absencesStore.fetchUsers(); }
});

const createDialogVisible = ref(false);
const createForm = reactive({ user_id: null, type: null, dateRange: null, comment: '' });
const createErrors = reactive({});
const submitting = ref(false);

function openCreateDialog() {
  Object.assign(createForm, { user_id: null, type: null, dateRange: null, comment: '' });
  if (isAdmin.value && users.value.length === 0) { absencesStore.fetchUsers(); }
  Object.keys(createErrors).forEach((key) => delete createErrors[key]);
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach((key) => delete createErrors[key]);
  if (isAdmin.value && !createForm.user_id) {
    createErrors.user_id = 'Выберите пользователя';
    return;
  }
  if (!createForm.type) {
    createErrors.type = 'Выберите тип';
    return;
  }
  if (!createForm.dateRange?.[0]) {
    createErrors.dateRange = 'Выберите период';
    return;
  }

  submitting.value = true;
  delete createErrors.submit;
  try {
    const body = {
      type: createForm.type,
      date_from: dayjs(createForm.dateRange[0]).format('YYYY-MM-DD'),
      date_to: dayjs(createForm.dateRange[1] ?? createForm.dateRange[0]).format('YYYY-MM-DD'),
      comment: createForm.comment || undefined,
    };
    if (isAdmin.value && createForm.user_id) { body.user_id = createForm.user_id; }
    await absencesStore.create(body);
    createDialogVisible.value = false;
    loadAbsences();
  } catch (err) {
    createErrors.submit = err.response?.data?.message ?? 'Ошибка создания';
  } finally {
    submitting.value = false;
  }
}

const editDialogVisible = ref(false);
const editingAbsence = ref(null);
const editForm = reactive({ type: null, date: null, duration: '', comment: '' });

function openEditDialog(absence) {
  editingAbsence.value = absence;
  Object.assign(editForm, {
    type: absence.type,
    date: new Date(absence.date),
    duration: `${absence.duration_hours}h`,
    comment: absence.comment ?? '',
  });
  editDialogVisible.value = true;
}

async function onSubmitEdit() {
  submitting.value = true;
  try {
    await absencesStore.update(editingAbsence.value.id, {
      type: editForm.type,
      date: dayjs(editForm.date).format('YYYY-MM-DD'),
      duration: editForm.duration || undefined,
      comment: editForm.comment || undefined,
    });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
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
