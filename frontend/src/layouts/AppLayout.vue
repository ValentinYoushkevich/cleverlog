<template>
  <div class="flex h-screen overflow-hidden bg-surface-50">
    <aside class="flex w-64 shrink-0 flex-col border-r border-surface-200 bg-surface-0">
      <div class="flex h-16 items-center border-b border-surface-200 px-6">
        <span class="text-xl font-bold text-primary">CleverLog</span>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100"
              activeClass="bg-primary-50 text-primary font-medium"
            >
              <i :class="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>

        <template v-if="isAdmin">
          <div class="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
            Администрирование
          </div>
          <ul class="space-y-1">
            <li v-for="item in adminNavItems" :key="item.name">
              <RouterLink
                :to="{ name: item.name }"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100"
                activeClass="bg-primary-50 text-primary font-medium"
              >
                <i :class="item.icon" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
          <div class="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
            Отладка
          </div>
          <ul class="space-y-1">
            <li v-for="item in debugNavItems" :key="item.name">
              <RouterLink
                :to="{ name: item.name }"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-surface-700 transition-colors hover:bg-surface-100"
                activeClass="bg-primary-50 text-primary font-medium"
              >
                <i :class="item.icon" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </nav>

      <div class="border-t border-surface-200 p-4">
        <div class="flex items-center gap-3">
          <Avatar :label="userInitials" shape="circle" class="bg-primary text-white" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-surface-800">{{ userName }}</p>
            <p class="truncate text-xs text-surface-400">{{ userRole }}</p>
          </div>
          <Button
            icon="pi pi-sign-out"
            text
            rounded
            severity="secondary"
            size="small"
            @click="handleLogout"
          />
        </div>
      </div>
    </aside>

    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-surface-200 bg-surface-0 px-6">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium capitalize text-surface-700">
            {{ calendarStore.monthLabel }}
          </span>
          <Tag v-if="isClosed" value="Месяц закрыт" severity="danger" icon="pi pi-lock" />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="isAdmin"
            :label="monthToggleLabel"
            :severity="monthToggleSeverity"
            size="small"
            :icon="monthToggleIcon"
            @click="handleMonthToggle"
          />
        </div>
      </header>

      <main class="flex-1 overflow-auto p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useMonthClosuresStore } from '@/stores/monthClosures.js';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

defineOptions({ name: 'AppLayout' });

const authStore = useAuthStore();
const calendarStore = useCalendarStore();
const monthClosuresStore = useMonthClosuresStore();

const confirm = useConfirm();
const toast = useToast();

const isAdmin = computed(() => authStore.isAdmin);
const userName = computed(() => authStore.userName);
const userRole = computed(() => authStore.user?.role ?? '');
const userInitials = computed(() => authStore.userInitials);
const isClosed = computed(() => calendarStore.isClosed);
const monthToggleLabel = computed(() => (isClosed.value ? 'Открыть месяц' : 'Закрыть месяц'));
const monthToggleSeverity = computed(() => (isClosed.value ? 'secondary' : 'warning'));
const monthToggleIcon = computed(() => (isClosed.value ? 'pi pi-lock-open' : 'pi pi-lock'));

const navItems = [
  { name: 'calendar', label: 'Календарь', icon: 'pi pi-calendar' },
  { name: 'work-logs', label: 'Рабочие логи', icon: 'pi pi-clock' },
  { name: 'absences', label: 'Отсутствия', icon: 'pi pi-calendar-times' },
  { name: 'reports-user', label: 'Мой отчет', icon: 'pi pi-chart-bar' },
  { name: 'profile', label: 'Профиль', icon: 'pi pi-user' },
];

const adminNavItems = [
  { name: 'dashboard', label: 'Дашборд', icon: 'pi pi-th-large' },
  { name: 'reports-project', label: 'Отчет по проекту', icon: 'pi pi-briefcase' },
  { name: 'reports-monthly-summary', label: 'Свод по месяцу', icon: 'pi pi-table' },
  { name: 'reports-unlogged', label: 'Незаполнившие дни', icon: 'pi pi-exclamation-triangle' },
  { name: 'admin-users', label: 'Пользователи', icon: 'pi pi-users' },
  { name: 'admin-projects', label: 'Проекты', icon: 'pi pi-folder' },
  { name: 'admin-custom-fields', label: 'Кастомные поля', icon: 'pi pi-sliders-h' },
  { name: 'admin-calendar', label: 'Календарь', icon: 'pi pi-calendar-plus' },
  { name: 'admin-notifications', label: 'Уведомления', icon: 'pi pi-bell' },
  { name: 'admin-audit-logs', label: 'Журнал аудита', icon: 'pi pi-list' },
];

const debugNavItems = [
  { name: 'admin-js-errors', label: 'Ошибки фронта', icon: 'pi pi-exclamation-triangle' },
];

async function handleLogout() {
  await authStore.logout();
}

async function handleMonthToggle() {
  const year = calendarStore.currentYear;
  const month = calendarStore.currentMonth;
  const action = calendarStore.isClosed ? 'открыть' : 'закрыть';

  confirm.require({
    message: `Вы уверены, что хотите ${action} месяц?`,
    header: 'Подтверждение',
    icon: 'pi pi-lock',
    acceptSeverity: 'danger',
    acceptProps: { severity: 'danger' },
    acceptLabel: action.charAt(0).toUpperCase() + action.slice(1),
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        if (calendarStore.isClosed) {
          await monthClosuresStore.open(year, month);
        } else {
          await monthClosuresStore.close(year, month);
        }
        await calendarStore.fetchMonth(year, month);
        toast.add({
          severity: 'success',
          summary: `Месяц ${action === 'закрыть' ? 'закрыт' : 'открыт'}`,
          life: 3000,
        });
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: err.response?.data?.message ?? 'Ошибка',
          life: 3000,
        });
      }
    },
  });
}
</script>
