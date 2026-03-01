<template>
  <div class="flex h-screen">
    <aside>Sidebar placeholder</aside>
    <main class="flex-1 overflow-auto p-4">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
defineOptions({ name: 'AppLayout' });
</script>
