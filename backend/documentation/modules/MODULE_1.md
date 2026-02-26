# MODULE_1 — Backend: База данных — миграции и сиды

## Шаг 1. Порядок миграций

Файлы создаются командой `knex migrate:make <name>` и выполняются в алфавитном (хронологическом) порядке. Префикс timestamp проставляется автоматически. Итоговый порядок:

1. `create_users`
2. `create_projects`
3. `create_custom_fields`
4. `create_custom_field_options`
5. `create_project_custom_fields`
6. `create_calendar_settings`
7. `create_calendar_days`
8. `create_work_logs`
9. `create_work_log_custom_values`
10. `create_absences`
11. `create_month_closures`
12. `create_audit_logs`
13. `create_notification_settings`

---

## Шаг 2. Миграции

### 2.1 users

```js
export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('first_name').notNullable();
    t.string('last_name').notNullable();
    t.string('email').notNullable().unique();
    t.string('password_hash').nullable();           // null до завершения регистрации
    t.enum('role', ['user', 'admin']).notNullable().defaultTo('user');
    t.string('position').nullable();
    t.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');
    t.date('hire_date').nullable();
    t.date('dismissal_date').nullable();
    t.specificType('tags', 'text[]').nullable();
    t.string('invite_token').nullable().unique();
    t.timestamp('invite_expires_at').nullable();
    t.integer('failed_login_attempts').notNullable().defaultTo(0);
    t.timestamp('locked_until').nullable();
    t.timestamps(true, true);                        // created_at, updated_at
  });
}

export async function down(knex) {
  await knex.schema.dropTable('users');
}
```

### 2.2 projects

```js
export async function up(knex) {
  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.enum('status', ['active', 'on_hold', 'closed']).notNullable().defaultTo('active');
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('projects');
}
```

### 2.3 custom_fields

```js
export async function up(knex) {
  await knex.schema.createTable('custom_fields', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.enum('type', ['text', 'number', 'dropdown', 'checkbox']).notNullable();
    t.boolean('is_deleted').notNullable().defaultTo(false); // soft delete
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('custom_fields');
}
```

### 2.4 custom_field_options

```js
export async function up(knex) {
  await knex.schema.createTable('custom_field_options', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    t.string('label').notNullable();
    t.boolean('is_deprecated').notNullable().defaultTo(false); // удалённые опции
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('custom_field_options');
}
```

### 2.5 project_custom_fields

```js
export async function up(knex) {
  await knex.schema.createTable('project_custom_fields', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    t.boolean('is_required').notNullable().defaultTo(false);
    t.boolean('is_enabled').notNullable().defaultTo(true);  // включено/выключено per-project
    t.unique(['project_id', 'custom_field_id']);
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('project_custom_fields');
}
```

### 2.6 calendar_settings

Глобальная норма часов на месяц.

```js
export async function up(knex) {
  await knex.schema.createTable('calendar_settings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.integer('year').notNullable();
    t.integer('month').notNullable();           // 1–12
    t.decimal('norm_hours', 6, 2).notNullable().defaultTo(168);
    t.unique(['year', 'month']);
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('calendar_settings');
}
```

### 2.7 calendar_days

Переопределение статуса конкретного дня (только те дни, которые Admin явно менял).

```js
export async function up(knex) {
  await knex.schema.createTable('calendar_days', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.date('date').notNullable().unique();
    t.enum('day_type', ['working', 'weekend', 'holiday']).notNullable();
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('calendar_days');
}
```

### 2.8 work_logs

Длительность хранится в днях (decimal). 1 d = 8 h = 480 m.

```js
export async function up(knex) {
  await knex.schema.createTable('work_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('RESTRICT');
    t.date('date').notNullable();
    t.decimal('duration_days', 8, 4).notNullable();  // хранение в днях
    t.text('comment').notNullable();
    t.string('task_number').notNullable();
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('work_logs');
}
```

### 2.9 work_log_custom_values

```js
export async function up(knex) {
  await knex.schema.createTable('work_log_custom_values', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('work_log_id').notNullable().references('id').inTable('work_logs').onDelete('CASCADE');
    t.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('RESTRICT');
    t.text('value').nullable();                      // всё хранится как text, парсинг на уровне сервиса
    t.unique(['work_log_id', 'custom_field_id']);
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('work_log_custom_values');
}
```

