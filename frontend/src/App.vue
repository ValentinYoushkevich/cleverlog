<template>
  <RouterView />
  <Toast />
  <ConfirmDialog />
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.js';
import { useProjectsStore } from '@/stores/projects.js';
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import { onMounted } from 'vue';

defineOptions({ name: 'App' });

const authStore = useAuthStore();
const projectsStore = useProjectsStore();

onMounted(async () => {
  await authStore.fetchMe();
  if (authStore.isAuthenticated) {
    await projectsStore.fetchProjects();
  }
});
</script>
