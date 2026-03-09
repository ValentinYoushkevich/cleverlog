DCopyCleverLog — Backend: список модулей (v2)
0. Инициализация проекта
npm init, установка зависимостей (express, dotenv, cors, helmet, morgan, knex, pg, argon2, jsonwebtoken, cookie-parser, nodemailer, exceljs, zod, node-cron, winston). Настройка структуры папок (routes, controllers, services, repositories, middlewares, utils, config). Конфигурация .env, базовый app.js, server.js. Подключение к PostgreSQL через Docker. Базовый health-check эндпоинт GET /api/health.

1. База данных — миграции и сиды
Написание миграций для всех сущностей: users, projects, work_logs, absences, calendar_settings, calendar_days, custom_fields, custom_field_options, project_custom_fields, work_log_custom_values, month_closures, audit_logs, notification_settings. Поля ролей и статусов предусмотреть сразу. Seed-данные для разработки (тестовый admin + несколько users + проекты).

2. Аутентификация
Регистрация по инвайту: POST /api/auth/register. Логин: POST /api/auth/login (JWT в HttpOnly cookie). Логаут: POST /api/auth/logout. Middleware authenticate. Блокировка после 5 неверных попыток на 10 минут. Хэширование паролей Argon2id. Смена пароля: POST /api/auth/change-password. Политика паролей через zod. Логирование в audit_log.

3. Пользователи
GET /api/users — список (фильтр по статусу, роли, тегам). GET /api/users/:id. POST /api/users — создание + генерация и отправка инвайта. PATCH /api/users/:id — редактирование, смена роли, смена статуса Active/Inactive. Инвалидация сессий при переводе в Inactive. Все операции пишутся в audit_log.

4. Проекты
GET /api/projects — список (фильтр по статусу). GET /api/projects/:id. POST /api/projects. PATCH /api/projects/:id — переименование, смена статуса (Active / On Hold / Closed) в любую сторону. Все операции пишутся в audit_log.

5. Кастомные поля
GET /api/custom-fields. POST /api/custom-fields — создание (Text / Number / Dropdown / Checkbox). PATCH /api/custom-fields/:id — переименование; смена типа запрещена если поле используется. DELETE /api/custom-fields/:id — soft delete. POST /api/custom-fields/:id/restore. Опции Dropdown: POST/DELETE /api/custom-fields/:id/options (удалённые помечаются устаревшими). Привязка к проектам: POST /api/projects/:id/custom-fields. Все операции пишутся в audit_log.

6. Календарь
GET /api/calendar/:year/:month — данные за месяц (статусы дней, норма). PATCH /api/calendar/days/:date — смена статуса дня. GET/PUT /api/calendar/norm/:year/:month — норма часов. Смена статуса не удаляет логи. Все операции пишутся в audit_log.

7. Work Logs
GET /api/work-logs — список с фильтрами (пользователь, проект, период, Task Number, комментарий, кастомные поля). POST /api/work-logs — создание (валидация: не в будущее; проект Active; нельзя смешивать с Absence; предупреждение при >12h/день). PATCH /api/work-logs/:id. DELETE /api/work-logs/:id. Хранение в днях, конвертация из m/h/d. Проверка закрытия месяца. Все операции пишутся в audit_log.

8. Absences
GET /api/absences — список с фильтрами. POST /api/absences — создание диапазоном: автопропуск выходных и дней с Work Log (с уведомлением в ответе). PATCH /api/absences/:id — нельзя перенести на выходной. DELETE /api/absences/:id. Проверка закрытия месяца. Все операции пишутся в audit_log.

9. Закрытие месяца
GET /api/month-closures — список. POST /api/month-closures — закрыть месяц. DELETE /api/month-closures/:yearMonth — открыть. Middleware checkMonthClosed — используется в Work Logs и Absences. Все операции пишутся в audit_log.

10. Отчёты + Экспорт Excel
GET /api/reports/user — отчёт по пользователю: строки, итоги, блок Факт/Норма/Отклонение при полном месяце. GET /api/reports/project — отчёт по проекту (только Work, разбивка по пользователям). GET /api/reports/monthly-summary — свод (пользователи × проекты + Absence + Факт). GET /api/reports/unlogged — незаполнившие. GET /api/export/user, /api/export/project, /api/export/monthly-summary, /api/export/unlogged — экспорт через exceljs. Логика подсчёта в service-слое.

11. Дашборд
GET /api/dashboard — агрегат за период: часы по проектам, распределение сотрудников, карточки недоработки/переработки/незаполненных. GET /api/dashboard/users?type=undertime|overtime|unlogged — детализация по карточке.

12. Журнал аудита
GET /api/audit-logs — список с фильтрами (actor, event_type, entity_type, период, ip, result, поиск), пагинация. GET /api/audit-logs/export — экспорт в Excel.

13. Уведомления (Email)
node-cron задача: каждый день в 09:00 проверяет последний рабочий день месяца, отправляет письма пользователям с незаполненными днями или Факт < Нормы. GET/PATCH /api/notification-settings — глобальное включение/выключение. PATCH /api/users/:id/notification — per-user.

14. Логирование JS-ошибок
POST /api/log-js-error — принимает JS-ошибки с фронта, пишет в технический лог через Winston и сохраняет в БД. GET /api/js-errors — просмотр списка ошибок (admin-only).

15. RBAC — финальный модуль
Middleware authorize(roles) применяется ко всем роутам согласно матрице прав. Скрытие/ограничение данных на уровне сервисов (User видит только свои логи). Финальное тестирование всех сценариев доступа.