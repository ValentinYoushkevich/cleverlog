# MODULE_3 — Backend: Пользователи

## Обзор

Модуль управления пользователями: CRUD, отправка инвайта по email, смена роли и статуса, инвалидация сессии при деактивации. Все операции логируются в audit_log. Доступен только Admin, кроме `GET /api/auth/me` (уже в MODULE_2).

---

## Шаг 1. Middleware: authorize

`src/middlewares/authorize.js`:

```js
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Нет доступа' });
    }
    next();
  };
}
```

Используется во всех Admin-роутах: `authorize('admin')`.

---

## Шаг 2. Утилита: генерация инвайт-токена

`src/utils/token.js`:

```js
import crypto from 'crypto';

export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

---

## Шаг 3. Утилита: отправка email

`src/utils/mailer.js`:

```js
import nodemailer from 'nodemailer';
import logger from '@/config/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail({ to, inviteToken, firstName }) {
  const link = `${process.env.CLIENT_URL}/register/${inviteToken}`;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Приглашение в CleverLog',
      html: `
        <p>Здравствуйте, ${firstName}!</p>
        <p>Вас пригласили в систему CleverLog.</p>
        <p><a href="${link}">Завершить регистрацию</a></p>
        <p>Ссылка действительна 72 часа.</p>
      `,
    });
  } catch (err) {
    logger.error('Failed to send invite email', { to, error: err.message });
    throw { status: 500, code: 'EMAIL_SEND_FAILED', message: 'Не удалось отправить инвайт' };
  }
}

export const mailer = transporter
```

---

## Шаг 4. Zod-схемы

`src/validators/user.validators.js`:

```js
import { z } from 'zod';

export const createUserSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: z.enum(['user', 'admin']).optional(),
  position: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  hire_date: z.string().optional(),
  dismissal_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });
```

---

## Шаг 5. Репозиторий

`src/repositories/user.repository.js` — дополнить (или создать полностью):

```js
import db from '@/config/knex.js';

export const UserRepository = {
  findByEmail: (email) =>
    db('users').where({ email }).first(),

  findByInviteToken: (token) =>
    db('users').where({ invite_token: token }).first(),

  findById: (id) =>
    db('users').where({ id }).first(),

  findAll: ({ status, role, tags } = {}) => {
    const query = db('users').select(
      'id', 'first_name', 'last_name', 'email', 'role',
      'position', 'status', 'hire_date', 'dismissal_date', 'tags', 'created_at'
    );
    if (status) query.where({ status });
    if (role) query.where({ role });
    if (tags?.length) query.whereRaw('tags && ?', [tags]); // пересечение массивов
    return query.orderBy('last_name');
  },

  create: (data) =>
    db('users').insert(data).returning('*').then(r => r[0]),

  updateById: (id, data) =>
    db('users').where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]),

  deleteSessionsByUserId: (_id) => {
    // JWT stateless — инвалидация через проверку status в authenticate middleware.
    // Дополнительных действий не требуется: при следующем запросе authenticate
    // прочитает status=inactive и вернёт 401.
  },
};
```

---

## Шаг 6. Сервис

`src/services/user.service.js`:

```js
import db from '@/config/knex.js';
import { UserRepository } from '@/repositories/user.repository.js';
import { AuditService } from '@/services/audit.service.js';
import { generateInviteToken } from '@/utils/token.js';
import { sendInviteEmail } from '@/utils/mailer.js';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72 часа

