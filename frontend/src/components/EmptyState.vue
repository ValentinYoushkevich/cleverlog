<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div
      class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-100"
    >
      <i :class="icon" class="text-2xl text-surface-400" />
    </div>
    <h3 class="mb-1 text-base font-medium text-surface-600">{{ title }}</h3>
    <p v-if="description" class="max-w-xs text-sm text-surface-400">
      {{ description }}
    </p>
    <slot name="action" />
  </div>
</template>

<script setup>
defineOptions({ name: 'EmptyState' });
defineProps({
  icon: { type: String, default: 'pi pi-inbox' },
  title: { type: String, default: 'Нет данных' },
  description: { type: String, default: '' },
});
</script>
