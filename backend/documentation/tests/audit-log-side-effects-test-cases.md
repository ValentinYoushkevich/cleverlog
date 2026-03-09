# Тест-кейсы: Audit Log Side Effects

> Эти тесты проверяют не роуты `/api/audit-logs`, а то что каждая значимая операция
> оставляет корректную запись в таблице `audit_logs`.
>
> Паттерн каждого теста:
> 1. Выполнить операцию через Supertest
> 2. Напрямую запросить БД: `db('audit_logs').orderBy('timestamp', 'desc').first()`
> 3. Проверить поля записи

---

## Auth

**1. Успешный логин создаёт запись LOGIN**
- Залогиниться с верными данными
- Проверить последнюю запись в audit_logs:
  `event_type === 'LOGIN'`, `result === 'success'`, `entity_type === 'user'`, `actor_id` совпадает с id пользователя

**2. Неверный пароль создаёт запись LOGIN_FAILED**
- POST /auth/login с неверным паролем
- Проверить: `event_type === 'LOGIN_FAILED'`, `result === 'failure'`

**3. Логин заблокированного аккаунта создаёт запись LOGIN_FAILED с reason ACCOUNT_LOCKED**
- Заблокировать аккаунт, попытаться залогиниться
- Проверить: `event_type === 'LOGIN_FAILED'`, `after.reason === 'ACCOUNT_LOCKED'`

**4. Логаут создаёт запись LOGOUT**
- Залогиниться, затем POST /auth/logout
- Проверить: `event_type === 'LOGOUT'`, `result === 'success'`

**5. Регистрация создаёт запись REGISTER**
- Зарегистрироваться по инвайту
- Проверить: `event_type === 'REGISTER'`, `result === 'success'`, `entity_type === 'user'`

**6. Смена пароля создаёт запись PASSWORD_CHANGED**
- POST /auth/change-password
- Проверить: `event_type === 'PASSWORD_CHANGED'`, `result === 'success'`

**7. Обновление профиля создаёт запись PROFILE_UPDATED с before/after**
- PATCH /auth/profile
- Проверить: `event_type === 'PROFILE_UPDATED'`, `before` содержит старые значения, `after` содержит новые

---

## Users

**8. Создание пользователя создаёт запись USER_CREATED**
- POST /users
- Проверить: `event_type === 'USER_CREATED'`, `after.email` совпадает, `after.role` совпадает

**9. Обновление пользователя создаёт запись USER_UPDATED с before/after**
- PATCH /users/:id
- Проверить: `event_type === 'USER_UPDATED'`, `before` содержит старые поля, `after` содержит изменённые

**10. Повторная отправка инвайта создаёт запись INVITE_RESENT**
- POST /users/:id/resend-invite
- Проверить: `event_type === 'INVITE_RESENT'`, `entity_id === id пользователя`

**11. Регенерация ссылки создаёт запись INVITE_LINK_REGENERATED**
- POST /users/:id/regenerate-link
- Проверить: `event_type === 'INVITE_LINK_REGENERATED'`

**12. Регенерация email-инвайта создаёт запись INVITE_EMAIL_REGENERATED**
- POST /users/:id/regenerate-email-invite
- Проверить: `event_type === 'INVITE_EMAIL_REGENERATED'`

---

## Projects

**13. Создание проекта создаёт запись PROJECT_CREATED**
- POST /projects
- Проверить: `event_type === 'PROJECT_CREATED'`, `after.name` совпадает, `entity_type === 'project'`

**14. Обновление проекта создаёт запись PROJECT_UPDATED с before/after**
- PATCH /projects/:id с `{ status: 'closed' }`
- Проверить: `event_type === 'PROJECT_UPDATED'`, `before.status` — старый, `after.status === 'closed'`

---

## Work Logs

**15. Создание work_log создаёт запись WORK_LOG_CREATED**
- POST /work-logs
- Проверить: `event_type === 'WORK_LOG_CREATED'`, `after.date` совпадает, `after.project_id` совпадает

**16. Обновление work_log создаёт запись WORK_LOG_UPDATED с before/after**
- PATCH /work-logs/:id
- Проверить: `event_type === 'WORK_LOG_UPDATED'`, `before` содержит старые значения

**17. Удаление work_log создаёт запись WORK_LOG_DELETED с before**
- DELETE /work-logs/:id
- Проверить: `event_type === 'WORK_LOG_DELETED'`, `before.date` и `before.duration_days` заполнены

---

## Absences

**18. Создание absence создаёт запись ABSENCE_CREATED**
- POST /absences
- Проверить: `event_type === 'ABSENCE_CREATED'`, `after.type` совпадает, `after.dates` содержит созданные даты

**19. Обновление absence создаёт запись ABSENCE_UPDATED с before/after**
- PATCH /absences/:id
- Проверить: `event_type === 'ABSENCE_UPDATED'`, `before` содержит старые поля