export const UserService = {

  async list(filters) {
    return UserRepository.findAll(filters);
  },

  async getById(id) {
    const user = await UserRepository.findById(id);
    if (!user) throw { status: 404, code: 'NOT_FOUND', message: 'Пользователь не найден' };
    return user;
  },

  async create({ actorId, actorRole, ip, ...data }) {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) throw { status: 409, code: 'EMAIL_EXISTS', message: 'Email уже занят' };

    const invite_token = generateInviteToken();
    const invite_expires_at = new Date(Date.now() + INVITE_TTL_MS);

    const user = await UserRepository.create({
      ...data,
      invite_token,
      invite_expires_at,
    });

    await sendInviteEmail({ to: user.email, inviteToken: invite_token, firstName: user.first_name });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      after: { email: user.email, role: user.role },
      ip,
    });

    return user;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const user = await UserRepository.findById(id);
    if (!user) throw { status: 404, code: 'NOT_FOUND', message: 'Пользователь не найден' };

    // Если деактивируем — сессии инвалидируются автоматически через middleware
    const before = { status: user.status, role: user.role };

    const updated = await UserRepository.updateById(id, data);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      before,
      after: data,
      ip,
    });

    return updated;
  },

  async resendInvite({ id, actorId, actorRole, ip }) {
    const user = await UserRepository.findById(id);
    if (!user) throw { status: 404, code: 'NOT_FOUND', message: 'Пользователь не найден' };
    if (user.password_hash) throw { status: 400, code: 'ALREADY_REGISTERED', message: 'Пользователь уже зарегистрирован' };

    const invite_token = generateInviteToken();
    const invite_expires_at = new Date(Date.now() + INVITE_TTL_MS);

    await UserRepository.updateById(id, { invite_token, invite_expires_at });
    await sendInviteEmail({ to: user.email, inviteToken: invite_token, firstName: user.first_name });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'USER_INVITE_RESENT',
      entityType: 'user',
      entityId: id,
      ip,
    });

    return { message: 'Инвайт отправлен повторно' };
  },
};
```

---

## Шаг 7. Контроллер

`src/controllers/user.controller.js`:

```js
import { UserService } from '@/services/user.service.js';
import { createUserSchema, updateUserSchema } from '@/validators/user.validators.js';

export const UserController = {

  async list(req, res, next) {
    try {
      const { status, role, tags } = req.query;
      const users = await UserService.list({
        status,
        role,
        tags: tags ? tags.split(',') : undefined,
      });
      res.json(users);
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const user = await UserService.getById(req.params.id);
      res.json(user);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await UserService.create({
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.status(201).json(user);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const data = updateUserSchema.parse(req.body);
      const user = await UserService.update({
        id: req.params.id,
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(user);
    } catch (err) { next(err); }
  },

  async resendInvite(req, res, next) {
    try {
      const result = await UserService.resendInvite({
        id: req.params.id,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 8. Роутер

`src/routes/userRouter.js`:

```js
import { Router } from 'express';
import { UserController } from '@/controllers/user.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', UserController.list);
router.get('/:id', UserController.getById);
router.post('/', UserController.create);
router.patch('/:id', UserController.update);
router.post('/:id/resend-invite', UserController.resendInvite);

export default router;
```

Подключить в `app.js`:

```js
import userRouter from '@/routes/userRouter.js';
app.use('/api/users', userRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | `GET /api/users` только для Admin | Запрос с User-токеном → `403 FORBIDDEN` | ✅ Проходит |
| 2 | Список пользователей возвращается | `GET /api/users` с Admin-cookie → массив пользователей | ✅ Проходит |
| 3 | Фильтр по статусу работает | `GET /api/users?status=inactive` → только неактивные | ✅ Проходит |
| 4 | Создание пользователя | `POST /api/users` с данными → `201`, в БД новый user с `invite_token_hash` | ❌TODO Не проходит (SMTP не настроен, `EMAIL_SEND_FAILED`) |
| 5 | Дублирующий email отклоняется | `POST /api/users` с существующим email → `409 EMAIL_EXISTS` | ✅ Проходит |
| 6 | Инвайт-письмо отправляется | После создания в логах nodemailer виден вызов `sendMail` (или письмо в Mailtrap) | ❌TODO Не проходит (SMTP не настроен) |
| 7 | Редактирование пользователя | `PATCH /api/users/:id` с `{ "position": "Lead" }` → `200`, поле обновлено | ✅ Проходит |
| 8 | Деактивация инвалидирует сессию | Деактивировать user → его cookie → `GET /api/auth/me` → `401` | ✅ Проходит |
| 9 | Повторный инвайт | `POST /api/users/:id/resend-invite` → `200`, новый токен в БД | ❌TODO Не проходит (SMTP не настроен, `EMAIL_SEND_FAILED`) |
| 10 | Audit log пишется | После создания/обновления → `SELECT * FROM audit_logs WHERE entity_type='user';` → записи есть | ✅ Проходит |
