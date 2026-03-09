<template>
  <div>
    <!-- Глобальный спиннер при первой инициализации -->
    <div
      v-if="initializing"
      class="flex min-h-screen items-center justify-center"
    >
      <div class="text-center">
        <ProgressSpinner />
        <p class="mt-4 text-sm text-surface-400">Загрузка...</p>
      </div>
    </div>
    <template v-else>
      <RouterView />
      <Toast position="top-right" />
      <ConfirmDialog />
    </template>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.js';
import { useCalendarStore } from '@/stores/calendar.js';
import { useProjectsStore } from '@/stores/projects.js';
import { setupErrorLogger } from '@/utils/errorLogger.js';
import dayjs from 'dayjs';
import ConfirmDialog from 'primevue/confirmdialog';
import ProgressSpinner from 'primevue/progressspinner';
import Toast from 'primevue/toast';
import { onMounted, ref } from 'vue';

defineOptions({ name: 'App' });

const initializing = ref(true);
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const calendarStore = useCalendarStore();

onMounted(async () => {
  setupErrorLogger();

  try {
    await authStore.fetchMe();

    if (authStore.isAuthenticated) {
      await Promise.all([
        projectsStore.fetchProjects(),
        calendarStore.fetchMonth(dayjs().year(), dayjs().month() + 1),
      ]);
    }
  } finally {
    initializing.value = false;
  }
});
</script>
