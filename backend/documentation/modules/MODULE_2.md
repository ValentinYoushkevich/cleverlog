# MODULE_2 — Backend: Аутентификация

## Обзор

Модуль реализует полный цикл аутентификации: инвайт → регистрация → логин → логаут → смена пароля. JWT хранится в HttpOnly cookie. Пароли хешируются Argon2id. После 5 неверных попыток аккаунт блокируется на 10 минут.

---

## Шаг 1. Константы

`src/constants/auth.js`:

```js
export const JWT_COOKIE_NAME = 'token';
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 минут
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;
```

---

## Шаг 2. Zod-схемы валидации

`src/validators/auth.validators.js`:

```js
import { z } from 'zod';
import { PASSWORD_REGEX } from '@/constants/auth.js';

const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(PASSWORD_REGEX, 'Пароль должен содержать заглавную, строчную, цифру и спецсимвол');

export const registerSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});
```

---

## Шаг 3. Репозиторий

`src/repositories/user.repository.js`:

```js
import db from '@/config/knex.js';

export const UserRepository = {
  findByEmail: (email) =>
    db('users').where({ email }).first(),

  findByInviteToken: (token) =>
    db('users').where({ invite_token: token }).first(),

  findById: (id) =>
    db('users').where({ id }).first(),

  updateById: (id, data) =>
    db('users').where({ id }).update({ ...data, updated_at: db.fn.now() }),
};
```

---

## Шаг 4. Сервис

`src/services/auth.service.js`:

```js
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@/repositories/user.repository.js';
import { LOCK_DURATION_MS, MAX_LOGIN_ATTEMPTS } from '@/constants/auth.js';
import { AuditService } from '@/services/audit.service.js';

export const AuthService = {

  async register({ token, password }) {
    const user = await UserRepository.findByInviteToken(token);
    if (!user) throw { status: 400, code: 'INVALID_TOKEN', message: 'Инвайт недействителен' };
    if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
      throw { status: 400, code: 'TOKEN_EXPIRED', message: 'Инвайт истёк' };
    }

    const password_hash = await argon2.hash(password, { type: argon2.argon2id });

    await UserRepository.updateById(user.id, {
      password_hash,
      invite_token: null,
      invite_expires_at: null,
    });

    return { message: 'Регистрация успешна' };
  },

  async login({ email, password, ip }) {
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      // Не раскрываем существование аккаунта
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Неверные учётные данные' };
    }

    if (user.status === 'inactive') {
      throw { status: 403, code: 'ACCOUNT_INACTIVE', message: 'Аккаунт деактивирован' };
    }

    // Проверка блокировки
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await AuditService.log({ actorId: user.id, eventType: 'LOGIN_FAILED', entityType: 'user', entityId: user.id, result: 'failure', ip, after: { reason: 'ACCOUNT_LOCKED' } });
      throw { status: 429, code: 'ACCOUNT_LOCKED', message: 'Аккаунт временно заблокирован' };
    }

    const valid = await argon2.verify(user.password_hash, password);

    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null;

      await UserRepository.updateById(user.id, {
        failed_login_attempts: attempts,
        locked_until: lockedUntil,
      });

      await AuditService.log({ actorId: user.id, eventType: 'LOGIN_FAILED', entityType: 'user', entityId: user.id, result: 'failure', ip });

      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Неверные учётные данные' };
    }

    // Сброс счётчика
    await UserRepository.updateById(user.id, {
      failed_login_attempts: 0,
      locked_until: null,
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await AuditService.log({ actorId: user.id, actorRole: user.role, eventType: 'LOGIN', entityType: 'user', entityId: user.id, result: 'success', ip });

    return { token, user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name } };
  },

  async changePassword({ userId, current_password, new_password, ip }) {
    const user = await UserRepository.findById(userId);
    if (!user) throw { status: 404, code: 'NOT_FOUND', message: 'Пользователь не найден' };

    const valid = await argon2.verify(user.password_hash, current_password);
    if (!valid) throw { status: 400, code: 'INVALID_PASSWORD', message: 'Текущий пароль неверен' };

    const password_hash = await argon2.hash(new_password, { type: argon2.argon2id });
    await UserRepository.updateById(userId, { password_hash });

    await AuditService.log({ actorId: userId, actorRole: user.role, eventType: 'PASSWORD_CHANGED', entityType: 'user', entityId: userId, result: 'success', ip });

    return { message: 'Пароль изменён' };
  },
};
```

---

## Шаг 5. Middleware: authenticate

`src/middlewares/authenticate.js`:

