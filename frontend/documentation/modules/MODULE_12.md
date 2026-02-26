# MODULE_12 — Frontend: Управление пользователями (Admin)

## Обзор

Страница `/admin/users` — таблица пользователей с фильтрами по статусу/роли/тегам, создание через Dialog с инвайтом, редактирование роли/статуса/должности, повторная отправка инвайта. Статусы и роли отображаются как цветные Badge.

> **Зависимости модуля:**
> - `usersApi` из MODULE_9 — `list`, `create`, `update`, `resendInvite`

---

## Шаг 1. Zod-схема создания пользователя

`src/validators/user.js`:

```js
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Введите корректный email'),
  first_name: z.string().min(1, 'Имя обязательно'),
  last_name: z.string().min(1, 'Фамилия обязательна'),
  position: z.string().optional(),
  role: z.enum(['admin', 'user']),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  position: z.string().optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
```

---

## Шаг 2. Константы

`src/constants/users.js`:

```js
export const USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Активен' },
  { value: 'inactive', label: 'Неактивен' },
];

export const USER_ROLE_OPTIONS = [
  { value: 'user', label: 'Пользователь' },
  { value: 'admin', label: 'Администратор' },
];

export const STATUS_SEVERITY = {
  active: 'success',
  inactive: 'danger',
};

export const ROLE_SEVERITY = {
  admin: 'warn',
  user: 'secondary',
};

export const STATUS_LABEL = {
  active: 'Активен',
  inactive: 'Неактивен',
};

export const ROLE_LABEL = {
  admin: 'Администратор',
  user: 'Пользователь',
};
```

---

## Шаг 3. UsersPage

`src/pages/admin/UsersPage.vue`:

```vue
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
      <Column field="last_name" header="ФИО" sortable style="min-width: 180px">
        <template #body="{ data }">
          <div>
            <p class="font-medium text-surface-800">{{ data.last_name }} {{ data.first_name }}</p>
            <p class="text-xs text-surface-400">{{ data.email }}</p>
          </div>
        </template>
      </Column>
      <Column field="position" header="Должность" style="width: 180px" />
      <Column field="role" header="Роль" style="width: 150px">
        <template #body="{ data }">
          <Tag :value="ROLE_LABEL[data.role]" :severity="ROLE_SEVERITY[data.role]" />
        </template>
      </Column>
      <Column field="status" header="Статус" style="width: 130px">
        <template #body="{ data }">
          <Tag :value="STATUS_LABEL[data.status]" :severity="STATUS_SEVERITY[data.status]" />
        </template>
      </Column>
      <Column field="created_at" header="Добавлен" style="width: 130px">
        <template #body="{ data }">
          <span class="text-xs text-surface-400">{{ formatDate(data.created_at) }}</span>
        </template>
      </Column>
      <Column header="" style="width: 120px">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button icon="pi pi-pencil" text rounded size="small" v-tooltip="'Редактировать'" @click="openEditDialog(data)" />
            <Button
              icon="pi pi-send"
              text rounded size="small"
              severity="secondary"
              v-tooltip="'Повторить инвайт'"
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
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Имя *</label>
            <InputText v-model="createForm.first_name" class="w-full" :class="{ 'p-invalid': createErrors.first_name }" />
            <small v-if="createErrors.first_name" class="p-error">{{ createErrors.first_name }}</small>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Фамилия *</label>
            <InputText v-model="createForm.last_name" class="w-full" :class="{ 'p-invalid': createErrors.last_name }" />
            <small v-if="createErrors.last_name" class="p-error">{{ createErrors.last_name }}</small>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Email *</label>
          <InputText v-model="createForm.email" type="email" class="w-full" :class="{ 'p-invalid': createErrors.email }" />
          <small v-if="createErrors.email" class="p-error">{{ createErrors.email }}</small>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Должность</label>
          <InputText v-model="createForm.position" class="w-full" placeholder="Например: Frontend Developer" />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Роль *</label>
          <Select
            v-model="createForm.role"
            :options="USER_ROLE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <Message severity="info" :closable="false" class="text-sm">
          На указанный email будет отправлена ссылка для создания пароля (действует 72 часа).
        </Message>
        <Message v-if="createError" severity="error" :closable="false">{{ createError }}</Message>
        <div class="flex justify-end gap-2 pt-2">
          <Button label="Отмена" severity="secondary" @click="createDialogVisible = false" />
          <Button type="submit" label="Создать и отправить инвайт" :loading="submitting" />
        </div>
      </form>
    </Dialog>

    <!-- Dialog: редактирование -->
    <Dialog v-model:visible="editDialogVisible" header="Редактировать пользователя" modal class="w-full max-w-md">
      <form @submit.prevent="onSubmitEdit" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Имя</label>
            <InputText v-model="editForm.first_name" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1">Фамилия</label>
            <InputText v-model="editForm.last_name" class="w-full" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Должность</label>
          <InputText v-model="editForm.position" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Роль</label>
          <Select v-model="editForm.role" :options="USER_ROLE_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 mb-1">Статус</label>
          <Select v-model="editForm.status" :options="USER_STATUS_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import dayjs from 'dayjs';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { usersApi } from '@/api/users.js';
import { useUiStore } from '@/stores/ui.js';
import {
  USER_STATUS_OPTIONS, USER_ROLE_OPTIONS,
  STATUS_SEVERITY, ROLE_SEVERITY,
  STATUS_LABEL, ROLE_LABEL,
} from '@/constants/users.js';
import { createUserSchema } from '@/validators/user.js';

defineOptions({ name: 'UsersPage' });

const toast = useToast();
const uiStore = useUiStore();

onMounted(() => { uiStore.setPageTitle('Пользователи'); loadUsers(); });

const users = ref([]);
const loading = ref(false);
const submitting = ref(false);
const filters = reactive({ status: null, role: null, search: '' });

// Клиентская фильтрация по поиску
const filteredUsers = computed(() => {
  if (!filters.search) return users.value;
  const q = filters.search.toLowerCase();
  return users.value.filter(u =>
    u.first_name.toLowerCase().includes(q) ||
    u.last_name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q)
  );
});

async function loadUsers() {
  loading.value = true;
  try {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.role) params.role = filters.role;
    const res = await usersApi.list(params);
    users.value = res.data.data ?? res.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { status: null, role: null, search: '' });
  loadUsers();
}

function formatDate(d) { return d ? dayjs(d).format('DD.MM.YYYY') : '—'; }

// --- Создание ---
const createDialogVisible = ref(false);
const createForm = reactive({ email: '', first_name: '', last_name: '', position: '', role: 'user' });
const createErrors = reactive({});
const createError = ref('');

function openCreateDialog() {
  Object.assign(createForm, { email: '', first_name: '', last_name: '', position: '', role: 'user' });
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  createError.value = '';
  createDialogVisible.value = true;
}

async function onSubmitCreate() {
  Object.keys(createErrors).forEach(k => delete createErrors[k]);
  const result = createUserSchema.safeParse(createForm);
  if (!result.success) {
    result.error.errors.forEach(e => { createErrors[e.path[0]] = e.message; });
    return;
  }
  submitting.value = true;
  createError.value = '';
  try {
    await usersApi.create(createForm);
    toast.add({ severity: 'success', summary: 'Пользователь создан', detail: 'Инвайт отправлен на email', life: 4000 });
    createDialogVisible.value = false;
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
const editForm = reactive({ first_name: '', last_name: '', position: '', role: 'user', status: 'active' });
const editError = ref('');

function openEditDialog(user) {
  editingUser.value = user;
  Object.assign(editForm, {
    first_name: user.first_name,
    last_name: user.last_name,
    position: user.position ?? '',
    role: user.role,
    status: user.status,
  });
  editError.value = '';
  editDialogVisible.value = true;
}

async function onSubmitEdit() {
  submitting.value = true;
  editError.value = '';
  try {
    await usersApi.update(editingUser.value.id, editForm);
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
    await usersApi.resendInvite(user.id);
    toast.add({ severity: 'success', summary: 'Инвайт отправлен', detail: user.email, life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка при отправке инвайта', life: 3000 });
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Список загружается | Таблица с пользователями из БД |
| 2 | Статусы и роли как Tag | `active` → зелёный, `inactive` → красный, `admin` → жёлтый |
| 3 | Фильтр по статусу | `inactive` → только деактивированные |
| 4 | Поиск по имени/email | Ввести часть имени → список фильтруется мгновенно |
| 5 | Создание пользователя | Заполнить форму → «Создать» → Toast «Инвайт отправлен» |
| 6 | Дубликат email | → `'Пользователь с таким email уже существует'` |
| 7 | Редактирование: смена роли | Изменить на `admin` → Tag обновился |
| 8 | Редактирование: деактивация | Статус → `inactive` → пользователь не может войти |
| 9 | Повторный инвайт | Кнопка-самолётик → Toast «Инвайт отправлен» |
| 10 | Инвайт недоступен для inactive | Кнопка disabled у неактивных |
