# DATABASE_SCHEMA.md — Схема базы данных CleverLog

> PostgreSQL 16. Все первичные ключи — UUID (`uuid_generate_v4()`).
> Все таблицы имеют `created_at`, `updated_at` (auto). Soft delete через `deleted_at` где указано.
> Enum-значения — строго строчные строки как указано ниже.

---

## Расширения PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- или pgcrypto: CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## users

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| email | varchar(255) | NO | — | Уникальный, lowercase |
| password_hash | varchar(255) | YES | null | null пока не прошёл регистрацию по инвайту |
| first_name | varchar(100) | NO | — | |
| last_name | varchar(100) | NO | — | |
| position | varchar(150) | YES | null | Должность |
| role | varchar(20) | NO | 'user' | Enum: `user`, `admin` |
| status | varchar(20) | NO | 'active' | Enum: `active`, `inactive` |
| failed_attempts | integer | NO | 0 | Счётчик неудачных входов |
| locked_until | timestamptz | YES | null | Блокировка до этого времени |
| invite_token_hash | varchar(255) | YES | null | Хэш инвайт-токена |
| invite_expires_at | timestamptz | YES | null | Срок действия инвайта (72ч) |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | null | Soft delete |

**Индексы:** `email` (unique), `deleted_at`

---

## projects

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | varchar(200) | NO | — | Уникальное название |
| status | varchar(20) | NO | 'active' | Enum: `active`, `on_hold`, `closed` |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | null | Soft delete |

**Индексы:** `status`, `deleted_at`

---

## custom_fields

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | varchar(150) | NO | — | Название поля |
| type | varchar(20) | NO | — | Enum: `text`, `number`, `dropdown`, `checkbox` |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | null | Soft delete |

---

## custom_field_options

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| custom_field_id | uuid | NO | — | FK → custom_fields.id |
| label | varchar(200) | NO | — | Значение варианта |
| is_deprecated | boolean | NO | false | Скрыт от новых записей |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `custom_field_id`

---

## project_custom_fields

Привязка кастомных полей к проектам.

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| project_id | uuid | NO | — | FK → projects.id |
| custom_field_id | uuid | NO | — | FK → custom_fields.id |
| is_required | boolean | NO | false | Обязательное при создании Work Log |
| is_enabled | boolean | NO | true | Показывать ли поле в форме |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `(project_id, custom_field_id)` (unique)

---

## work_logs

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| user_id | uuid | NO | — | FK → users.id |
| project_id | uuid | NO | — | FK → projects.id |
| date | date | NO | — | Дата лога (не в будущем) |
| duration_days | decimal(10,4) | NO | — | Хранится в днях (1d = 8h) |
| task_number | varchar(50) | NO | — | Номер задачи, например TASK-123 |
| comment | text | NO | — | Описание работы |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `user_id`, `project_id`, `date`, `(user_id, date)`

> Нет `deleted_at` — логи удаляются физически.

---

## work_log_custom_values

Значения кастомных полей для конкретного Work Log.

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| work_log_id | uuid | NO | — | FK → work_logs.id (CASCADE DELETE) |
| custom_field_id | uuid | NO | — | FK → custom_fields.id |
| value | text | YES | null | Значение (всегда как строка) |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `(work_log_id, custom_field_id)` (unique)

---

## absences

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| user_id | uuid | NO | — | FK → users.id |
| type | varchar(20) | NO | — | Enum: `vacation`, `sick_leave`, `day_off` |
| date | date | NO | — | Конкретный день (одна запись = один день) |
| duration_days | decimal(10,4) | NO | 1.0 | Обычно 1.0, может быть 0.5 |
| comment | text | YES | null | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `user_id`, `date`, `(user_id, date)`

> Нет `deleted_at` — удаляются физически.
> Один пользователь не может иметь Work Log и Absence на одну дату.

---

## calendar_days

Хранятся только явно переопределённые Admin дни. Все остальные считаются по умолчанию: пн–пт = `working`, сб–вс = `weekend`.

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| date | date | NO | — | Уникальная дата |
| day_type | varchar(20) | NO | — | Enum: `working`, `weekend`, `holiday` |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `date` (unique)

---

## calendar_settings

Норма часов за месяц. Хранится только если Admin явно изменил. По умолчанию = 168ч.

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| year | integer | NO | — | Год |
| month | integer | NO | — | Месяц (1–12) |
| norm_hours | decimal(6,2) | NO | 168.00 | Норма часов за месяц |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `(year, month)` (unique)

---

## month_closures

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| year | integer | NO | — | Год |
| month | integer | NO | — | Месяц (1–12) |
| closed_at | timestamptz | NO | now() | Когда закрыт |
| closed_by | uuid | NO | — | FK → users.id (кто закрыл) |
| created_at | timestamptz | NO | now() | |