```js
import jwt from 'jsonwebtoken';
import { JWT_COOKIE_NAME } from '@/constants/auth.js';
import { UserRepository } from '@/repositories/user.repository.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies[JWT_COOKIE_NAME];
    if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Не авторизован' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserRepository.findById(payload.userId);

    if (!user || user.status === 'inactive') {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Сессия недействительна' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Токен недействителен' });
  }
}
```

---

## Шаг 6. Middleware: глобальный error handler

`src/middlewares/errorHandler.js`:

```js
import logger from '@/config/logger.js';

export function errorHandler(err, req, res, _next) {
  if (err.status) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
}
```

Подключить в `app.js` последним (раскомментировать заглушку из MODULE_0).

---

## Шаг 7. AuditService (заглушка для использования в этом модуле)

`src/services/audit.service.js`:

```js
import db from '@/config/knex.js';

export const AuditService = {
  async log({ actorId, actorRole, eventType, entityType, entityId, before, after, ip, result = 'success' }) {
    await db('audit_logs').insert({
      actor_id: actorId ?? null,
      actor_role: actorRole ?? null,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      ip: ip ?? null,
      result,
    });
  },
};
```

> Этот файл будет расширяться в последующих модулях. Создаётся здесь, т.к. нужен уже в MODULE_2.

---

## Шаг 8. Контроллер

`src/controllers/auth.controller.js`:

```js
import { AuthService } from '@/services/auth.service.js';
import { registerSchema, loginSchema, changePasswordSchema } from '@/validators/auth.validators.js';
import { JWT_COOKIE_NAME } from '@/constants/auth.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
};

export const AuthController = {

  async register(req, res, next) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await AuthService.register(data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const ip = req.ip;
      const { token, user } = await AuthService.login({ ...data, ip });
      res.cookie(JWT_COOKIE_NAME, token, COOKIE_OPTIONS);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res) {
    res.clearCookie(JWT_COOKIE_NAME);
    res.json({ message: 'Выход выполнен' });
  },

  async changePassword(req, res, next) {
    try {
      const data = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword({ ...data, userId: req.user.id, ip: req.ip });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async me(req, res) {
    const { id, email, role, first_name, last_name, position, status } = req.user;
    res.json({ id, email, role, first_name, last_name, position, status });
  },
};
```

---

## Шаг 9. Роутер

`src/routes/authRouter.js`:

```js
import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';

const router = Router();

router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.post('/auth/change-password', authenticate, AuthController.changePassword);
router.get('/auth/me', authenticate, AuthController.me);

export default router;
```

Подключить в `app.js`:

```js
import authRouter from '@/routes/authRouter.js';
app.use('/api', authRouter);
```

---

ВАЖНО AuditService создаётся в MODULE_2 и используется во всех последующих — при реализации надо подключать именно его
authorize middleware создаётся в MODULE_3 — в MODULE_4 и MODULE_5 уже используется готовый

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Регистрация по инвайту работает | Создать пользователя через seed с `invite_token`, `POST /api/auth/register` с токеном и паролем → `200` |
| 2 | Невалидный инвайт отклоняется | `POST /api/auth/register` с несуществующим токеном → `400 INVALID_TOKEN` |
| 3 | Логин возвращает cookie | `POST /api/auth/login` → `200`, в заголовке `Set-Cookie: token=...HttpOnly` |
| 4 | `GET /api/auth/me` работает с cookie | С правильной cookie → `200` с данными пользователя |
| 5 | Без cookie → 401 | `GET /api/auth/me` без cookie → `401 UNAUTHORIZED` |
| 6 | Блокировка после 5 попыток | 5 раз `POST /api/auth/login` с неверным паролем → 6-я попытка возвращает `429 ACCOUNT_LOCKED` |
| 7 | Inactive-пользователь не входит | Поменять `status = 'inactive'` в БД → логин → `403 ACCOUNT_INACTIVE` |
| 8 | Смена пароля работает | `POST /api/auth/change-password` с верным текущим паролем → `200` |
| 9 | Смена пароля с неверным текущим | → `400 INVALID_PASSWORD` |
| 10 | Логаут очищает cookie | `POST /api/auth/logout` → cookie очищена; `GET /api/auth/me` → `401` |
| 11 | Все события пишутся в audit_logs | После логина/логаута/смены пароля → `SELECT * FROM audit_logs;` → соответствующие записи |
| 12 | Политика паролей работает | `POST /api/auth/register` с паролем `12345678` → `400` с сообщением о требованиях |
