# MODULE_18 — Frontend: Привязка кастомных полей к проектам

## Обзор

Расширение страницы `/admin/projects` — по клику на проект открывается боковая панель (Drawer) с управлением кастомными полями: список привязанных полей, переключатели is_required / is_enabled, кнопка привязки нового поля из глобального списка, отвязка.

> **Зависимости модуля:**
> - `useProjectsStore` (getProjectFields, attachField, updateProjectField, detachField) из MODULE_13
> - `useCustomFieldsStore` (fetchList) из MODULE_13
> - Страница `ProjectsPage` из MODULE_13 — добавляем Drawer внутрь
>
> **Важно (не потерять при реализации):**
> - Это не отдельная страница.
> - MODULE_18 расширяет уже существующий `ProjectsPage` из MODULE_13:
>   - добавляется колонка в текущую таблицу;
>   - добавляются `Drawer` и `Dialog` внутрь того же компонента.

---

## Шаг 1. Обновление ProjectsPage — добавить колонку и Drawer

Дополнить `src/pages/admin/ProjectsPage.vue`:

Добавить колонку в таблицу:

```vue
<Column header="Поля" style="width: 100px">
  <template #body="{ data }">
    <Button
      icon="pi pi-sliders-h"
      text rounded size="small"
      v-tooltip="'Кастомные поля'"
      @click="openFieldsDrawer(data)"
    />
  </template>
</Column>
```

Добавить Drawer после таблицы:

```vue
<Drawer
  v-model:visible="fieldsDrawerVisible"
  :header="`Поля проекта: ${drawerProject?.name}`"
  position="right"
  class="!w-full !max-w-lg"
>
  <div class="space-y-4">
    <!-- Привязанные поля -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-medium text-surface-700">Привязанные поля</h3>
        <Button label="Привязать поле" icon="pi pi-plus" size="small" text @click="openAttachDialog" />
      </div>

      <div v-if="loadingFields" class="flex justify-center py-4">
        <ProgressSpinner style="width: 28px; height: 28px" />
      </div>

      <div v-else-if="projectFields.length" class="space-y-2">
        <div
          v-for="field in projectFields"
          :key="field.custom_field_id"
          class="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-surface-800">{{ field.name }}</p>
            <p class="text-xs text-surface-400">{{ TYPE_LABEL[field.type] }}</p>
          </div>

          <div class="flex items-center gap-4 text-xs text-surface-500">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <ToggleSwitch
                v-model="field.is_enabled"
                size="small"
                @change="updateField(field, 'is_enabled')"
              />
              Включено
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <ToggleSwitch
                v-model="field.is_required"
                size="small"
                @change="updateField(field, 'is_required')"
              />
              Обязательное
            </label>
          </div>

          <Button
            icon="pi pi-times"
            text rounded size="small"
            severity="danger"
            v-tooltip="'Отвязать'"
            @click="detachField(field)"
          />
        </div>
      </div>

      <p v-else class="text-sm text-surface-400 py-4 text-center">
        Нет привязанных полей
      </p>
    </div>
  </div>
</Drawer>

<!-- Dialog: привязка поля -->
<Dialog v-model:visible="attachDialogVisible" header="Привязать поле" modal class="w-full max-w-sm">
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-surface-700 mb-1">Поле</label>
      <Select
        v-model="attachForm.field_id"
        :options="availableFields"
        optionLabel="name"
        optionValue="id"
        placeholder="Выберите поле"
        class="w-full"
      />
    </div>
    <div class="flex items-center gap-3">
      <ToggleSwitch v-model="attachForm.is_required" />
      <span class="text-sm text-surface-700">Обязательное</span>
    </div>
    <div class="flex items-center gap-3">
      <ToggleSwitch v-model="attachForm.is_enabled" />
      <span class="text-sm text-surface-700">Включено</span>
    </div>
    <div class="flex justify-end gap-2">
      <Button label="Отмена" severity="secondary" @click="attachDialogVisible = false" />
      <Button label="Привязать" :loading="submitting" @click="attachField" />
    </div>
  </div>
</Dialog>
```

Добавить в `<script setup>` ProjectsPage (использовать `useProjectsStore` и `useCustomFieldsStore` из MODULE_13):

