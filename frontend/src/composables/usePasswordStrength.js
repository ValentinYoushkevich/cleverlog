export function usePasswordStrength(password) {
  const criteria = computed(() => [
    { label: 'Минимум 8 символов', met: password.value?.length >= 8 },
    { label: 'Заглавная буква', met: /[A-Z]/.test(password.value ?? '') },
    { label: 'Строчная буква', met: /[a-z]/.test(password.value ?? '') },
    { label: 'Цифра', met: /\d/.test(password.value ?? '') },
    { label: 'Спецсимвол', met: /[^a-zA-Z\d]/.test(password.value ?? '') },
  ]);

  const strength = computed(() => criteria.value.filter((criterion) => criterion.met).length);
  const isStrong = computed(() => strength.value === 5);

  const strengthLabel = computed(() => {
    if (strength.value <= 1) { return { text: 'Очень слабый', severity: 'danger' }; }
    if (strength.value <= 2) { return { text: 'Слабый', severity: 'danger' }; }
    if (strength.value <= 3) { return { text: 'Средний', severity: 'warn' }; }
    if (strength.value <= 4) { return { text: 'Хороший', severity: 'info' }; }
    return { text: 'Сильный', severity: 'success' };
  });

  return { criteria, strength, isStrong, strengthLabel };
}
