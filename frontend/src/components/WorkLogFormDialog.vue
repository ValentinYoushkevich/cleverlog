<template>
  <Dialog
    :visible="modelValue"
    :header="dialogHeader"
    modal
    class="w-full max-w-lg"
    @update:visible="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="onSubmit">
      <div v-if="showAdminUserSelect">
        <label for="worklog-user" class="mb-1 block text-sm font-medium text-surface-700">
          Пользователь <span class="text-red-500">*</span>
        </label>
        <Select
          id="worklog-user"
          v-model="form.user_id"
          :options="userOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите пользователя"
          class="w-full"
          :class="{ 'p-invalid': formErrors.user_id }"
        />
        <small v-if="formErrors.user_id" class="p-error">{{ formErrors.user_id }}</small>
      </div>
      <div v-else-if="!editingLog">
        <label for="worklog-user-ro" class="mb-1 block text-sm font-medium text-surface-700">Пользователь</label>
        <InputText id="worklog-user-ro" :modelValue="currentUserLabel" class="w-full" disabled />
      </div>
      <div v-else>
        <label for="worklog-user-edit" class="mb-1 block text-sm font-medium text-surface-700">Пользователь</label>
        <InputText
          id="worklog-user-edit"
          :modelValue="editingUserLabel"
          class="w-full"
          disabled
        />
      </div>
      <div>
        <label for="worklog-date" class="mb-1 block text-sm font-medium text-surface-700">
          Дата <span class="text-red-500">*</span>
        </label>
        <DatePicker
          id="worklog-date"
          v-model="form.date"
          :maxDate="today"
          class="w-full"
          :class="{ 'p-invalid': formErrors.date }"
          dateFormat="dd.mm.yy"
        />
        <small v-if="formErrors.date" class="p-error">{{ formErrors.date }}</small>
      </div>

      <div>
        <label for="worklog-project" class="mb-1 block text-sm font-medium text-surface-700">
          Проект <span class="text-red-500">*</span>
        </label>
        <Select
          id="worklog-project"
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
          Длительность <span class="text-red-500">*</span>
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
          Task Number <span class="text-red-500">*</span>
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
          Комментарий <span class="text-red-500">*</span>
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
        <div v-for="field in preparedProjectFields" :key="field.custom_field_id" class="space-y-1">
          <span class="block text-sm font-medium text-surface-700">
            {{ field.name }}
            <span v-if="field.is_required" class="ml-0.5 text-red-500">*</span>
          </span>
          <InputText
            v-if="field.isText"
            v-model="form.custom_fields[field.custom_field_id]"
            class="w-full"
            :class="{ 'p-invalid': formErrors['cf_' + field.custom_field_id] }"
          />
          <InputNumber
            v-else-if="field.isNumber"
            v-model="form.custom_fields[field.custom_field_id]"
            class="w-full"
            :class="{ 'p-invalid': formErrors['cf_' + field.custom_field_id] }"
          />
          <Select
            v-else-if="field.isDropdown"
            v-model="form.custom_fields[field.custom_field_id]"
            :options="field.activeOptions"
            optionLabel="label"
            optionValue="label"
            class="w-full"
            :class="{ 'p-invalid': formErrors['cf_' + field.custom_field_id] }"
          />
          <Checkbox
            v-else-if="field.isCheckbox"
            v-model="form.custom_fields[field.custom_field_id]"
            :binary="true"
            :class="{ 'p-invalid': formErrors['cf_' + field.custom_field_id] }"
          />
          <small v-if="formErrors['cf_' + field.custom_field_id]" class="p-error">{{
            formErrors['cf_' + field.custom_field_id]
          }}</small>
        </div>
      </template>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" label="Отмена" severity="secondary" @click="close" />
        <Button type="submit" :label="submitLabel" :loading="submitting" />
      </div>
    </form>
  </Dialog>
</template>

<script setup>
import dayjs from 'dayjs';
import { useToast } from 'primevue/usetoast';

import http from '@/api/http.js';
import { parseDurationToHours } from '@/composables/useDuration.js';
import { useWorkLogForm } from '@/composables/useWorkLogForm.js';
import { useProjectsStore } from '@/stores/projects.js';

defineOptions({ name: 'WorkLogFormDialog' });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialDate: { type: String, default: null },
  editingLog: { type: Object, default: null },
  isAdmin: { type: Boolean, default: false },
  userOptions: { type: Array, default: () => [] },
  currentUserLabel: { type: String, default: '—' },
});

const emit = defineEmits(['update:modelValue', 'saved']);

