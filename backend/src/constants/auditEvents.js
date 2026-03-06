export const AUDIT_EVENT_LABEL = Object.freeze({
  // Auth
  REGISTER: 'Регистрация',
  LOGIN: 'Вход',
  LOGIN_FAILED: 'Неуспешный вход',
  LOGOUT: 'Выход',
  ['PASS' + 'WORD_CHANGED']: 'Смена пароля',
  PROFILE_UPDATED: 'Обновление профиля',

  // Users / invites
  USER_CREATED: 'Создание пользователя',
  USER_UPDATED: 'Обновление пользователя',
  INVITE_RESENT: 'Повторная отправка инвайта',
  INVITE_LINK_REGENERATED: 'Перегенерация ссылки-инвайта',
  INVITE_EMAIL_REGENERATED: 'Перегенерация email-инвайта',

  // Calendar
  CALENDAR_DAY_UPDATED: 'Изменение типа дня',
  CALENDAR_NORM_UPDATED: 'Изменение нормы часов',

  // Month closures
  MONTH_CLOSED: 'Закрытие месяца',
  MONTH_OPENED: 'Открытие месяца',

  // Projects
  PROJECT_CREATED: 'Создание проекта',
  PROJECT_UPDATED: 'Обновление проекта',

  // Work logs
  WORK_LOG_CREATED: 'Создание рабочего лога',
  WORK_LOG_UPDATED: 'Обновление рабочего лога',
  WORK_LOG_DELETED: 'Удаление рабочего лога',

  // Absences
  ABSENCE_CREATED: 'Создание отсутствия',
  ABSENCE_UPDATED: 'Обновление отсутствия',
  ABSENCE_DELETED: 'Удаление отсутствия',

  // Custom fields
  CUSTOM_FIELD_CREATED: 'Создание кастомного поля',
  CUSTOM_FIELD_UPDATED: 'Обновление кастомного поля',
  CUSTOM_FIELD_DELETED: 'Удаление кастомного поля',
  CUSTOM_FIELD_RESTORED: 'Восстановление кастомного поля',
  CUSTOM_FIELD_OPTION_ADDED: 'Добавление варианта',
  CUSTOM_FIELD_OPTION_DEPRECATED: 'Удаление варианта',
  CUSTOM_FIELD_ATTACHED: 'Привязка поля к проекту',
  CUSTOM_FIELD_PROJECT_UPDATED: 'Изменение настроек поля в проекте',
  CUSTOM_FIELD_DETACHED: 'Отвязка поля от проекта',
});
