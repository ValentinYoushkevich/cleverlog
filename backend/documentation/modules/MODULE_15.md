# MODULE_15 — Backend: RBAC — финальный модуль

## Обзор

Финальный модуль — аудит и закрытие всей ролевой модели. Middleware `authenticate` и `authorize` уже реализованы в MODULE_2 и MODULE_3. Здесь: проверка что все роуты защищены корректно, скрытие данных на уровне сервисов для User, финальная матрица покрытия и сценарии тестирования.

> **Зависимости модуля:**
> - `authenticate` из MODULE_2 — применён на всех роутах
> - `authorize('admin')` из MODULE_3 — применён на Admin-роутах
> - `checkMonthClosed` из MODULE_7 — применён на Work Logs и Absences
> - Новых файлов не создаёт — только проверки и финальная конфигурация `app.js`

---

## Шаг 1. Финальный app.js

Убедиться что все роутеры подключены в правильном порядке, а `errorHandler` стоит последним:

`app.js` (финальная версия):

```js
import 'module-alias/register.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

// Роутеры
import healthRouter from '@/routes/healthRouter.js';
import authRouter from '@/routes/authRouter.js';
import userRouter from '@/routes/userRouter.js';
import projectRouter from '@/routes/projectRouter.js';
import customFieldRouter from '@/routes/customFieldRouter.js';
import projectCustomFieldRouter from '@/routes/projectCustomFieldRouter.js';
import calendarRouter from '@/routes/calendarRouter.js';
import workLogRouter from '@/routes/workLogRouter.js';
import absenceRouter from '@/routes/absenceRouter.js';
import monthClosureRouter from '@/routes/monthClosureRouter.js';
import reportRouter from '@/routes/reportRouter.js';
import dashboardRouter from '@/routes/dashboardRouter.js';
import auditLogRouter from '@/routes/auditLogRouter.js';
import notificationRouter from '@/routes/notificationRouter.js';
import jsErrorRouter from '@/routes/jsErrorRouter.js';

// Error handler
import { errorHandler } from '@/middlewares/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Публичные роуты
app.use('/api', healthRouter);
app.use('/api', jsErrorRouter);   // без auth — ошибки до логина
app.use('/api', authRouter);

// Защищённые роуты
app.use('/api/users', userRouter);
app.use('/api/projects', projectRouter);
app.use('/api/custom-fields', customFieldRouter);
app.use('/api/projects/:projectId/custom-fields', projectCustomFieldRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/work-logs', workLogRouter);
app.use('/api/absences', absenceRouter);
app.use('/api/month-closures', monthClosureRouter);
app.use('/api/reports', reportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/notifications', notificationRouter);

// Глобальный error handler — ПОСЛЕДНИМ
app.use(errorHandler);

export default app;
```

---

## Шаг 2. Матрица покрытия роутов

| Эндпоинт | Метод | authenticate | authorize('admin') | checkMonthClosed | User-scope |
|---|---|---|---|---|---|
| `/api/health` | GET | ❌ | ❌ | ❌ | — |
| `/api/log-js-error` | POST | ❌ | ❌ | ❌ | — |
| `/api/auth/register` | POST | ❌ | ❌ | ❌ | — |
| `/api/auth/login` | POST | ❌ | ❌ | ❌ | — |
| `/api/auth/logout` | POST | ❌ | ❌ | ❌ | — |
| `/api/auth/me` | GET | ✅ | ❌ | ❌ | — |
| `/api/auth/change-password` | POST | ✅ | ❌ | ❌ | только свой |
| `/api/users` | GET/POST | ✅ | ✅ | ❌ | — |
| `/api/users/:id` | GET/PATCH | ✅ | ✅ | ❌ | — |
| `/api/projects` | GET | ✅ | ❌ | ❌ | — |
| `/api/projects` | POST | ✅ | ✅ | ❌ | — |
| `/api/projects/:id` | GET | ✅ | ❌ | ❌ | — |
| `/api/projects/:id` | PATCH | ✅ | ✅ | ❌ | — |
| `/api/custom-fields` | GET/POST/PATCH/DELETE | ✅ | ✅ | ❌ | — |
| `/api/projects/:id/custom-fields` | GET | ✅ | ❌ | ❌ | — |
| `/api/projects/:id/custom-fields` | POST/PATCH/DELETE | ✅ | ✅ | ❌ | — |
| `/api/calendar/:year/:month` | GET | ✅ | ❌ | ❌ | — |
| `/api/calendar/days/:date` | PATCH | ✅ | ✅ | ❌ | — |
| `/api/calendar/norm/:year/:month` | GET | ✅ | ❌ | ❌ | — |
| `/api/calendar/norm/:year/:month` | PUT | ✅ | ✅ | ❌ | — |
| `/api/work-logs` | GET | ✅ | ❌ | ❌ | только свои |
| `/api/work-logs` | POST | ✅ | ❌ | ✅ | только себе |
| `/api/work-logs/:id` | PATCH/DELETE | ✅ | ❌ | ✅ | только свои |
| `/api/absences` | GET | ✅ | ❌ | ❌ | только свои |
| `/api/absences` | POST | ✅ | ❌ | ✅ | только себе |
| `/api/absences/:id` | PATCH/DELETE | ✅ | ❌ | ✅ | только свои |
| `/api/month-closures/status/:y/:m` | GET | ✅ | ❌ | ❌ | — |
| `/api/month-closures` | GET/POST/DELETE | ✅ | ✅ | ❌ | — |
| `/api/reports/user` | GET | ✅ | ❌ | ❌ | только свои |
| `/api/reports/project` | GET | ✅ | ✅ | ❌ | — |
| `/api/reports/monthly-summary` | GET | ✅ | ✅ | ❌ | — |
| `/api/reports/unlogged` | GET | ✅ | ✅ | ❌ | — |
| `/api/reports/*/export` | GET | ✅ | * | ❌ | — |
| `/api/dashboard` | GET | ✅ | ✅ | ❌ | — |
| `/api/dashboard/users` | GET | ✅ | ✅ | ❌ | — |
| `/api/audit-logs` | GET | ✅ | ✅ | ❌ | — |
| `/api/audit-logs/export` | GET | ✅ | ✅ | ❌ | — |
| `/api/notifications/settings` | GET/PATCH | ✅ | ✅ | ❌ | — |
| `/api/notifications/users/:id` | PATCH | ✅ | ✅ | ❌ | — |

