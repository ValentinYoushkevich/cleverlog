<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Рабочие логи</h1>
      <Button
        label="Добавить лог"
        icon="pi pi-plus"
        :disabled="isClosed && !isAdmin"
        @click="openCreateDialog"
      />
    </div>

    <div class="rounded-xl border border-surface-200 bg-surface-0 p-4">
      <div class="grid grid-cols-4 gap-3">
        <Select
          v-model="filters.project_id"
          :options="projectsStore.activeProjects"
          optionLabel="name"
          optionValue="id"
          placeholder="Все проекты"
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
        <InputText v-model="filters.task_number" placeholder="Task Number" class="w-full" />
        <InputText v-model="filters.comment" placeholder="Поиск по комментарию" class="w-full" />
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Найти" icon="pi pi-search" size="small" @click="loadLogs" />
        <Button
          label="Сбросить"
          icon="pi pi-times"
          size="small"
          severity="secondary"
          @click="resetFilters"
        />
      </div>
    </div>

    <DataTable
      :value="logs"
      :loading="loading"
      paginator
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
      sortMode="single"
      stripedRows
      class="overflow-hidden rounded-xl border border-surface-200"
    >
      <Column field="date" header="Дата" sortable style="width: 120px">
        <template #body="{ data }">
          {{ dayjs(data.date).format('DD.MM.YYYY') }}
        </template>
      </Column>
      <Column field="project_name" header="Проект" sortable />
      <Column field="task_number" header="Task Number" style="width: 140px" />
      <Column field="duration_hours" header="Длительность (ч)" style="width: 180px">
        <template #body="{ data }">{{ data.duration_hours }} ч</template>
      </Column>
      <Column field="comment" header="Комментарий">
        <template #body="{ data }">
          <span class="block max-w-xs truncate" :title="data.comment">{{ data.comment }}</span>
        </template>
      </Column>
      <Column header="" style="width: 100px">
        <template #body="{ data }">
          <div class="flex gap-1">
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
        <div class="py-8 text-center text-surface-400">Логи не найдены</div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingLog ? 'Редактировать лог' : 'Новый лог'"
      modal
      class="w-full max-w-lg"
    >
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <label for="worklog-date" class="mb-1 block text-sm font-medium text-surface-700">Дата *</label>
          <DatePicker
            inputId="worklog-date"
            v-model="form.date"
            :maxDate="today"
            class="w-full"
            :class="{ 'p-invalid': formErrors.date }"
            dateFormat="yy-mm-dd"
          />
          <small v-if="formErrors.date" class="p-error">{{ formErrors.date }}</small>
        </div>

        <div>
          <label for="worklog-project" class="mb-1 block text-sm font-medium text-surface-700">
            Проект *
          </label>
          <Select
            inputId="worklog-project"
            v-model="form.project_id"
            :options="projectsStore.activeProjects"
            optionLabel="name"
            optionValue="id"
            placeholder="Выберите проект"
            class="w-full"
            :class="{ 'p-invalid': formErrors.project_id }"
            @change="onProjectChange"
          />
          <small v-if="formErrors.project_id" class="p-error">{{ formErrors.project_id }}</small>
        </div>

        <div>
          <label for="worklog-duration" class="mb-1 block text-sm font-medium text-surface-700">
            Длительность *
            <span class="font-normal text-surface-400">(например: 1h 30m, 2d, 45m)</span>
          </label>
          <InputText
            id="worklog-duration"
            v-model="form.duration"
            placeholder="1h 30m"
            class="w-full"
            :class="{ 'p-invalid': formErrors.duration }"
          />
          <small v-if="formErrors.duration" class="p-error">{{ formErrors.duration }}</small>
        </div>

        <div>
          <label for="worklog-task-number" class="mb-1 block text-sm font-medium text-surface-700">
            Task Number *
          </label>
          <InputText
            id="worklog-task-number"
            v-model="form.task_number"
            placeholder="TASK-123"
            class="w-full"
            :class="{ 'p-invalid': formErrors.task_number }"
          />
          <small v-if="formErrors.task_number" class="p-error">{{ formErrors.task_number }}</small>
        </div>

        <div>
          <label for="worklog-comment" class="mb-1 block text-sm font-medium text-surface-700">
            Комментарий *
          </label>
          <Textarea
            id="worklog-comment"
            v-model="form.comment"
            rows="3"
            class="w-full"
            :class="{ 'p-invalid': formErrors.comment }"
            placeholder="Что было сделано..."
          />
          <small v-if="formErrors.comment" class="p-error">{{ formErrors.comment }}</small>
        </div>

        <template v-if="projectFields.length">
          <Divider />
          <div v-for="field in projectFields" :key="field.custom_field_id" class="space-y-1">
            <span class="block text-sm font-medium text-surface-700">
              {{ field.name }}
              <span v-if="field.is_required" class="ml-0.5 text-red-500">*</span>
            </span>

            <InputText
              v-if="field.type === 'text'"
              v-model="form.custom_fields[field.custom_field_id]"
              class="w-full"
            />
            <InputNumber
              v-else-if="field.type === 'number'"
              v-model="form.custom_fields[field.custom_field_id]"
              class="w-full"
            />
            <Select
              v-else-if="field.type === 'dropdown'"
              v-model="form.custom_fields[field.custom_field_id]"
              :options="field.options?.filter((option) => !option.is_deprecated)"
              optionLabel="label"
              optionValue="label"
              class="w-full"
            />
            <Checkbox
              v-else-if="field.type === 'checkbox'"
              v-model="form.custom_fields[field.custom_field_id]"
              :binary="true"
            />
          </div>
        </template>

        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="dialogVisible = false" />
          <Button type="submit" :label="editingLog ? 'Сохранить' : 'Создать'" :loading="submitting" />
        </div>
      </form>
    </Dialog>

  </div>
