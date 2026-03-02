<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-50">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-primary">CleverLog</h1>
        <p class="mt-1 text-surface-500">Система учета рабочего времени</p>
      </div>
      <RouterView />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'AuthLayout' });
</script>
