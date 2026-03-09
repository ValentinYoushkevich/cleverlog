<template>
  <div>
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
    </template>
    <Toast position="top-right" />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import router from '@/router/index.js';
import { setupErrorLogger } from '@/utils/errorLogger.js';
import { setToast } from '@/utils/toast.js';
import ConfirmDialog from 'primevue/confirmdialog';
import ProgressSpinner from 'primevue/progressspinner';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

defineOptions({ name: 'App' });

const initializing = ref(true);
const toast = useToast();

onMounted(async () => {
  setToast(toast);
  setupErrorLogger();

  // Дожидаемся, пока роутер (и guards) полностью разрешат стартовый маршрут
  await router.isReady();
  initializing.value = false;
});
</script>
