<template>
  <Dialog
    v-model:visible="visible"
    header="Детали записи"
    modal
    class="w-full max-w-2xl"
  >
    <div v-if="selectedLog" class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-surface-400">Событие:</span>
          <span class="font-medium">
            {{ selectedLog.event?.name ?? '—' }}
          </span>
          <span class="font-mono text-xs text-surface-400">
            ({{ selectedLog.event?.type ?? '—' }})
          </span>
        </div>
        <div>
          <span class="text-surface-400">Время:</span>
          {{ timestampText }}
        </div>
        <div>
          <span class="text-surface-400">Актор:</span>
          {{ actorNameText }}
        </div>
        <div>
          <span class="text-surface-400">IP:</span>
          <span class="font-mono">{{ selectedLog.ip ?? '—' }}</span>
        </div>
      </div>

      <div v-if="beforeText" class="space-y-1">
        <p class="text-sm font-medium text-surface-700">
          До:
        </p>
        <pre class="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-auto max-h-48">
{{ beforeText }}
</pre>
      </div>

      <div v-if="afterText" class="space-y-1">
        <p class="text-sm font-medium text-surface-700">
          После:
        </p>
        <pre class="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-auto max-h-48">
{{ afterText }}
</pre>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'AuditLogDetailDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  selectedLog: { type: Object, default: null },
  timestampText: { type: String, default: '' },
  actorNameText: { type: String, default: '' },
  beforeText: { type: String, default: '' },
  afterText: { type: String, default: '' },
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
