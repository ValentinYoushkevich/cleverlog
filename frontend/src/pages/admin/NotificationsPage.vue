<template>
  <div class="mx-auto w-full max-w-6xl space-y-6">
    <h1 class="text-2xl font-semibold text-surface-800">Настройки уведомлений</h1>

    <!-- Глобальный переключатель -->
    <Card>
      <template #title>Рассылка в конце месяца</template>
      <template #content>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-surface-700">Уведомлять сотрудников в последний рабочий день месяца</p>
            <p class="mt-1 text-xs text-surface-400">
              Письмо отправляется в 09:00 сотрудникам с незаполненными днями или отклонением от нормы
            </p>
          </div>
          <ToggleSwitch
            v-model="globalEnabled"
            :loading="savingGlobal"
            @change="saveGlobal"
          />
        </div>
      </template>
    </Card>

    <!-- Per-user настройки -->
    <Card>
      <template #title>Настройки по пользователям</template>
      <template #content>
        <p class="mb-4 text-sm text-surface-400">
          Можно отключить уведомления отдельным сотрудникам независимо от глобального флага.
        </p>

        <div v-if="loadingUsers" class="flex justify-center py-4">
          <ProgressSpinner style="width: 32px; height: 32px" />
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center gap-3">
            <InputText
              v-model="searchQuery"
              placeholder="Поиск: email / имя / фамилия"
              class="w-full"
            />
            <span class="text-xs text-surface-400 whitespace-nowrap">
              {{ filteredUsers.length }}
            </span>
          </div>

          <div v-if="filteredUsers.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div v-for="(userColumn, columnIndex) in userColumns" :key="columnIndex" class="space-y-2">
              <div
                v-for="user in userColumn"
                :key="user.id"
                class="flex items-center justify-between gap-3 rounded-lg border border-surface-100 bg-surface-0 px-3 py-2"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-surface-800 truncate">
                    {{ user.last_name }} {{ user.first_name }}
                  </p>
                  <p class="text-xs text-surface-400 truncate">{{ user.email }}</p>
                </div>
                <ToggleSwitch
                  v-model="userEnabled[user.id]"
                  @change="saveUserSetting(user.id)"
                />
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-surface-400 py-4 text-center">
            Пользователи не найдены
          </p>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { useNotificationsStore } from '@/stores/notifications.js';
import { useUiStore } from '@/stores/ui.js';
import { useUsersStore } from '@/stores/users.js';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';

defineOptions({ name: 'NotificationsPage' });

const toast = useToast();
const uiStore = useUiStore();
const notificationsStore = useNotificationsStore();
const usersStore = useUsersStore();
const { globalEnabled } = storeToRefs(notificationsStore);

onMounted(() => {
  uiStore.setPageTitle('Уведомления');
  loadSettings();
  loadUsers();
});

const savingGlobal = ref(false);
const users = ref([]);
const userEnabled = reactive({});
const loadingUsers = ref(false);
const searchQuery = ref('');

const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) { return users.value; }
  return users.value.filter((u) => {
    const fn = (u.first_name ?? '').toLowerCase();
    const ln = (u.last_name ?? '').toLowerCase();
    const em = (u.email ?? '').toLowerCase();
    return fn.includes(q) || ln.includes(q) || em.includes(q);
  });
});

const userColumns = computed(() => {
  const cols = [[], [], []];
  filteredUsers.value.forEach((u, i) => {
    cols[i % 3].push(u);
  });
  return cols;
});

async function loadSettings() {
  await notificationsStore.fetchSettings();
}

async function saveGlobal() {
  savingGlobal.value = true;
  try {
    await notificationsStore.updateGlobal(globalEnabled.value);
    toast.add({
      severity: 'success',
      summary: globalEnabled.value ? 'Рассылка включена' : 'Рассылка отключена',
      life: 3000,
    });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
    globalEnabled.value = !globalEnabled.value;
  } finally {
    savingGlobal.value = false;
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    await Promise.all([
      usersStore.fetchList({ status: 'active' }),
      notificationsStore.fetchSettings(),
    ]);
    users.value = usersStore.users;

    for (const user of users.value) {
      userEnabled[user.id] = true;
    }
  } finally {
    loadingUsers.value = false;
  }
}

async function saveUserSetting(userId) {
  try {
    await notificationsStore.updateUser(userId, userEnabled[userId]);
    toast.add({ severity: 'success', summary: 'Настройка сохранена', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
    userEnabled[userId] = !userEnabled[userId];
  }
}
</script>
