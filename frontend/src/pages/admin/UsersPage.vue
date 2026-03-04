<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-surface-800">Пользователи</h1>
      <Button label="Добавить пользователя" icon="pi pi-plus" @click="openCreateDialog" />
    </div>

    <!-- Фильтры -->
    <div class="bg-surface-0 rounded-xl p-4 border border-surface-200">
      <div class="grid grid-cols-3 gap-3">
        <Select
          v-model="filters.status"
          :options="USER_STATUS_OPTIONS"
          optionLabel="label"
          optionValue="value"
          placeholder="Все статусы"
          showClear
          class="w-full"
        />
        <Select
          v-model="filters.role"
          :options="USER_ROLE_OPTIONS"
          optionLabel="label"
          optionValue="value"
          placeholder="Все роли"
          showClear
          class="w-full"
        />
        <InputText v-model="filters.search" placeholder="Поиск по имени / email" class="w-full" />
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Найти" icon="pi pi-search" size="small" @click="loadUsers" />
        <Button label="Сбросить" severity="secondary" size="small" @click="resetFilters" />
      </div>
    </div>

    <!-- Таблица -->
    <DataTable
      :value="filteredUsers"
      :loading="loading"
      paginator
      :rows="20"
      stripedRows
      class="border border-surface-200 rounded-xl overflow-hidden"
    >
      <Column field="last_name" header="ФИО" sortable style="min-width: 220px">
        <template #body="{ data }">
          <p class="font-medium text-surface-800 truncate">
            {{ data.last_name }} {{ data.first_name }}
          </p>
        </template>
      </Column>
      <Column field="email" header="Email" style="min-width: 220px">
        <template #body="{ data }">
          <span class="text-surface-600 break-all">{{ data.email }}</span>
        </template>
      </Column>
      <Column field="position" header="Должность" style="width: 180px" />
      <Column field="department" header="Отдел" style="width: 140px">
        <template #body="{ data }">
          <span class="text-surface-700">{{ data.department || '—' }}</span>
        </template>
      </Column>
      <Column field="role" header="Роль" style="width: 200px">
        <template #body="{ data }">
          <Tag :value="ROLE_LABEL[data.role]" :severity="ROLE_SEVERITY[data.role]" />
        </template>
      </Column>
      <Column field="status" header="Статус" style="width: 140px">
        <template #body="{ data }">
          <Tag :value="STATUS_LABEL[data.status]" :severity="STATUS_SEVERITY[data.status]" />
        </template>
      </Column>
      <Column field="created_at" header="Добавлен" style="width: 140px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400">{{ formatDate(data.created_at) }}</span>
        </template>
      </Column>
      <Column header="" style="width: 120px" bodyClass="text-right">
        <template #body="{ data }">
          <div class="flex justify-end gap-1">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              v-tooltip.left="'Редактировать'"
              @click="openEditDialog(data)"
            />
            <Button
              icon="pi pi-send"
              text
              rounded
              size="small"
              severity="secondary"
              v-tooltip.left="'Повторить инвайт'"
              @click="resendInvite(data)"
              :disabled="data.status !== 'active'"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-8 text-surface-400">Пользователи не найдены</div>
      </template>
    </DataTable>

    <!-- Dialog: создание -->
    <Dialog v-model:visible="createDialogVisible" header="Новый пользователь" modal class="w-full max-w-md">
      <form @submit.prevent="onSubmitCreate" class="space-y-4">
        <div class="flex items-center justify-between gap-3 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2">
          <span class="text-sm font-semibold text-primary-800">Способ регистрации</span>
          <div class="flex items-center gap-3">
            <span
              class="text-xs"
              :class="!isEmailMode ? 'font-semibold text-surface-800' : 'text-surface-500'"
            >
              Ссылка в чат
            </span>
            <ToggleSwitch v-model="isEmailMode" />
            <span
              class="text-xs"
              :class="isEmailMode ? 'font-semibold text-surface-800' : 'text-surface-500'"
            >
              Ссылка на email
            </span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="create-first-name" class="block text-sm font-medium text-surface-700 mb-1">Имя *</label>
            <InputText
              id="create-first-name"
              v-model="createForm.first_name"
              class="w-full"
              :class="{ 'p-invalid': createErrors.first_name }"
            />
            <small v-if="createErrors.first_name" class="p-error">{{ createErrors.first_name }}</small>
          </div>
          <div>
            <label for="create-last-name" class="block text-sm font-medium text-surface-700 mb-1">Фамилия *</label>
            <InputText
              id="create-last-name"
              v-model="createForm.last_name"
              class="w-full"
              :class="{ 'p-invalid': createErrors.last_name }"
            />
            <small v-if="createErrors.last_name" class="p-error">{{ createErrors.last_name }}</small>
          </div>
        </div>
        <div v-if="isEmailMode">
          <label for="create-email" class="block text-sm font-medium text-surface-700 mb-1">Email *</label>
          <InputText
            id="create-email"
            v-model="createForm.email"
            type="email"
            class="w-full"
            :class="{ 'p-invalid': createErrors.email }"
          />
          <small v-if="createErrors.email" class="p-error">{{ createErrors.email }}</small>
        </div>
        <div>
          <label for="create-position" class="block text-sm font-medium text-surface-700 mb-1">Должность</label>
          <InputText
            id="create-position"
            v-model="createForm.position"
            class="w-full"
            placeholder="Например: Frontend Developer"
          />
        </div>
        <div>
          <label for="create-department" class="block text-sm font-medium text-surface-700 mb-1">Отдел *</label>
          <Select
            inputId="create-department"
            v-model="createForm.department"
            :options="departments"
            :loading="loadingDepartments"
            class="w-full"
            placeholder="Выберите отдел"
          />
        </div>
        <div>
          <label for="create-role" class="block text-sm font-medium text-surface-700 mb-1">Роль *</label>
          <Select
            inputId="create-role"
            v-model="createForm.role"
            :options="USER_ROLE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <Message v-if="isEmailMode" severity="info" :closable="false" class="text-sm">
          На указанный email будет отправлена ссылка для создания пароля (действует 48 часов).
        </Message>
        <Message v-if="createError" severity="error" :closable="false">{{ createError }}</Message>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать и отправить инвайт" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: ссылка для регистрации -->
    <Dialog
      v-model:visible="inviteLinkDialogVisible"
      header="Ссылка для регистрации"
      modal
      class="w-full max-w-lg"
    >
      <div class="space-y-3">
        <p class="text-sm text-surface-600">
          Скопируйте ссылку и отправьте её пользователю в чат. По ней он перейдёт сразу на страницу создания пароля.
        </p>
        <div class="flex items-center gap-2">
          <InputText v-model="inviteLink" class="w-full" readonly />
          <Button
            icon="pi pi-copy"
            severity="secondary"
            @click="copyInviteLink"
            v-tooltip.bottom="'Скопировать в буфер обмена'"
          />
        </div>
        <div class="flex justify-end">
          <Button
            label="Готово"
            severity="secondary"
            @click="handleInviteLinkDone"
          />
        </div>
      </div>
    </Dialog>

    <!-- Dialog: редактирование -->
    <Dialog v-model:visible="editDialogVisible" header="Редактировать пользователя" modal class="w-full max-w-md">
      <form @submit.prevent="onSubmitEdit" class="space-y-4">
        <div v-if="editingUser" class="relative rounded-lg border border-surface-200 p-3 bg-surface-50">
          <label class="block text-sm font-medium text-surface-700 mb-1">Способ регистрации</label>
          <p class="text-surface-700">
            {{ inviteModeLabel }}
          </p>
          <div v-if="editingUser.invite_mode === 'link'" class="flex items-center gap-2 mt-2">
            <InputText
              :model-value="editingUser.invite_link || 'Ссылка будет доступна после генерации'"
              class="w-full flex-1"
              readonly
            />
            <Button
              icon="pi pi-copy"
              severity="secondary"
              @click="copyEditInviteLink"
              :disabled="!editingUser.invite_link"
              v-tooltip.bottom="'Скопировать в буфер обмена'"
            />
            <Button
              icon="pi pi-refresh"
              severity="secondary"
              @click="regenerateInviteLink"
              v-tooltip.bottom="'Сгенерировать новую ссылку'"
            />
          </div>
          <div v-else class="mt-2">
            <p class="text-xs text-surface-500">
              Инвайт отправляется на email: {{ editingUser.email || '—' }} (действует 48 часов).
            </p>
            <div class="absolute top-3 right-3 flex flex-row items-center gap-2">
              <Button
                icon="pi pi-send"
                size="small"
                severity="secondary"
                @click="resendInvite(editingUser)"
                v-tooltip.bottom="'Отправить ещё раз'"
              />
              <Button
                icon="pi pi-refresh"
                size="small"
                severity="secondary"
                @click="regenerateEmailInvite"
                v-tooltip.bottom="'Перегенерировать токен'"
              />
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="edit-first-name" class="block text-sm font-medium text-surface-700 mb-1">Имя</label>
            <InputText id="edit-first-name" v-model="editForm.first_name" class="w-full" />
          </div>
          <div>
            <label for="edit-last-name" class="block text-sm font-medium text-surface-700 mb-1">Фамилия</label>
            <InputText id="edit-last-name" v-model="editForm.last_name" class="w-full" />
          </div>
        </div>
        <div>
          <label for="edit-position" class="block text-sm font-medium text-surface-700 mb-1">Должность</label>
          <InputText id="edit-position" v-model="editForm.position" class="w-full" />
        </div>
        <div>
          <label for="edit-role" class="block text-sm font-medium text-surface-700 mb-1">Роль</label>
          <Select
            inputId="edit-role"
            v-model="editForm.role"
            :options="USER_ROLE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div>
          <label for="edit-status" class="block text-sm font-medium text-surface-700 mb-1">Статус</label>
          <Select
            inputId="edit-status"
            v-model="editForm.status"
            :options="USER_STATUS_OPTIONS"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div>
          <label for="edit-department" class="block text-sm font-medium text-surface-700 mb-1">Отдел *</label>
          <Select
            inputId="edit-department"
            v-model="editForm.department"
            :options="departments"
            :loading="loadingDepartments"
            class="w-full"
            placeholder="Выберите отдел"
          />
        </div>
        <Message v-if="editError" severity="error" :closable="false">{{ editError }}</Message>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="editDialogVisible = false" />
          <Button type="submit" label="Сохранить" :loading="submitting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup>
