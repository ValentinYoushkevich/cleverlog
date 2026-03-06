const EVENT_LABELS = {
  REGISTER: 'Регистрация',
  LOGIN: 'Вход',
  LOGIN_FAILED: 'Неуспешный вход',
  LOGOUT: 'Выход',
  PASSWORD_CHANGED: 'Смена пароля',
  PROFILE_UPDATED: 'Обновление профиля',

  USER_CREATED: 'Создание пользователя',
  USER_UPDATED: 'Обновление пользователя',
  INVITE_RESENT: 'Повторная отправка инвайта',
  INVITE_LINK_REGENERATED: 'Перегенерация ссылки-инвайта',
  INVITE_EMAIL_REGENERATED: 'Перегенерация email-инвайта',

  CALENDAR_DAY_UPDATED: 'Изменение типа дня',
  CALENDAR_NORM_UPDATED: 'Изменение нормы часов',

  MONTH_CLOSED: 'Закрытие месяца',
  MONTH_OPENED: 'Открытие месяца',

  PROJECT_CREATED: 'Создание проекта',
  PROJECT_UPDATED: 'Обновление проекта',

  WORK_LOG_CREATED: 'Создание рабочего лога',
  WORK_LOG_UPDATED: 'Обновление рабочего лога',
  WORK_LOG_DELETED: 'Удаление рабочего лога',

  ABSENCE_CREATED: 'Создание отсутствия',
  ABSENCE_UPDATED: 'Обновление отсутствия',
  ABSENCE_DELETED: 'Удаление отсутствия',

  CUSTOM_FIELD_CREATED: 'Создание кастомного поля',
  CUSTOM_FIELD_UPDATED: 'Обновление кастомного поля',
  CUSTOM_FIELD_DELETED: 'Удаление кастомного поля',
  CUSTOM_FIELD_RESTORED: 'Восстановление кастомного поля',
  CUSTOM_FIELD_OPTION_ADDED: 'Добавление варианта',
  CUSTOM_FIELD_OPTION_DEPRECATED: 'Удаление варианта',
  CUSTOM_FIELD_ATTACHED: 'Привязка поля к проекту',
  CUSTOM_FIELD_PROJECT_UPDATED: 'Изменение настроек поля в проекте',
  CUSTOM_FIELD_DETACHED: 'Отвязка поля от проекта',
};

export async function up(knex) {
  // Backfill only rows where label is missing or equals the code.
  for (const [event_type, event_label] of Object.entries(EVENT_LABELS)) {
     
    await knex('audit_logs')
      .where({ event_type })
      .andWhere((qb) => qb.whereNull('event_label').orWhere('event_label', event_type))
      .update({ event_label });
  }

  // Ensure we always have some label.
  await knex('audit_logs')
    .whereNull('event_label')
    .update({ event_label: knex.raw('event_type') });
}

export async function down(knex) {
  // Revert backfilled labels to code for known events.
  for (const event_type of Object.keys(EVENT_LABELS)) {
     
    await knex('audit_logs')
      .where({ event_type })
      .update({ event_label: event_type });
  }
}
