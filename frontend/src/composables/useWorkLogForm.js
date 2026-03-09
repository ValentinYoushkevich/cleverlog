import http from '@/api/http.js';

export function useWorkLogForm() {
  const projectFields = ref([]);
  const loadingFields = ref(false);

  async function loadProjectFields(projectId) {
    if (!projectId) {
      projectFields.value = [];
      return;
    }

    loadingFields.value = true;
    try {
      const res = await http.get(`/projects/${projectId}/custom-fields`);
      projectFields.value = res.data.filter((field) => field.is_enabled);
    } finally {
      loadingFields.value = false;
    }
  }

  return { projectFields, loadingFields, loadProjectFields };
}