import {
  ROLE_LABEL,
  ROLE_SEVERITY,
  STATUS_LABEL,
  STATUS_SEVERITY,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from '@/constants/users.js';
import { useDirectoriesStore } from '@/stores/directories.js';
import { useUiStore } from '@/stores/ui.js';
import { useUsersStore } from '@/stores/users.js';
import { createUserSchema } from '@/validators/user.js';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

defineOptions({ name: 'UsersPage' });

const toast = useToast();
const uiStore = useUiStore();
const usersStore = useUsersStore();
const directoriesStore = useDirectoriesStore();
const { users, loading } = storeToRefs(usersStore);
const { departments, loadingDepartments } = storeToRefs(directoriesStore);

onMounted(() => {
  uiStore.setPageTitle('Пользователи');
  directoriesStore.fetchDepartments();
  loadUsers();
});

const submitting = ref(false);
const filters = reactive({ status: null, role: null, search: '' });

// Клиентская фильтрация по поиску
const filteredUsers = computed(() => {
  if (!filters.search) return users.value;
  const q = filters.search.toLowerCase();
  return users.value.filter(
    (u) =>
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)),
  );
});

function loadUsers() {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.role) params.role = filters.role;
  usersStore.fetchList(params);
}

function resetFilters() {
  Object.assign(filters, { status: null, role: null, search: '' });
  loadUsers();
}

