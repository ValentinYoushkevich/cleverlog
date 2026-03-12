import argon2 from 'argon2';
import { ROLES } from '../../src/constants/roles.js';

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

  // --- Users (1 admin + 2 employees) ---
  const adminHash = await argon2.hash('Admin' + '1234!');
  const userHash = await argon2.hash('User' + '1234!');

  const [admin] = await knex('users')
    .insert({
      first_name: 'Админ',
      last_name: 'Супер',
      email: 'admin@cleverlog.local',
      password_hash: adminHash,
      role: ROLES.ADMIN,
      position: 'System Administrator',
      status: 'active',
      hire_date: '2024-01-01',
    })
    .returning('*');

  const [frontendUser, backendUser] = await knex('users')
    .insert([
      {
        first_name: 'Иван',
        last_name: 'Иванов',
        email: 'frontend@cleverlog.local',
        password_hash: userHash,
        role: ROLES.USER,
        position: 'Frontend Developer',
        status: 'active',
        hire_date: '2024-03-01',
      },
      {
        first_name: 'Мария',
        last_name: 'Петрова',
        email: 'backend@cleverlog.local',
        password_hash: userHash,
        role: ROLES.USER,
        position: 'Backend Developer',
        status: 'active',
        hire_date: '2024-03-01',
      },
    ])
    .returning('*');

  // --- Projects (3 simple projects) ---
  const [projectA, projectB, projectC] = await knex('projects')
    .insert([
      { name: 'CleverLog MVP', status: 'active' },
      { name: 'Internal Tools', status: 'active' },
      { name: 'Website Redesign', status: 'active' },
    ])
    .returning('*');

  // --- Custom fields (3 active) ---
  const [, typeField] = await knex('custom_fields')
    .insert([
      { name: 'Клиент', type: 'text', deleted_at: null },
      { name: 'Тип задачи', type: 'dropdown', deleted_at: null },
      { name: 'Срочно', type: 'checkbox', deleted_at: null },
    ])
    .returning('*');

  if (typeField) {
    await knex('custom_field_options').insert([
      { custom_field_id: typeField.id, label: 'Разработка', sort_order: 0 },
      { custom_field_id: typeField.id, label: 'Рефакторинг', sort_order: 1 },
      { custom_field_id: typeField.id, label: 'Поддержка', sort_order: 2 },
    ]);
  }

  // --- Work logs: по 3–4 лога на каждого в одном месяце (март 2026) ---
  const YEAR = 2026;
  const MONTH = 3;
  const makeDate = (day) => `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const workLogs = [
    // Admin
    {
      user_id: admin.id,
      project_id: projectA.id,
      date: makeDate(1),
      duration_days: 0.5,
      comment: 'Настройка CleverLog',
      task_number: 'CL-100',
    },
    {
      user_id: admin.id,
      project_id: projectB.id,
      date: makeDate(5),
      duration_days: 0.5,
      comment: 'Администрирование Internal Tools',
      task_number: 'CL-101',
    },

    // Frontend user
    {
      user_id: frontendUser.id,
      project_id: projectA.id,
      date: makeDate(3),
      duration_days: 1,
      comment: 'Верстка календаря',
      task_number: 'CL-200',
    },
    {
      user_id: frontendUser.id,
      project_id: projectC.id,
      date: makeDate(7),
      duration_days: 0.5,
      comment: 'Исправление багов',
      task_number: 'CL-201',
    },
    {
      user_id: frontendUser.id,
      project_id: projectA.id,
      date: makeDate(10),
      duration_days: 0.5,
      comment: 'UI‑улучшения',
      task_number: 'CL-202',
    },

    // Backend user
    {
      user_id: backendUser.id,
      project_id: projectB.id,
      date: makeDate(4),
      duration_days: 1,
      comment: 'API для отчёта по пользователю',
      task_number: 'CL-300',
    },
    {
      user_id: backendUser.id,
      project_id: projectA.id,
      date: makeDate(8),
      duration_days: 0.5,
      comment: 'Оптимизация запросов',
      task_number: 'CL-301',
    },
    {
      user_id: backendUser.id,
      project_id: projectC.id,
      date: makeDate(15),
      duration_days: 0.5,
      comment: 'Интеграция с внешним сервисом',
      task_number: 'CL-302',
    },
  ];

  await knex('work_logs').insert(workLogs);

  await knex('calendar_settings').insert({
    year: YEAR,
    month: MONTH,
    norm_hours: 144,
  });

  await knex('notification_settings').insert({
    global_enabled: true,
    enabled: true,
  });
}