---

## Шаг 3. Сценарии финального тестирования

### Сценарий 1: User — полный цикл

**Статус проверки:** Сработало ✅

```
1. POST /api/auth/login → cookie
2. GET /api/auth/me → свои данные
3. GET /api/projects → все активные проекты
4. POST /api/work-logs → создать лог
5. GET /api/work-logs → видит только свои
6. GET /api/reports/user → только свой отчёт
7. GET /api/reports/project → 403
8. GET /api/dashboard → 403
9. GET /api/users → 403
10. POST /api/auth/logout → cookie очищена
```

### Сценарий 2: Admin — полный цикл

**Статус проверки:** Сработало ✅

```
1. POST /api/auth/login admin → cookie
2. GET /api/users → все пользователи
3. POST /api/users → создать user, получить инвайт
4. POST /api/projects → создать проект
5. POST /api/custom-fields → создать поле
6. PATCH /api/projects/:id/custom-fields → привязать поле
7. GET /api/work-logs → все логи всех пользователей
8. GET /api/reports/monthly-summary → сводный отчёт
9. GET /api/dashboard → дашборд с диаграммами
10. POST /api/month-closures → закрыть месяц
11. GET /api/audit-logs → журнал всех событий
```

### Сценарий 3: Закрытый месяц

**Статус проверки:** Сработало ✅

```
1. Admin: POST /api/month-closures { year, month }
2. User: POST /api/work-logs (дата в этом месяце) → 403 MONTH_CLOSED
3. User: PATCH /api/work-logs/:id → 403 MONTH_CLOSED
4. Admin: POST /api/work-logs (дата в этом месяце) → 201 (Admin может)
5. Admin: DELETE /api/month-closures/:year/:month → открыть
6. User: POST /api/work-logs → 201 (снова можно)
```

### Сценарий 4: Inactive пользователь

**Статус проверки:** Сработало ✅

```
1. Admin: PATCH /api/users/:id { status: 'inactive' }
2. User пытается запросить GET /api/auth/me → 401 (сессия инвалидирована)
3. POST /api/auth/login (inactive user) → 403 ACCOUNT_INACTIVE
4. Admin: GET /api/work-logs?user_id=:id → логи видны
5. Admin: POST /api/work-logs (от имени inactive user) → 201 (Admin может)
```

### Сценарий 5: User-scope изоляция

**Статус проверки:** Сработало ✅

```
1. Создать User A и User B
2. User A создаёт Work Log
3. User B: GET /api/work-logs → лог User A не виден
4. User B: PATCH /api/work-logs/:id_user_a → 403 FORBIDDEN
5. User B: DELETE /api/work-logs/:id_user_a → 403 FORBIDDEN
6. Admin: GET /api/work-logs → видит логи обоих
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Все роуты из матрицы покрыты | Пройти по каждой строке матрицы с User и Admin cookie | Сработало ✅ |
| 2 | Сценарий 1 проходит полностью | User не получает 403 там, где должен работать | Сработало ✅ |
| 3 | Сценарий 2 проходит полностью | Admin имеет доступ ко всем эндпоинтам | Сработало ✅ |
| 4 | Сценарий 3 (закрытый месяц) | User заблокирован, Admin нет | Сработало ✅ |
| 5 | Сценарий 4 (inactive) | Inactive не может войти; его данные доступны Admin | Сработало ✅ |
| 6 | Сценарий 5 (изоляция) | User видит только свои данные во всех эндпоинтах | Сработало ✅ |
| 7 | errorHandler ловит все ошибки | Выбросить ошибку в любом сервисе → 500 с JSON (не HTML stack trace) | Сработало ✅ |
| 8 | Нет незащищённых Admin-роутов | Перебрать все POST/PATCH/DELETE с User-cookie → только ожидаемые 403 | Сработало ✅ |
| 9 | CORS настроен | Запрос с `http://localhost:5173` → нет ошибок CORS; с другого origin → блок | Сработало ✅ |
| 10 | Cookie HttpOnly | В DevTools → cookie `token` имеет флаг HttpOnly, недоступна из JS | Сработало ✅ |