function formatDate(d) {
  return d ? dayjs(d).format('DD.MM.YYYY') : '—';
}

// --- Создание ---
const createDialogVisible = ref(false);
const createForm = reactive({
  email: '',
  first_name: '',
  last_name: '',
  position: '',
  role: 'user',
  department: '',
  invite_mode: 'link', // 'email' | 'link'
});
const createErrors = reactive({});
const createError = ref('');

const isEmailMode = computed({
  get: () => createForm.invite_mode === 'email',
  set: (val) => {
    createForm.invite_mode = val ? 'email' : 'link';
  },
});

const inviteLinkDialogVisible = ref(false);
const inviteLink = ref('');

function openCreateDialog() {
  Object.assign(createForm, {
    email: '',
    first_name: '',
    last_name: '',
    position: '',
    role: 'user',
    department: '',
    invite_mode: 'link',
  });
  Object.keys(createErrors).forEach((k) => delete createErrors[k]);
  createError.value = '';
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach((k) => delete createErrors[k]);
  if (isEmailMode.value) {
    const result = createUserSchema.safeParse(createForm);
    if (!result.success) {
      result.error.errors.forEach((e) => {
        createErrors[e.path[0]] = e.message;
      });
      return;
    }
  } else {
    // Простая валидация для режима «ссылка в чат»
    if (!createForm.first_name.trim()) {
      createErrors.first_name = 'Имя обязательно';
    }
    if (!createForm.last_name.trim()) {
      createErrors.last_name = 'Фамилия обязательна';
    }
    if (Object.keys(createErrors).length > 0) {
      return;
    }
  }
  submitting.value = true;
  createError.value = '';
  try {
    const result = await usersStore.create(createForm);
    if (createForm.invite_mode === 'email') {
      toast.add({
        severity: 'success',
        summary: 'Пользователь создан',
        detail: 'Инвайт отправлен на email',
        life: 4000,
      });
      createDialogVisible.value = false;
    } else {
      // ссылка для отправки в чат
      inviteLink.value = result?.invite_link ?? '';
      inviteLinkDialogVisible.value = true;
    }
    await loadUsers();
  } catch (err) {
    if (err.response?.data?.code === 'EMAIL_EXISTS') {
      createError.value = 'Пользователь с таким email уже существует';
    } else {
      createError.value = 'Не удалось создать пользователя';
    }
  } finally {
    submitting.value = false;
  }
}

