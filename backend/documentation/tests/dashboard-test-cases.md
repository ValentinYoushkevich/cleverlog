# Тест-кейсы: Dashboard модуль

> Все роуты закрыты `authenticate + authorize('admin')`.

---

## GET /api/dashboard

**1. Успешно возвращает сводку за месяц**
- Создать пользователей, проекты, work_logs и absences за январь 2025
- GET /dashboard?year=2025&month=1
- Ожидать: 200, тело содержит `year`, `month`, `norm`, `charts`, `cards`

**2. charts.hours_by_project содержит корректные данные**
- Создать work_logs для двух проектов
- GET /dashboard?year=2025&month=1
- Ожидать: `charts.hours_by_project` содержит оба проекта с корректными суммарными часами

**3. Проекты без логов не попадают в charts**
- Создать проект без work_logs
- GET
- Ожидать: этот проект отсутствует в `charts.hours_by_project`

**4. charts.users_by_project содержит количество уникальных пользователей**
- Создать 3 work_logs от 2 разных пользователей на один проект
- GET
- Ожидать: `user_count === 2` для этого проекта

**5. cards.undertime_count корректно считает недоработавших**
- Создать пользователя с fact < norm за месяц
- GET
- Ожидать: `cards.undertime_count >= 1`

**6. cards.overtime_count корректно считает переработавших**
- Создать пользователя с fact > norm за месяц
- GET
- Ожидать: `cards.overtime_count >= 1`

**7. cards.unlogged_count корректно считает незаполнивших**
- Создать пользователя без логов за весь месяц
- GET
- Ожидать: `cards.unlogged_count >= 1`

**8. norm берётся из calendar_settings если задана**
- Установить норму 160 для месяца через PUT /calendar/norm
- GET /dashboard?year=2025&month=1
- Ожидать: `norm === 160`

**9. norm равна 168 если не задана**
- Не создавать запись нормы
- GET
- Ожидать: `norm === 168`

**10. Пользователь без логов не вызывает ошибок, считается как unlogged**
- Создать активного пользователя без единого лога
- GET
- Ожидать: 200, пользователь учтён в `cards.unlogged_count`

**11. Обычный пользователь получает 403**
- GET от имени user
- Ожидать: 403

**12. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401

---

## GET /api/dashboard/users

**13. type=undertime возвращает только недоработавших**
- Создать пользователя с fact < norm и пользователя с fact > norm
- GET /dashboard/users?year=2025&month=1&type=undertime
- Ожидать: 200, `users` содержит только недоработавшего, `type === 'undertime'`

**14. type=overtime возвращает только переработавших**
- GET /dashboard/users?year=2025&month=1&type=overtime
- Ожидать: 200, `users` содержит только переработавшего

**15. type=unlogged возвращает только незаполнивших**
- Создать пользователя с незаполненными днями
- GET /dashboard/users?year=2025&month=1&type=unlogged
- Ожидать: 200, `users` содержит этого пользователя

**16. Каждый элемент users содержит корректную структуру карточки**
- GET /dashboard/users?type=undertime
- Ожидать: каждый элемент содержит `user_id`, `user_name`, `fact_hours`, `deviation`, `top2_projects`, `unlogged_count`, `last_log_date`

**17. top2_projects содержит не более 2 проектов отсортированных по часам**
- Создать пользователю логи на 3 проекта с разными суммами
- GET /dashboard/users?type=undertime (или overtime)
- Ожидать: `top2_projects.length <= 2`, первый проект содержит больше часов чем второй

**18. unlogged_dates содержит корректный список незаполненных дат**
- Создать пользователя, заполнить только часть рабочих дней месяца
- GET /dashboard/users?type=unlogged
- Ожидать: `unlogged_dates` содержит незаполненные рабочие дни, не содержит выходных

**19. При отсутствии пользователей нужного типа возвращает пустой массив**
- Создать ситуацию где нет переработавших
- GET /dashboard/users?type=overtime
- Ожидать: 200, `users: []`, `count: 0`

**20. Обычный пользователь получает 403**
- GET от имени user
- Ожидать: 403

**21. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401