**20. Удаление absence создаёт запись ABSENCE_DELETED с before**
- DELETE /absences/:id
- Проверить: `event_type === 'ABSENCE_DELETED'`, `before.date` и `before.type` заполнены

---

## Calendar

**21. Изменение статуса дня создаёт запись CALENDAR_DAY_UPDATED**
- PATCH /calendar/days/:date
- Проверить: `event_type === 'CALENDAR_DAY_UPDATED'`, `after.date` и `after.day_type` заполнены

**22. Изменение статуса существующего дня сохраняет before**
- Установить override, затем PATCH с другим day_type
- Проверить: `before.day_type` содержит предыдущее значение

**23. Изменение нормы создаёт запись CALENDAR_NORM_UPDATED**
- PUT /calendar/norm/:year/:month
- Проверить: `event_type === 'CALENDAR_NORM_UPDATED'`, `after.norm_hours` совпадает

---

## Month Closures

**24. Закрытие месяца создаёт запись MONTH_CLOSED**
- POST /month-closures
- Проверить: `event_type === 'MONTH_CLOSED'`, `after.year` и `after.month` совпадают

**25. Открытие месяца создаёт запись MONTH_OPENED**
- DELETE /month-closures/:year/:month
- Проверить: `event_type === 'MONTH_OPENED'`, `before.year` и `before.month` заполнены

---

## Custom Fields

**26. Создание кастомного поля создаёт запись CUSTOM_FIELD_CREATED**
- POST /custom-fields
- Проверить: `event_type === 'CUSTOM_FIELD_CREATED'`, `after.name` и `after.type` совпадают

**27. Обновление кастомного поля создаёт запись CUSTOM_FIELD_UPDATED с before/after**
- PATCH /custom-fields/:id
- Проверить: `event_type === 'CUSTOM_FIELD_UPDATED'`, `before.name` — старое, `after.name` — новое

**28. Soft delete создаёт запись CUSTOM_FIELD_DELETED**
- DELETE /custom-fields/:id
- Проверить: `event_type === 'CUSTOM_FIELD_DELETED'`, `entity_id` совпадает

**29. Restore создаёт запись CUSTOM_FIELD_RESTORED**
- POST /custom-fields/:id/restore
- Проверить: `event_type === 'CUSTOM_FIELD_RESTORED'`

**30. Добавление опции создаёт запись CUSTOM_FIELD_OPTION_ADDED**
- POST /custom-fields/:id/options
- Проверить: `event_type === 'CUSTOM_FIELD_OPTION_ADDED'`, `after.label` совпадает

**31. Deprecate опции создаёт запись CUSTOM_FIELD_OPTION_DEPRECATED**
- DELETE /custom-fields/:id/options/:optionId
- Проверить: `event_type === 'CUSTOM_FIELD_OPTION_DEPRECATED'`, `after.option_id` совпадает

---

## Project Custom Fields

**32. Привязка поля к проекту создаёт запись CUSTOM_FIELD_ATTACHED**
- POST /projects/:projectId/custom-fields
- Проверить: `event_type === 'CUSTOM_FIELD_ATTACHED'`, `entity_type === 'project'`, `entity_id === projectId`

**33. Обновление привязки создаёт запись CUSTOM_FIELD_PROJECT_UPDATED**
- PATCH /projects/:projectId/custom-fields/:fieldId (для существующей привязки)
- Проверить: `event_type === 'CUSTOM_FIELD_PROJECT_UPDATED'`

**34. Открепление поля создаёт запись CUSTOM_FIELD_DETACHED**
- DELETE /projects/:projectId/custom-fields/:fieldId
- Проверить: `event_type === 'CUSTOM_FIELD_DETACHED'`, `after.custom_field_id` совпадает

---

## Notifications

**35. Обновление глобальных настроек создаёт запись NOTIFICATIONS_GLOBAL_UPDATED**
- PATCH /notifications/settings
- Проверить: `event_type === 'NOTIFICATIONS_GLOBAL_UPDATED'`, `after.global_enabled` совпадает

**36. Обновление настроек пользователя создаёт запись NOTIFICATIONS_USER_UPDATED**
- PATCH /notifications/users/:userId
- Проверить: `event_type === 'NOTIFICATIONS_USER_UPDATED'`, `entity_id === userId`, `after.enabled` совпадает

---

## Общие проверки структуры записи

**37. Каждая audit_log запись содержит ip адрес**
- Выполнить любую операцию (например POST /auth/login)
- Проверить: поле `ip` в записи не null и не пустое

**38. actor_id корректно проставляется для всех операций**
- Залогиниться как конкретный пользователь, выполнить операцию
- Проверить: `actor_id` в записи совпадает с id этого пользователя

**39. Неудачные операции не создают лишних success-записей**
- Попытаться создать work_log с неверными данными (400)
- Проверить: в audit_logs нет новой записи с `result === 'success'` после этой операции
