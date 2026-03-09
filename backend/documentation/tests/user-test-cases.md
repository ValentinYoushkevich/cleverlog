# Тест-кейсы: User модуль

> Все роуты закрыты `authenticate + authorize('admin')`.

---

## GET /api/users

**1. Успешно возвращает список пользователей**
- Создать несколько пользователей
- GET /users
- Ожидать: 200, массив с `id`, `email`, `role`, `status`

**2. Фильтрация по статусу active/inactive**
- Создать активных и неактивных пользователей
- GET /users?status=inactive
- Ожидать: 200, только неактивные

**3. Фильтрация по роли**
- Создать admin и user
- GET /users?role=admin
- Ожидать: 200, только admins

**4. Ответ не содержит чувствительных полей**
- GET /users
- Ожидать: ни один элемент не содержит `password_hash`, `invite_token_hash`

**5. Обычный пользователь получает 403**
- GET от имени user
- Ожидать: 403

**6. Без токена возвращает 401**
- GET без cookie
- Ожидать: 401

---

## GET /api/users/:id

**7. Успешно возвращает пользователя по id**
- GET /users/:id
- Ожидать: 200, объект с `id`, `email`, `role`, `status`

**8. Для link-инвайта с активным токеном возвращает invite_link**
- Создать пользователя с `invite_mode: 'link'`, нерегистрированного (нет `password_hash`)
- GET /users/:id
- Ожидать: 200, поле `invite_link` присутствует

**9. Для зарегистрированного пользователя invite_link не возвращается**
- Создать зарегистрированного пользователя (с `password_hash`)
- GET /users/:id
- Ожидать: 200, `invite_link` отсутствует

**10. Несуществующий id возвращает 404**
- GET с несуществующим id
- Ожидать: 404, код `NOT_FOUND`

---

## POST /api/users

**11. Успешное создание пользователя с invite_mode: email**
- POST с `{ email, first_name, last_name, role, invite_mode: 'email' }`
- Ожидать: 200, пользователь создан с `invite_token_hash`, `invite_expires_at`

**12. Успешное создание пользователя с invite_mode: link**
- POST с `{ first_name, last_name, role, invite_mode: 'link' }` без email
- Ожидать: 200, ответ содержит `invite_link`

**13. Email уже занят возвращает 409**
- Создать пользователя с email, создать ещё раз с тем же email
- Ожидать: 409, код `EMAIL_EXISTS`

**14. invite_mode: email без email возвращает 400**
- POST с `{ invite_mode: 'email' }` без email
- Ожидать: 400, код `EMAIL_REQUIRED`

**15. Невалидные данные не проходят Zod**
- POST без обязательных полей или с неверной ролью
- Ожидать: 400 или 422

---

## PATCH /api/users/:id

**16. Успешное обновление имени и позиции**
- PATCH с `{ first_name, last_name, position }`
- Ожидать: 200, поля обновлены

**17. Смена роли**
- PATCH с `{ role: 'admin' }`
- Ожидать: 200, `role === 'admin'`

**18. Деактивация пользователя инвалидирует его сессии**
- Залогиниться как обычный пользователь, получить cookie
- Админом PATCH с `{ status: 'inactive' }`
- Попытаться сделать GET /auth/me с сохранённой cookie
- Ожидать: 401 (сессия инвалидирована)

**19. Реактивация пользователя**
- Деактивировать пользователя, затем PATCH с `{ status: 'active' }`
- Ожидать: 200, `status === 'active'`

**20. Несуществующий id возвращает 404**
- PATCH с несуществующим id
- Ожидать: 404, код `NOT_FOUND`

---

## POST /api/users/:id/resend-invite

**21. Успешная повторная отправка инвайта**
- Создать незарегистрированного пользователя с email и активным токеном
- POST /users/:id/resend-invite
- Ожидать: 200, `{ message: 'Инвайт отправлен повторно' }`

**22. Уже зарегистрированному пользователю возвращает 400**
- POST для пользователя с `password_hash`
- Ожидать: 400, код `ALREADY_REGISTERED`

**23. Истёкший токен блокирует повторную отправку**
- Создать пользователя с `invite_expires_at` в прошлом
- POST /users/:id/resend-invite
- Ожидать: 400, код `INVITE_EXPIRED`

---

## POST /api/users/:id/regenerate-link

**24. Успешная регенерация ссылки**
- Создать пользователя с `invite_mode: 'link'` и истёкшим токеном
- POST /users/:id/regenerate-link
- Ожидать: 200, ответ содержит новый `invite_link`

**25. Для email-инвайта возвращает 400**
- POST для пользователя с `invite_mode: 'email'`
- Ожидать: 400, код `WRONG_INVITE_MODE`

**26. Активная ссылка блокирует регенерацию**
- Создать пользователя с `invite_mode: 'link'` и активным токеном
- POST /users/:id/regenerate-link
- Ожидать: 400, код `INVITE_ACTIVE`

**27. Уже зарегистрированному возвращает 400**
- POST для пользователя с `password_hash`
- Ожидать: 400, код `ALREADY_REGISTERED`

---

## POST /api/users/:id/regenerate-email-invite

**28. Успешная регенерация email-инвайта**
- Создать пользователя с `invite_mode: 'email'` и истёкшим токеном
- POST /users/:id/regenerate-email-invite
- Ожидать: 200, `{ message: 'Инвайт перегенерирован' }`
- Проверить: `invite_expires_at` в БД обновился

**29. Для link-инвайта возвращает 400**
- POST для пользователя с `invite_mode: 'link'`
- Ожидать: 400, код `WRONG_INVITE_MODE`

**30. Активный инвайт блокирует регенерацию**
- Создать пользователя с `invite_mode: 'email'` и активным токеном
- POST /users/:id/regenerate-email-invite
- Ожидать: 400, код `INVITE_ACTIVE`

**31. Пользователь без email возвращает 400**
- Создать пользователя с `invite_mode: 'email'` без email и истёкшим токеном
- POST /users/:id/regenerate-email-invite
- Ожидать: 400, код `EMAIL_REQUIRED`