// --- Редактирование ---
const editDialogVisible = ref(false);
const editingUser = ref(null);
const editForm = reactive({
  first_name: '',
  last_name: '',
  position: '',
  role: 'user',
  status: 'active',
  department: '',
});
const editError = ref('');

async function openEditDialog(user) {
  editError.value = '';
  editDialogVisible.value = true;
  try {
    const full = await usersStore.fetchById(user.id);
    editingUser.value = full;
    Object.assign(editForm, {
      first_name: full.first_name,
      last_name: full.last_name,
      position: full.position ?? '',
      role: full.role,
      status: full.status,
      department: full.department ?? '',
    });
  } catch {
    editDialogVisible.value = false;
  }
}

async function onSubmitEdit() {
  submitting.value = true;
  editError.value = '';
  try {
    await usersStore.update(editingUser.value.id, editForm);
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
    editDialogVisible.value = false;
    await loadUsers();
  } catch {
    editError.value = 'Не удалось сохранить изменения';
  } finally {
    submitting.value = false;
  }
}

// --- Повторный инвайт ---
async function resendInvite(user) {
  try {
    await usersStore.resendInvite(user.id);
    toast.add({ severity: 'success', summary: 'Инвайт отправлен', detail: user.email, life: 3000 });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVITE_EXPIRED') {
      toast.add({
        severity: 'warn',
        summary: 'Инвайт истёк',
        detail: 'Перегенерируйте токен в карточке пользователя и отправьте инвайт ещё раз.',
        life: 5000,
      });
    } else if (code === 'ALREADY_REGISTERED') {
      toast.add({
        severity: 'warn',
        summary: 'Пользователь уже зарегистрирован',
        life: 4000,
      });
    } else {
      toast.add({ severity: 'error', summary: 'Ошибка при отправке инвайта', life: 3000 });
    }
  }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    toast.add({ severity: 'success', summary: 'Ссылка скопирована', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Не удалось скопировать ссылку', life: 3000 });
  }
}

function handleInviteLinkDone() {
  inviteLinkDialogVisible.value = false;
  createDialogVisible.value = false;
}

const inviteModeLabel = computed(() => {
  if (!editingUser.value) return '';
  return editingUser.value.invite_mode === 'link' ? 'Ссылка в чат' : 'Ссылка на email';
});

async function copyEditInviteLink() {
  const link = editingUser.value?.invite_link;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    toast.add({ severity: 'success', summary: 'Ссылка скопирована', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Не удалось скопировать ссылку', life: 3000 });
  }
}

async function regenerateInviteLink() {
  if (!editingUser.value) return;
  try {
    const result = await usersStore.regenerateInviteLink(editingUser.value.id);
    editingUser.value = {
      ...editingUser.value,
      invite_link: result?.invite_link ?? null,
    };
    if (result?.invite_link) {
      toast.add({ severity: 'success', summary: 'Новая ссылка создана', life: 2000 });
    }
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVITE_ACTIVE') {
      toast.add({
        severity: 'warn',
        summary: 'Уже есть активная ссылка',
        detail: 'Нельзя сгенерировать новую, пока текущая не истекла',
        life: 4000,
      });
    } else if (code === 'ALREADY_REGISTERED') {
      toast.add({
        severity: 'warn',
        summary: 'Пользователь уже зарегистрирован',
        life: 4000,
      });
    } else if (code === 'WRONG_INVITE_MODE') {
      toast.add({
        severity: 'warn',
        summary: 'Для этого пользователя используется приглашение по email',
        life: 4000,
      });
    }
  }
}

async function regenerateEmailInvite() {
  if (!editingUser.value) return;
  try {
    await usersStore.regenerateEmailInvite(editingUser.value.id);
    toast.add({
      severity: 'success',
      summary: 'Токен перегенерирован',
      detail: 'Теперь можно отправить инвайт ещё раз.',
      life: 4000,
    });
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 'INVITE_ACTIVE') {
      toast.add({
        severity: 'warn',
        summary: 'Уже есть активный инвайт',
        detail: 'Перегенерация не требуется.',
        life: 4000,
      });
    } else if (code === 'ALREADY_REGISTERED') {
      toast.add({
        severity: 'warn',
        summary: 'Пользователь уже зарегистрирован',
        life: 4000,
      });
    } else if (code === 'WRONG_INVITE_MODE') {
      toast.add({
        severity: 'warn',
        summary: 'Для этого пользователя используется другой способ регистрации',
        life: 4000,
      });
    }
  }
}
</script>

