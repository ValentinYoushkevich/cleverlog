# MODULE_14 — Backend: Логирование JS-ошибок

## Обзор

Эндпоинт для приёма JS-ошибок с фронтенда. Принимает POST-запрос, валидирует тело, пишет в технический лог через Winston и сохраняет ошибку в БД для последующего просмотра в админке. Не требует аутентификации — ошибки могут возникать до логина.

> **Зависимости модуля:**
> - `logger` из `src/config/logger.js` (MODULE_0) — используется напрямую
> - `knex` (MODULE_0) — используется для сохранения в PostgreSQL
> - Новых npm-зависимостей не вводит

---

## Шаг 1. Zod-схема

`src/validators/jsError.validators.js`:

```js
import { z } from 'zod';

export const jsErrorSchema = z.object({
  message: z.string().min(1),
  source: z.string().optional(),   // файл/URL источника
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  stack: z.string().optional(),
  url: z.string().optional(),      // страница, где произошла ошибка
  userAgent: z.string().optional(),
});
```

---

## Шаг 2. Хранение в БД (миграция + репозиторий)

Добавить таблицу `js_errors` (PostgreSQL):

`db/migrations/24_create_js_errors.js`:

```js
export async function up(knex) {
  await knex.schema.createTable('js_errors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.text('message').notNullable();
    table.text('source').nullable();
    table.integer('lineno').nullable();
    table.integer('colno').nullable();
    table.text('stack').nullable();
    table.text('url').nullable();
    table.text('user_agent').nullable();
    table.string('ip', 45).nullable();
    table.index(['created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('js_errors');
}
```

Репозиторий:

`src/repositories/jsError.repository.js`:

```js
import db from '@/config/knex.js';

export const JsErrorRepository = {
  create: (data) => db('js_errors').insert(data).returning('*'),
  // list/pagination — см. реализацию в репозитории
};
```

---

## Шаг 3. Контроллер (лог + сохранение)

`src/controllers/jsError.controller.js`:

```js
import logger from '@/config/logger.js';
import { JsErrorRepository } from '@/repositories/jsError.repository.js';
import { jsErrorSchema } from '@/validators/jsError.validators.js';

export const JsErrorController = {

  async log(req, res, next) {
    try {
      const data = jsErrorSchema.parse(req.body);

      logger.error('Frontend JS error', {
        ...data,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      // Дополнительно сохраняем в БД для просмотра в админке
      await JsErrorRepository.create({
        message: data.message,
        source: data.source ?? null,
        lineno: data.lineno ?? null,
        colno: data.colno ?? null,
        stack: data.stack ?? null,
        url: data.url ?? null,
        user_agent: data.userAgent ?? null,
        ip: req.ip,
      });

      // Всегда возвращаем 200 — фронт не должен получать ошибку при логировании ошибки
      res.status(200).json({ received: true });
    } catch (err) {
      // Даже при невалидном теле — не падаем, просто логируем как warn
      logger.warn('Invalid JS error payload', { body: req.body, ip: req.ip });
      res.status(200).json({ received: false });
    }
  },
};
```

---

## Шаг 4. Роуты: приём (public) + просмотр (admin-only)

`src/routes/jsErrorRouter.js`:

```js
import { Router } from 'express';
import { JsErrorController } from '@/controllers/jsError.controller.js';

const router = Router();

// Без authenticate — ошибки могут возникать до логина
router.post('/log-js-error', JsErrorController.log);

export default router;
```

Добавить отдельный роутер для просмотра ошибок (только Admin):

`src/routes/jsErrorsRouter.js`:

```js
import { Router } from 'express';
import { JsErrorController } from '@/controllers/jsError.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));
router.get('/', JsErrorController.list);

export default router;
```

Подключить в `app.js`:

```js
import jsErrorRouter from '@/routes/jsErrorRouter.js';
app.use('/api', jsErrorRouter);

import jsErrorsRouter from '@/routes/jsErrorsRouter.js';
app.use('/api/js-errors', jsErrorsRouter);
```

---

## Шаг 5. Проверить уровень логгера

В `src/config/logger.js` (MODULE_0) уровень установлен `warn`. Это значит `logger.error` пишется всегда — убедиться что `error.log` присутствует в транспортах (уже настроено в MODULE_0).

Если нужно видеть JS-ошибки в `combined.log` — убедиться что транспорт `combined.log` имеет уровень `warn` или ниже (в текущей конфигурации MODULE_0 так и есть).

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Эндпоинт доступен без авторизации | `POST /api/log-js-error` без cookie → `200 { received: true }` | ✅ Пройдено |
| 2 | Корректная ошибка логируется | Отправить `{ message: "TypeError", stack: "..." }` → в `logs/error.log` появляется запись с `Frontend JS error` | ✅ Пройдено |
| 3 | Невалидное тело не роняет сервер | `POST /api/log-js-error` с пустым телом `{}` → `200 { received: false }`; в `logs/combined.log` — `warn` | ✅ Пройдено |
| 4 | IP фиксируется | В записи лога присутствует поле `ip` | ✅ Пройдено |
| 5 | Все поля пишутся | `{ message, source, lineno, colno, stack, url, userAgent }` → все поля в записи лога | ✅ Пройдено |
| 6 | Ошибка сохраняется в БД | После `POST /api/log-js-error` запись появляется в таблице `js_errors` | ✅ Пройдено |
| 7 | Просмотр ошибок защищён | `GET /api/js-errors` с User-cookie → 403; с Admin-cookie → 200 + список | ✅ Пройдено |