```js
import { ref, reactive, computed } from 'vue';
import Drawer from 'primevue/drawer';
import ToggleSwitch from 'primevue/toggleswitch';
import ProgressSpinner from 'primevue/progressspinner';
import { useCustomFieldsStore } from '@/stores/customFields.js';

const customFieldsStore = useCustomFieldsStore();
const TYPE_LABEL = { text: 'Текст', number: 'Число', dropdown: 'Список', checkbox: 'Флажок' };

// --- Drawer с полями ---
const fieldsDrawerVisible = ref(false);
const drawerProject = ref(null);
const projectFields = ref([]);
const loadingFields = ref(false);

async function openFieldsDrawer(project) {
  drawerProject.value = project;
  fieldsDrawerVisible.value = true;
  await loadProjectFields();
}

async function loadProjectFields() {
  loadingFields.value = true;
  try {
    const data = await projectsStore.getProjectFields(drawerProject.value.id);
    projectFields.value = data ?? [];
  } finally {
    loadingFields.value = false;
  }
}

async function updateField(field, key) {
  try {
    await projectsStore.updateProjectField(drawerProject.value.id, field.custom_field_id, {
      is_required: field.is_required,
      is_enabled: field.is_enabled,
    });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
    await loadProjectFields(); // откатить
  }
}

async function detachField(field) {
  try {
    await projectsStore.detachField(drawerProject.value.id, field.custom_field_id);
    await loadProjectFields();
    toast.add({ severity: 'success', summary: 'Поле отвязано', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Ошибка', life: 3000 });
  }
}

// --- Dialog: привязка ---
const attachDialogVisible = ref(false);
const allFields = ref([]);
const attachForm = reactive({ field_id: null, is_required: false, is_enabled: true });

const availableFields = computed(() => {
  const attached = new Set(projectFields.value.map(f => f.custom_field_id));
  return allFields.value.filter(f => !attached.has(f.id) && !f.is_deleted);
});

async function openAttachDialog() {
  await customFieldsStore.fetchList();
  allFields.value = customFieldsStore.fields ?? [];
  Object.assign(attachForm, { field_id: null, is_required: false, is_enabled: true });
  attachDialogVisible.value = true;
}

async function attachField() {
  if (!attachForm.field_id) return;
  submitting.value = true;
  try {
    await projectsStore.attachFieldToProject(drawerProject.value.id, {
      custom_field_id: attachForm.field_id,
      is_required: attachForm.is_required,
      is_enabled: attachForm.is_enabled,
    });
    toast.add({ severity: 'success', summary: 'Поле привязано', life: 2000 });
    attachDialogVisible.value = false;
    await loadProjectFields();
  } catch (err) {
    toast.add({ severity: 'error', summary: err.response?.data?.message ?? 'Ошибка', life: 3000 });
  } finally {
    submitting.value = false;
  }
}
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Кнопка полей в таблице проектов | Каждая строка имеет иконку `pi-sliders-h` | ✅ выполнено |
| 2 | Drawer открывается | Клик → Drawer с заголовком «Поля проекта: Название» | ✅ выполнено |
| 3 | Список привязанных полей | Поля с типами, переключателями и кнопкой отвязки | ✅ выполнено |
| 4 | Toggle is_enabled | Переключить → мгновенно сохраняется, Toast | ✅ выполнено |
| 5 | Toggle is_required | Переключить → мгновенно сохраняется | ✅ выполнено |
| 6 | Отвязка поля | Кнопка ✕ → поле исчезло из списка | ✅ выполнено |
| 7 | Привязка нового поля | «Привязать поле» → Dialog → Select показывает только непривязанные | ✅ выполнено |
| 8 | Уже привязанные не в списке | В Select не появляются уже привязанные поля | ✅ выполнено |
| 9 | Привязка с is_required | Поле появляется в списке с `is_required = true` | ✅ выполнено |
| 10 | Форма Work Log реагирует | В MODULE_5 выбрать этот проект → поле появляется в форме | ✅ выполнено |

ПРОДУМАТЬ ГДЕ ПОКАЗЫВАТЬ КАСТОМНЫЕ ПОЛЯ В ОТЧЕТАХ
Отчёты — колонки с кастомными полями в отчёте по пользователю и по проекту, плюс фильтры в отчёте по проекту.
Экспорт — выгрузка в Excel с колонками кастомных полей.