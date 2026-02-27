# MODULE_14 — Backend: Логирование JS-ошибок

## Обзор

Простой эндпоинт для приёма JS-ошибок с фронтенда. Принимает POST-запрос, валидирует тело и пишет в технический лог через Winston. Не требует аутентификации — ошибки могут возникать до логина.

> **Зависимости модуля:**
> - `logger` из `src/config/logger.js` (MODULE_0) — используется напрямую
> - Новых зависимостей не вводит

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

## Шаг 2. Контроллер

`src/controllers/jsError.controller.js`:

```js
import logger from '@/config/logger.js';
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

## Шаг 3. Роутер

`src/routes/jsErrorRouter.js`:

```js
import { Router } from 'express';
import { JsErrorController } from '@/controllers/jsError.controller.js';

const router = Router();

// Без authenticate — ошибки могут возникать до логина
router.post('/log-js-error', JsErrorController.log);

export default router;
```

Подключить в `app.js`:

```js
import jsErrorRouter from '@/routes/jsErrorRouter.js';
app.use('/api', jsErrorRouter);
```

---

## Шаг 4. Проверить уровень логгера

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
