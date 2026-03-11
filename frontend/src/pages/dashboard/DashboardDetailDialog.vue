<template>
  <Dialog
    v-model:visible="visible"
    :header="header"
    modal
    class="w-full max-w-6xl"
  >
    <DataTable
      :value="detailUsers"
      :loading="detailLoading"
      paginator
      :rows="20"
      stripedRows
    >
      <Column field="user_name" header="Сотрудник" sortable style="min-width: 160px" />
      <Column field="fact_hours" header="Факт (ч)" sortable style="width: 110px">
        <template #body="{ data }">
          {{ data.fact_hours }} ч
        </template>
      </Column>
      <Column field="absence_hours" header="Отсутствие (ч)" style="width: 140px">
        <template #body="{ data }">
          {{ data.absence_hours }} ч
        </template>
      </Column>
      <Column field="deviation" header="Отклонение" sortable style="width: 120px">
        <template #body="{ data }">
          <span :class="data.deviationTextClass">
            {{ data.deviationPrefix }}{{ data.deviation }} ч
          </span>
        </template>
      </Column>
      <Column field="top2_projects" header="TOP-2 проектов" style="min-width: 180px">
        <template #body="{ data }">
          <div class="space-y-0.5">
            <div
              v-for="projectItem in data.top2_projects"
              :key="projectItem.name"
              class="text-xs"
            >
              <span class="font-medium">{{ projectItem.name }}</span>
              <span class="text-surface-400 ml-1">{{ projectItem.hours }}ч</span>
            </div>
          </div>
        </template>
      </Column>
      <Column field="unlogged_count" header="Незапол. дней" style="width: 130px">
        <template #body="{ data }">
          <span :class="data.unloggedCountClass">
            {{ data.unlogged_count }}
          </span>
        </template>
      </Column>
      <Column field="last_log_date" header="Последний лог" style="width: 140px">
        <template #body="{ data }">
          <span class="text-surface-500 text-xs">
            {{ data.last_log_date ?? '—' }}
          </span>
        </template>
      </Column>
      <Column header="" style="width: 60px">
        <template #body="{ data }">
          <Button
            v-tooltip="'Отчёт по пользователю'"
            icon="pi pi-user"
            text
            rounded
            size="small"
            @click="emit('open-user-report', data.user_id)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="text-center py-6 text-surface-400">
          Нет данных
        </div>
      </template>
    </DataTable>
  </Dialog>
</template>

<script setup>
defineOptions({ name: 'DashboardDetailDialog' });

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  detailType: { type: String, default: '' },
  detailUsers: { type: Array, default: () => [] },
  detailLoading: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'close', 'open-user-report']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);
    if (!value) {
      emit('close');
    }
  },
});

const DETAIL_TITLES = {
  undertime: 'Сотрудники с недоработкой',
  overtime: 'Сотрудники с переработкой',
  unlogged: 'Сотрудники с незаполненными днями',
};

const header = computed(() => DETAIL_TITLES[props.detailType] ?? '');
</script>
