<template>
  <RouterView />
  <Toast />
  <ConfirmDialog />
</template>

<script setup>
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';

defineOptions({ name: 'App' });
</script>