</template>

<script setup>
import dayjs from 'dayjs';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import Divider from 'primevue/divider';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

import http from '@/api/http.js';
import { parseDurationToHours } from '@/composables/useDuration.js';
import { useWorkLogForm } from '@/composables/useWorkLogForm.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useProjectsStore } from '@/stores/projects.js';
import { useUiStore } from '@/stores/ui.js';

defineOptions({ name: 'WorkLogsPage' });

const confirm = useConfirm();
const toast = useToast();
const projectsStore = useProjectsStore();
const calendarStore = useCalendarStore();
const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Рабочие логи');
  loadLogs();
});

const isClosed = computed(() => calendarStore.isClosed);
const isAdmin = computed(() => authStore.isAdmin);
const today = new Date();

const logs = ref([]);
const loading = ref(false);
const filters = reactive({ project_id: null, dateRange: null, task_number: '', comment: '' });

async function loadLogs() {
  loading.value = true;
  try {
    const params = {};
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.task_number) params.task_number = filters.task_number;
    if (filters.comment) params.comment = filters.comment;
    if (filters.dateRange?.[0]) params.date_from = dayjs(filters.dateRange[0]).format('YYYY-MM-DD');
    if (filters.dateRange?.[1]) params.date_to = dayjs(filters.dateRange[1]).format('YYYY-MM-DD');

    const res = await http.get('/work-logs', { params });
    logs.value = res.data.data ?? res.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { project_id: null, dateRange: null, task_number: '', comment: '' });
  loadLogs();
}

const dialogVisible = ref(false);
const editingLog = ref(null);
const submitting = ref(false);
const formErrors = reactive({});

const form = reactive({
  date: null,
  project_id: null,
  duration: '',
  task_number: '',
  comment: '',
  custom_fields: {},
});

const { projectFields, loadProjectFields } = useWorkLogForm();

function openCreateDialog() {
  editingLog.value = null;
  Object.assign(form, {
    date: new Date(),
    project_id: null,
    duration: '',
    task_number: '',
    comment: '',
    custom_fields: {},
  });
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  projectFields.value = [];
  dialogVisible.value = true;
}

async function openEditDialog(log) {
  editingLog.value = log;
  Object.assign(form, {
    date: new Date(log.date),
    project_id: log.project_id,
    duration: `${log.duration_hours}h`,
    task_number: log.task_number,
    comment: log.comment,
    custom_fields: {},
  });
  await loadProjectFields(log.project_id);
  dialogVisible.value = true;
}

async function onProjectChange() {
  form.custom_fields = {};
  await loadProjectFields(form.project_id);
}

function validateForm() {
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  let valid = true;

  if (!form.date) {
    formErrors.date = 'Дата обязательна';
    valid = false;
  }
  if (!form.project_id) {
    formErrors.project_id = 'Проект обязателен';
    valid = false;
  }
  if (!form.duration?.trim()) {
    formErrors.duration = 'Длительность обязательна';
    valid = false;
  } else if (parseDurationToHours(form.duration) === null) {
    formErrors.duration = 'Неверный формат длительности';
    valid = false;
  }
  if (!form.task_number?.trim()) {
    formErrors.task_number = 'Task Number обязателен';
    valid = false;
  }
  if (!form.comment?.trim()) {
    formErrors.comment = 'Комментарий обязателен';
    valid = false;
  }

  return valid;
}

async function onSubmit() {
  if (!validateForm()) return;

  submitting.value = true;
  try {
    const payload = {
      date: dayjs(form.date).format('YYYY-MM-DD'),
      project_id: form.project_id,
      duration: form.duration,
      task_number: form.task_number,
      comment: form.comment,
      custom_fields: form.custom_fields,
    };

    let res;
    if (editingLog.value) {
      res = await http.patch(`/work-logs/${editingLog.value.id}`, payload);
    } else {
      res = await http.post('/work-logs', payload);
    }

    if (res.data.warning) {
      toast.add({ severity: 'warn', summary: 'Внимание', detail: res.data.warning, life: 5000 });
    }

    toast.add({
      severity: 'success',
      summary: 'Готово',
      detail: editingLog.value ? 'Лог обновлен' : 'Лог создан',
      life: 3000,
    });
    dialogVisible.value = false;
    await loadLogs();
  } catch (err) {
    const message = err.response?.data?.message ?? 'Произошла ошибка';
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 });
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(log) {
  confirm.require({
    message: `Удалить лог за ${log.date}?`,
    header: 'Подтверждение',
    icon: 'pi pi-trash',
    acceptSeverity: 'danger',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await http.delete(`/work-logs/${log.id}`);
        toast.add({ severity: 'success', summary: 'Удалено', life: 3000 });
        await loadLogs();
      } catch {
        toast.add({ severity: 'error', summary: 'Ошибка при удалении', life: 3000 });
      }
    },
  });
}
</script>