### 2.10 absences

```js
export async function up(knex) {
  await knex.schema.createTable('absences', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enum('type', ['vacation', 'sick_leave', 'day_off']).notNullable();
    t.date('date').notNullable();
    t.decimal('duration_days', 8, 4).notNullable().defaultTo(1); // по умолчанию 1 d
    t.text('comment').nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('absences');
}
```

### 2.11 month_closures

```js
export async function up(knex) {
  await knex.schema.createTable('month_closures', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.integer('year').notNullable();
    t.integer('month').notNullable();             // 1–12
    t.uuid('closed_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('closed_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['year', 'month']);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('month_closures');
}
```

### 2.12 audit_logs

```js
export async function up(knex) {
  await knex.schema.createTable('audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('actor_role').nullable();
    t.string('event_type').notNullable();          // CREATE, UPDATE, DELETE, LOGIN, etc.
    t.string('entity_type').notNullable();         // work_log, user, project, etc.
    t.uuid('entity_id').nullable();
    t.jsonb('before').nullable();
    t.jsonb('after').nullable();
    t.string('ip').nullable();
    t.string('result').notNullable().defaultTo('success'); // success | failure
  });
}

export async function down(knex) {
  await knex.schema.dropTable('audit_logs');
}
```

### 2.13 notification_settings

```js
export async function up(knex) {
  await knex.schema.createTable('notification_settings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.boolean('global_enabled').notNullable().defaultTo(true);
    t.uuid('user_id').nullable().unique().references('id').inTable('users').onDelete('CASCADE');
    // null = глобальная запись; uuid = per-user override
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('notification_settings');
}
```

---

## Шаг 3. Seed-данные

`db/seeds/01_initial.js`:

```js
import argon2 from 'argon2';

export async function seed(knex) {
  // Очистка в обратном порядке зависимостей
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

  // Admin
  const adminHash = await argon2.hash('Admin1234!');
  const [admin] = await knex('users').insert({
    first_name: 'Super',
    last_name: 'Admin',
    email: 'admin@cleverlog.local',
    password_hash: adminHash,
    role: 'admin',
    position: 'System Administrator',
    status: 'active',
    hire_date: '2024-01-01',
  }).returning('*');

  // Users
  const userHash = await argon2.hash('User1234!');
  const [user1, user2] = await knex('users').insert([
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
  ]).returning('*');

  // Projects
  const [proj1, proj2, proj3] = await knex('projects').insert([
    { name: 'CleverLog MVP', status: 'active' },
    { name: 'Internal Tools', status: 'on_hold' },
    { name: 'Legacy Migration', status: 'closed' },
  ]).returning('*');

  // Calendar norm — текущий месяц
  const now = new Date();
  await knex('calendar_settings').insert({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    norm_hours: 168,
  });

  // Global notification setting
  await knex('notification_settings').insert({ global_enabled: true });
}
```

---

## Шаг 4. Запуск миграций и сидов

```bash
# Из папки backend/
npm run migrate       # применить все миграции
npm run seed          # заполнить тестовыми данными

# Откат при необходимости
npm run migrate:rollback
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Все миграции применяются без ошибок | `npm run migrate` завершается с `Batch 1 run: 13 migrations` |
| 2 | Все таблицы созданы | Подключиться к БД: `docker exec -it cleverlog_db psql -U cleverlog_user -d cleverlog -c "\dt"` — видны все 13 таблиц |
| 3 | Сиды выполняются без ошибок | `npm run seed` завершается успешно |
| 4 | Тестовые данные в БД | `SELECT email, role FROM users;` → 3 строки (admin + 2 users) |
| 5 | Проекты созданы | `SELECT name, status FROM projects;` → 3 строки |
| 6 | Норма месяца создана | `SELECT * FROM calendar_settings;` → 1 строка с `norm_hours = 168` |
| 7 | Откат работает | `npm run migrate:rollback` — таблицы удаляются; повторный `migrate` восстанавливает |
| 8 | UUID генерируется PostgreSQL | `SELECT id FROM users LIMIT 1;` → строка формата `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