const toast = useToast();
const projectsStore = useProjectsStore();
const { projectFields, loadProjectFields } = useWorkLogForm();

const today = new Date();
const submitting = ref(false);
const formErrors = reactive({});
const showAdminUserSelect = computed(() => props.isAdmin && !props.editingLog);
const dialogHeader = computed(() => (props.editingLog ? 'Редактировать лог' : 'Новый лог'));
const submitLabel = computed(() => (props.editingLog ? 'Сохранить' : 'Создать'));
const editingUserLabel = computed(() => {
  const log = props.editingLog;
  if (!log) { return ''; }
  return [log.first_name, log.last_name].filter(Boolean).join(' ') || '—';
});
const preparedProjectFields = computed(() =>
  (projectFields.value ?? []).map((field) => ({
    ...field,
    isText: field.type === 'text',
    isNumber: field.type === 'number',
    isDropdown: field.type === 'dropdown',
    isCheckbox: field.type === 'checkbox',
    activeOptions: field.options?.filter((opt) => !opt.is_deprecated) ?? [],
  }))
);
const form = reactive({
  user_id: null,
  date: null,
  project_id: null,
  duration: '',
  task_number: '',
  comment: '',
  custom_fields: {},
});

watch(
  () => ({ ...form, custom_fields: { ...form.custom_fields } }),
  () => {
    Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  },
  { deep: true }
);

function resetForm() {
  Object.assign(form, {
    user_id: null,
    date: props.initialDate ? new Date(props.initialDate) : new Date(),
    project_id: null,
    duration: '',
    task_number: '',
    comment: '',
    custom_fields: {},
  });
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  projectFields.value = [];
}

async function initForEdit(log) {
  const savedCustomFields = log.custom_fields ? { ...log.custom_fields } : {};
  Object.assign(form, {
    date: new Date(log.date),
    project_id: log.project_id,
    duration: `${log.duration_hours}h`,
    task_number: log.task_number,
    comment: log.comment,
    custom_fields: savedCustomFields,
  });
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  await loadProjectFields(log.project_id);
  // Привести типы значений под вид поля (checkbox → boolean, number → number)
  for (const field of projectFields.value) {
    const id = field.custom_field_id;
    const raw = form.custom_fields[id];
    if (raw === undefined) { continue; }
    if (field.type === 'checkbox') {
      form.custom_fields[id] = raw === 'true' || raw === true;
    } else if (field.type === 'number') {
      const n = Number(raw);
      form.custom_fields[id] = Number.isFinite(n) ? n : raw;
    }
  }
}

watch(
  () => [props.modelValue, props.editingLog, props.initialDate],
  async ([visible, editingLog]) => {
    if (!visible) { return; }
    if (editingLog) {
      await initForEdit(editingLog);
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

async function onProjectChange() {
  form.custom_fields = {};
  await loadProjectFields(form.project_id);
}

function isCustomFieldEmpty(field, value) {
  if (field.type === 'checkbox') { return value !== true; }
  if (field.type === 'number') { return value === null || value === ''; }
  return !value?.toString?.()?.trim?.();
}

function validate() {
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  let valid = true;
  if (props.isAdmin && !props.editingLog && !form.user_id) {
    formErrors.user_id = 'Выберите пользователя';
    valid = false;
  }
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
  for (const field of projectFields.value) {
    if (!field.is_required) { continue; }
    const value = form.custom_fields[field.custom_field_id];
    if (isCustomFieldEmpty(field, value)) {
      formErrors['cf_' + field.custom_field_id] = `${field.name} обязательно`;
      valid = false;
    }
  }
  return valid;
}

function close() {
  emit('update:modelValue', false);
}

async function onSubmit() {
  if (!validate()) { return; }

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
    if (props.isAdmin && !props.editingLog && form.user_id) {
      payload.user_id = form.user_id;
    }

    let res;
    if (props.editingLog) {
      res = await http.patch(`/work-logs/${props.editingLog.id}`, payload);
    } else {
      res = await http.post('/work-logs', payload);
    }

    if (res.data?.warning) {
      toast.add({ severity: 'warn', summary: 'Внимание', detail: res.data.warning, life: 5000 });
    }
    toast.add({
      severity: 'success',
      summary: 'Готово',
      detail: props.editingLog ? 'Лог обновлен' : 'Лог создан',
      life: 3000,
    });
    emit('update:modelValue', false);
    emit('saved');
  } catch (err) {
    const message = err.response?.data?.message ?? 'Произошла ошибка';
    toast.add({ severity: 'error', summary: 'Ошибка', detail: message, life: 5000 });
  } finally {
    submitting.value = false;
  }
}
</script>
