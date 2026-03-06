import argon2 from 'argon2';

export async function seed(knex) {
  // Cleanup in FK-safe order
  await knex('notification_settings').del();
  await knex('audit_logs').del();
  await knex('month_closures').del();
  await knex('absences').del();
  await knex('work_log_custom_values').del();
  await knex('work_logs').del();
  await knex('calendar_days').del();
  await knex('calendar_settings').del();
  await knex('project_custom_fields').del();
  await knex('custom_field_options').del();
  await knex('custom_fields').del();
  await knex('projects').del();
  await knex('users').del();

  const adminHash = await argon2.hash('Admin' + '1234!');
  const userHash = await argon2.hash('User' + '1234!');

  const [admin] = await knex('users')
    .insert({
      first_name: 'Супер',
      last_name: 'Админ',
      email: 'admin@cleverlog.local',
      password_hash: adminHash,
      role: 'admin',
      position: 'System Administrator',
      status: 'active',
      hire_date: '2024-01-01',
    })
    .returning('*');

  const users = await knex('users')
    .insert([
      {
        first_name: 'Иван',
        last_name: 'Иванов',
        email: 'ivanov@cleverlog.local',
        password_hash: userHash,
        role: 'user',
        position: 'Developer',
        status: 'active',
        hire_date: '2024-03-01',
      },
      {
        first_name: 'Мария',
        last_name: 'Петрова',
        email: 'petrova@cleverlog.local',
        password_hash: userHash,
        role: 'user',
        position: 'Designer',
        status: 'active',
        hire_date: '2024-06-01',
      },
    ])
    .returning('*');

  const [ivan, maria] = users;

  const projects = await knex('projects')
    .insert([
      { name: 'CleverLog MVP', status: 'active' },
      { name: 'Internal Tools', status: 'on_hold' },
    ])
    .returning('*');

  const [projectA, projectB] = projects;

  // Custom fields (5 total, 2 deleted)
  const deletedAt1 = new Date('2026-01-15T10:00:00Z');
  const deletedAt2 = new Date('2026-02-10T10:00:00Z');

  const customFields = await knex('custom_fields')
    .insert([
      { name: 'Клиент', type: 'text', deleted_at: null },
      { name: 'Приоритет', type: 'dropdown', deleted_at: null },
      { name: 'Срочно', type: 'checkbox', deleted_at: null },
      { name: 'Старое поле (удалено)', type: 'number', deleted_at: deletedAt1 },
      { name: 'Статус задачи (удалено)', type: 'dropdown', deleted_at: deletedAt2 },
    ])
    .returning('*');

  const priorityField = customFields.find((f) => f.name === 'Приоритет');
  const deletedDropdownField = customFields.find((f) => f.name === 'Статус задачи (удалено)');

  if (priorityField) {
    await knex('custom_field_options').insert([
      { custom_field_id: priorityField.id, label: 'Низкий', sort_order: 0 },
      { custom_field_id: priorityField.id, label: 'Средний', sort_order: 1 },
      { custom_field_id: priorityField.id, label: 'Высокий', sort_order: 2 },
    ]);
  }
  if (deletedDropdownField) {
    await knex('custom_field_options').insert([
      { custom_field_id: deletedDropdownField.id, label: 'В работе', sort_order: 0 },
      { custom_field_id: deletedDropdownField.id, label: 'Готово', sort_order: 1 },
    ]);
  }

  // Work logs: per user: Feb=2, Mar=3, Apr=4 (2026)
  function buildWorkLogsForUser(user, startTaskNumber) {
    const rows = [];
    let n = startTaskNumber;

    const push = (date, project, durationDays, comment) => {
      rows.push({
        user_id: user.id,
        project_id: project.id,
        date,
        duration_days: durationDays,
        comment,
        task_number: `CL-${n}`,
      });
      n += 1;
    };

    // February (2)
    push('2026-02-05', projectA, 1, 'Работа над задачей');
    push('2026-02-18', projectB, 0.5, 'Созвон и правки');

    // March (3)
    push('2026-03-03', projectA, 1, 'Разработка фичи');
    push('2026-03-12', projectA, 0.75, 'Доработка и тесты');
    push('2026-03-25', projectB, 0.5, 'Рефакторинг');

    // April (4)
    push('2026-04-02', projectA, 1, 'Новая задача');
    push('2026-04-10', projectB, 0.5, 'Мелкие исправления');
    push('2026-04-17', projectA, 0.75, 'Код-ревью и правки');
    push('2026-04-28', projectB, 1, 'Закрытие задач месяца');

    return rows;
  }

  const workLogs = [
    ...buildWorkLogsForUser(admin, 100),
    ...buildWorkLogsForUser(ivan, 200),
    ...buildWorkLogsForUser(maria, 300),
  ];

  await knex('work_logs').insert(workLogs);

  const now = new Date();
  await knex('calendar_settings').insert({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    norm_hours: 168,
  });

  await knex('notification_settings').insert({
    global_enabled: true,
    enabled: true,
  });
}