**Индексы:** `(year, month)` (unique)

> Если запись есть — месяц закрыт. Нет записи — открыт.
> User в закрытом месяце: только чтение. Admin — полный доступ.

---

## audit_logs

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| timestamp | timestamptz | NO | now() | Время события |
| actor_id | uuid | YES | null | FK → users.id (null = системное событие) |
| actor_role | varchar(20) | YES | null | Роль на момент события: `user`, `admin` |
| event_type | varchar(100) | NO | — | Константа события (см. ниже) |
| entity_type | varchar(50) | YES | null | Тип сущности: `user`, `project`, `work_log`, `absence`, `calendar`, `month_closure` |
| entity_id | uuid | YES | null | ID затронутой сущности |
| before | jsonb | YES | null | Снапшот ДО изменения |
| after | jsonb | YES | null | Снапшот ПОСЛЕ изменения |
| ip | varchar(45) | YES | null | IP-адрес клиента |
| result | varchar(20) | NO | 'success' | Enum: `success`, `failure` |

**Индексы:** `actor_id`, `event_type`, `entity_type`, `timestamp`, `result`

> Записи не удаляются и не обновляются — только INSERT.

### Типы событий (event_type)

```
LOGIN                  LOGOUT                 REGISTER
LOGIN_FAILED           PASSWORD_CHANGED       INVITE_SENT
INVITE_RESENT

USER_CREATED           USER_UPDATED           USER_DEACTIVATED

PROJECT_CREATED        PROJECT_UPDATED

CUSTOM_FIELD_CREATED   CUSTOM_FIELD_UPDATED   CUSTOM_FIELD_DELETED
CUSTOM_FIELD_RESTORED  PROJECT_FIELD_ATTACHED PROJECT_FIELD_UPDATED
PROJECT_FIELD_DETACHED

WORK_LOG_CREATED       WORK_LOG_UPDATED       WORK_LOG_DELETED

ABSENCE_CREATED        ABSENCE_UPDATED        ABSENCE_DELETED

CALENDAR_DAY_UPDATED   CALENDAR_NORM_UPDATED

MONTH_CLOSED           MONTH_OPENED

NOTIFICATION_SETTINGS_UPDATED
```

---

## notification_settings

| Колонка | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| id | uuid | NO | uuid_generate_v4() | PK |
| user_id | uuid | YES | null | FK → users.id. null = глобальная запись |
| global_enabled | boolean | NO | true | Только в глобальной записи (user_id IS NULL) |
| enabled | boolean | NO | true | Per-user флаг |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Индексы:** `user_id` (unique)

> Глобальная запись: `user_id IS NULL`. Одна строка.
> Per-user: `user_id = <uuid>`. Только явные переопределения — если записи нет, считать `enabled = true`.

---

## Связи (ERD кратко)

```
users ──< work_logs >── projects
users ──< absences
users ──< audit_logs (actor_id)
users ──< notification_settings

projects ──< project_custom_fields >── custom_fields
custom_fields ──< custom_field_options

work_logs ──< work_log_custom_values >── custom_fields

month_closures → users (closed_by)
```

---

## Важные бизнес-ограничения на уровне БД

```sql
-- Уникальность Work Log по пользователю не нужна (несколько логов в день — норма)
-- Уникальность Absence: один пользователь — одна запись на дату
ALTER TABLE absences ADD CONSTRAINT uq_absence_user_date UNIQUE (user_id, date);

-- month_closures: один закрытый месяц
ALTER TABLE month_closures ADD CONSTRAINT uq_month_closure UNIQUE (year, month);

-- calendar_days: один override на дату
ALTER TABLE calendar_days ADD CONSTRAINT uq_calendar_day UNIQUE (date);

-- calendar_settings: одна норма на месяц/год
ALTER TABLE calendar_settings ADD CONSTRAINT uq_calendar_settings UNIQUE (year, month);

-- project_custom_fields: поле привязано к проекту один раз
ALTER TABLE project_custom_fields
  ADD CONSTRAINT uq_project_custom_field UNIQUE (project_id, custom_field_id);
```

---

## Константы времени

```js
// src/constants/time.js
export const DAY_IN_HOURS = 8;        // 1 рабочий день = 8 часов
export const HOUR_IN_MINUTES = 60;
export const DAY_IN_MINUTES = DAY_IN_HOURS * HOUR_IN_MINUTES; // 480

// Предупреждение (не блокировка) при превышении
export const DAILY_HOURS_WARN_THRESHOLD = 12;

// Инвайт
export const INVITE_TOKEN_TTL_HOURS = 72;

// Блокировка после неудачных входов
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES = 10;
```
