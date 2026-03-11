<template>
  <Dialog
    v-model:visible="visible"
    header="Детали ошибки"
    modal
    class="w-full max-w-2xl"
  >
    <div v-if="selected" class="space-y-4 text-sm">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <span class="text-surface-400">Время:</span>
          {{ selectedCreatedAtText }}
        </div>
        <div>
          <span class="text-surface-400">IP:</span>
          <span class="font-mono">{{ selected.ip || '—' }}</span>
        </div>
      </div>
      <div>
        <p class="text-surface-400 mb-1">Сообщение</p>
        <p class="font-medium text-surface-800 wrap-break-word">
          {{ selected.message }}
        </p>
      </div>
      <div v-if="selected.source">
        <p class="text-surface-400 mb-1">Источник (файл)</p>
        <p class="font-mono text-xs break-all">
          {{ selected.source }}
        </p>
      </div>
      <div
        v-if="showSelectedLocation"
        class="flex gap-4"
      >
        <span v-if="selected.lineno !== null">
          <span class="text-surface-400">Строка:</span>
          {{ selected.lineno }}
        </span>
        <span v-if="selected.colno !== null">
          <span class="text-surface-400">Колонка:</span>
          {{ selected.colno }}
        </span>
      </div>
      <div v-if="selected.url">
        <p class="text-surface-400 mb-1">URL страницы</p>
        <p class="font-mono text-xs break-all">
          {{ selected.url }}
        </p>
      </div>
      <div v-if="selected.stack">
        <p class="text-surface-400 mb-1">Стек</p>
        <pre
          class="text-xs bg-surface-100 border border-surface-200 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all"
        >{{ selected.stack }}</pre>
      </div>
      <div v-if="selected.user_agent">
        <p class="text-surface-400 mb-1">User-Agent</p>
        <p class="text-xs break-all text-surface-600">
          {{ selected.user_agent }}
        </p>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'JsErrorDetailDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  selected: { type: Object, default: null },
  selectedCreatedAtText: { type: String, default: '' },
  showSelectedLocation: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'close']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);
    if (!value) {
      emit('close');
    }
  },
});
</script>
