/**
 * Глобальный доступ к Toast для вызова из Pinia stores.
 * Экземпляр устанавливается в App.vue через setToast(useToast()).
 */

let toastInstance = null;

export function setToast(toast) {
  toastInstance = toast;
}

export function showError(err) {
  const detail = err?.response?.data?.message ?? err?.message ?? 'Неизвестная ошибка';
  const summary = err?.name ?? 'Ошибка';
  if (toastInstance) {
    toastInstance.add({ severity: 'error', summary, detail, life: 5000 });
  }
}
