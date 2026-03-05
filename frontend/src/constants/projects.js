export const PROJECT_STATUS_OPTIONS = [
  { value: 'active', label: 'Активный' },
  { value: 'on_hold', label: 'На паузе' },
  { value: 'closed', label: 'Закрыт' },
];

export const PROJECT_STATUS_SEVERITY = {
  active: 'success',
  on_hold: 'warn',
  closed: 'danger',
};

export const PROJECT_STATUS_LABEL = {
  active: 'Активный',
  on_hold: 'На паузе',
  closed: 'Закрыт',
};

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'dropdown', label: 'Список' },
  { value: 'checkbox', label: 'Флажок' },
];
