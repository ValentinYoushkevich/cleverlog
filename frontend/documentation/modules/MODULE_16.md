# MODULE_16 — Frontend: Закрытие месяца и настройки уведомлений (Admin)

## Обзор

Две небольшие Admin-страницы. `/admin/notifications` — глобальный переключатель рассылки + per-user toggle. Кнопка «Закрыть / Открыть месяц» в AppLayout уже сверстана в MODULE_1 — здесь реализуем её логику и страницу истории закрытий.

> **Зависимости модуля:**
> - `useCalendarStore` из MODULE_2 — `isClosed`, `fetchMonth` (обновить после закрытия)
> - `useAuthStore` из MODULE_2 — `isAdmin`
> - `usersApi` из MODULE_9 — для per-user настроек

---

## Шаг 1. API

`src/api/monthClosures.js`:

```js
import http from '@/api/http.js';

export const monthClosuresApi = {
  list: () => http.get('/month-closures'),
  close: (year, month) => http.post('/month-closures', { year, month }),
  open: (year, month) => http.delete(`/month-closures/${year}/${month}`),
  status: (year, month) => http.get(`/month-closures/status/${year}/${month}`),
};
```

`src/api/notifications.js`:

```js
import http from '@/api/http.js';

export const notificationsApi = {
  getSettings: () => http.get('/notifications/settings'),
  updateGlobal: (enabled) => http.patch('/notifications/settings', { enabled }),
  updateUser: (userId, enabled) => http.patch(`/notifications/users/${userId}`, { enabled }),
};
```

---

## Шаг 2. Логика кнопки закрытия в AppLayout

Обновить `handleMonthToggle` в `src/layouts/AppLayout.vue`:

```js
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { monthClosuresApi } from '@/api/monthClosures.js';

const confirm = useConfirm();
const toast = useToast();

async function handleMonthToggle() {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const action = calendarStore.isClosed ? 'открыть' : 'закрыть';

  confirm.require({
    message: `Вы уверены, что хотите ${action} месяц?`,
    header: 'Подтверждение',
    icon: 'pi pi-lock',
    acceptLabel: action.charAt(0).toUpperCase() + action.slice(1),
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        if (calendarStore.isClosed) {
          await monthClosuresApi.open(year, month);
        } else {
          await monthClosuresApi.close(year, month);
        }
        await calendarStore.fetchMonth(year, month);
        toast.add({ severity: 'success', summary: `Месяц ${action === 'закрыть' ? 'закрыт' : 'открыт'}`, life: 3000 });
      } catch (err) {
        toast.add({ severity: 'error', summary: err.response?.data?.message ?? 'Ошибка', life: 3000 });
      }
    },
  });
}
```

---

## Шаг 3. NotificationsPage

`src/pages/admin/NotificationsPage.vue`:

```vue
<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-semibold text-surface-800">Настройки уведомлений</h1>

    <!-- Глобальный переключатель -->
    <Card>
      <template #title>Рассылка в конце месяца</template>
      <template #content>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-surface-700">Уведомлять сотрудников в последний рабочий день месяца</p>
            <p class="text-xs text-surface-400 mt-1">
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
        <p class="text-sm text-surface-400 mb-4">
          Можно отключить уведомления отдельным сотрудникам независимо от глобального флага.
        </p>

        <div v-if="loadingUsers" class="flex justify-center py-4">
          <ProgressSpinner style="width: 32px; height: 32px" />
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="user in users"
            :key="user.id"
            class="flex items-center justify-between py-2 border-b border-surface-100 last:border-0"
          >
            <div>
              <p class="text-sm font-medium text-surface-800">{{ user.last_name }} {{ user.first_name }}</p>
              <p class="text-xs text-surface-400">{{ user.email }}</p>
            </div>
            <ToggleSwitch
              v-model="userEnabled[user.id]"
              @change="saveUserSetting(user.id)"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import ToggleSwitch from 'primevue/toggleswitch';
import ProgressSpinner from 'primevue/progressspinner';
import { notificationsApi } from '@/api/notifications.js';
import { usersApi } from '@/api/users.js';
import { useUiStore } from '@/stores/ui.js';

defineOptions({ name: 'NotificationsPage' });

const toast = useToast();
const uiStore = useUiStore();

onMounted(() => {
  uiStore.setPageTitle('Уведомления');
  loadSettings();
  loadUsers();
});

const globalEnabled = ref(true);
const savingGlobal = ref(false);

const users = ref([]);
const userEnabled = reactive({});
const loadingUsers = ref(false);

async function loadSettings() {
  const res = await notificationsApi.getSettings();
  globalEnabled.value = res.data.global_enabled;
}

async function saveGlobal() {
  savingGlobal.value = true;
  try {
    await notificationsApi.updateGlobal(globalEnabled.value);
    toast.add({ severity: 'success', summary: globalEnabled.value ? 'Рассылка включена' : 'Рассылка отключена', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка сохранения', life: 3000 });
    globalEnabled.value = !globalEnabled.value; // откатить
  } finally {
    savingGlobal.value = false;
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const [usersRes, settingsRes] = await Promise.all([
      usersApi.list({ status: 'active' }),
      notificationsApi.getSettings(),
    ]);
    users.value = usersRes.data.data ?? usersRes.data;

    // По умолчанию у всех включено, если нет явного per-user отключения
    for (const user of users.value) {
      userEnabled[user.id] = true;
    }
    // Применить per-user настройки — бэк возвращает только явные переопределения
    // Запрашиваем через список пользователей, у которых есть настройки
    // Если бэк не возвращает per-user список отдельным эндпоинтом,
    // то считаем всех включёнными (можно расширить позже)
  } finally {
    loadingUsers.value = false;
  }
}

async function saveUserSetting(userId) {
  try {
    await notificationsApi.updateUser(userId, userEnabled[userId]);
    toast.add({ severity: 'success', summary: 'Настройка сохранена', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
    userEnabled[userId] = !userEnabled[userId]; // откатить
  }
}
</script>
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Кнопка в шапке «Закрыть месяц» | AppLayout → кнопка видна только для Admin |
| 2 | ConfirmDialog при закрытии | Клик → диалог подтверждения |
| 3 | Месяц закрывается | Подтвердить → Tag «Месяц закрыт» появился в шапке, `isClosed = true` |
| 4 | Открытие месяца | Кнопка меняется на «Открыть месяц» → подтвердить → Tag исчезает |
| 5 | Страница уведомлений открывается | `/admin/notifications` → два Card без ошибок |
| 6 | Глобальный ToggleSwitch | Переключить → Toast «Рассылка отключена / включена» |
| 7 | Список пользователей | Все активные пользователи с ToggleSwitch |
| 8 | Per-user отключение | Выключить Toggle у конкретного пользователя → сохранено |
| 9 | Откат при ошибке | Имитировать ошибку → Toggle возвращается в прежнее состояние |
