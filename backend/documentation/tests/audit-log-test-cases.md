# Тест-кейсы: AuditLog модуль

> Все роуты закрыты `authenticate + authorize('admin')`.
> Во всех тестах где не указано иное — выполнять запрос от имени admin.
>
> Этот файл покрывает роуты `/api/audit-logs`.
> Проверки что операции **создают** записи в audit_log — в отдельном файле: [audit-log-side-effects-test-cases.md](./audit-log-side-effects-test-cases.md)

---

## GET /api/audit-logs

**1. Успешно возвращает список записей с пагинацией**
- Создать несколько audit_log записей
- GET /audit-logs
- Ожидать: 200, `data` массив, `pagination` содержит `total`, `page`, `limit`, `total_pages`

**2. Каждая запись содержит поля event и entity в правильном формате**
- Создать audit_log с известным `event_type` и `entity_type`
- GET
- Ожидать: каждая запись содержит `event.type`, `event.name`, `entity.type`, `entity.name`

**3. Фильтр по actor_id**
- Создать записи от двух разных акторов
- GET с `?actor_id=<id>`
- Ожидать: 200, только записи нужного актора

**4. Фильтр по event_type**
- Создать записи с разными event_type
- GET с `?event_type=LOGIN`
- Ожидать: 200, только LOGIN записи

**5. Фильтр по entity_type**
- GET с `?entity_type=user`
- Ожидать: 200, только записи с entity_type === 'user'

**6. Фильтр по периоду**
- Создать записи в разные даты
- GET с `?date_from=...&date_to=...`
- Ожидать: 200, только записи в периоде

**7. Фильтр по result**
- Создать записи с `result: 'success'` и `result: 'failure'`
- GET с `?result=failure`
- Ожидать: 200, только failure записи

**8. Поиск по entity_type через search**
- GET с `?search=<часть русского названия сущности>`
- Ожидать: 200, записи с entity_type чьё русское название содержит строку поиска

**9. Пагинация работает корректно**
- Создать 10 записей
- GET с `?page=2&limit=5`
- Ожидать: 200, `data.length <= 5`, `pagination.page === 2`

**10. Обычный пользователь получает 403**
- GET от имени user (не admin)
- Ожидать: 403

**11. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401

---

## GET /api/audit-logs/filter-options

**12. Возвращает список доступных event_types и entity_types**
- Создать audit_log записи с разными event_type и entity_type
- GET /audit-logs/filter-options
- Ожидать: 200, `{ event_types: [...], entity_types: [...] }`
- Каждый элемент содержит `type` и `name`

**13. Обычный пользователь получает 403**
- GET от имени user
- Ожидать: 403

**14. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401

---

## GET /api/audit-logs/export

**15. Успешно возвращает Excel-файл**
- Создать несколько audit_log записей
- GET /audit-logs/export
- Ожидать: 200, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, тело непустое

**16. Экспорт с фильтрами применяет их корректно**
- Создать записи от двух акторов
- GET /audit-logs/export?actor_id=<id>
- Ожидать: 200, файл содержит только записи нужного актора (проверяем по размеру или через парсинг если нужно)

**17. Обычный пользователь получает 403**
- GET от имени user
- Ожидать: 403

**18. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401
