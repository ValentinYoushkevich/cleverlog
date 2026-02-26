MODULE_0 — Backend: Инициализация проекта
Шаг 1. Структура папок
Создать следующую структуру вручную:
backend/
  src/
    config/
    constants/
    controllers/
    middlewares/
    repositories/
    routes/
    services/
    utils/
  db/
    migrations/
    seeds/
  documentation/
  .env
  .env.example
  .gitignore
  app.js
  server.js
  knexfile.js
  package.json

Шаг 2. Инициализация проекта и зависимости
bashnpm init -y
Установить зависимости:
bashnpm install express dotenv cors helmet morgan cookie-parser \
  knex pg argon2 jsonwebtoken \
  nodemailer exceljs \
  zod node-cron winston module-alias
Dev-зависимости:
bashnpm install -D nodemon eslint
В package.json добавить скрипты и алиасы:
json{
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "seed": "knex seed:run"
  },
  "_moduleAliases": {
    "@": "./src"
  }
}

Шаг 3. Docker — PostgreSQL
Создать docker-compose.yml в корне монорепы (рядом с backend/ и frontend/):
yamlservices:
  postgres:
    image: postgres:16-alpine
    container_name: cleverlog_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: cleverlog
      POSTGRES_USER: cleverlog_user
      POSTGRES_PASSWORD: cleverlog_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
Запуск:
bashdocker compose up -d

Шаг 4. Переменные окружения
.env:
envNODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=cleverlog
DB_USER=cleverlog_user
DB_PASSWORD=cleverlog_pass

CLIENT_URL=http://localhost:5173

JWT_SECRET=замени_на_случайную_строку_минимум_32_символа
JWT_EXPIRES_IN=7d

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@cleverlog.local
.env.example — то же самое, но без значений. Добавить .env в .gitignore.

Шаг 5. Конфигурация Knex
src/config/knex.js:
jsimport knex from 'knex';
import 'dotenv/config';

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './db/migrations',
    extension: 'js',
  },
  seeds: {
    directory: './db/seeds',
  },
});

export default db;
knexfile.js в корне backend/ (нужен для CLI):
jsimport 'dotenv/config';

export default {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    migrations: { directory: './db/migrations' },
    seeds: { directory: './db/seeds' },
  },
};

Шаг 6. Конфигурация Winston
src/config/logger.js:
jsimport winston from 'winston';

const logger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export default logger;

Шаг 7. app.js
jsimport 'module-alias/register.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import healthRouter from '@/routes/healthRouter.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Роуты
app.use('/api', healthRouter);

// Глобальный error handler — подключить последним после всех роутов
// import errorHandler from '@/middlewares/errorHandler.js';
// app.use(errorHandler);

export default app;

Шаг 8. server.js
jsimport 'module-alias/register.js';
import app from './app.js';
import db from '@/config/knex.js';
import logger from '@/config/logger.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.raw('SELECT 1');
    logger.info('PostgreSQL connected');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to connect to DB', { error: err.message });
    process.exit(1);
  }
}

start();

Шаг 9. Health-check эндпоинт
src/routes/healthRouter.js:
jsimport { Router } from 'express';
import db from '@/config/knex.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

export default router;

Шаг 10. ESLint
.eslintrc.json:
json{
  "env": { "node": true, "es2022": true },
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "rules": {
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}

Шаг 11. .gitignore
node_modules/
.env
logs/
dist/

Критерии приёмки
#ПроверкаКак проверить1PostgreSQL запущен в Dockerdocker ps → контейнер cleverlog_db со статусом Up2Сервер стартует без ошибокnpm run dev → в консоли Server running on http://localhost:30003БД подключена при стартеВ консоли нет ошибок подключения; logger.info('PostgreSQL connected') отработал4Health-check отвечаетGET http://localhost:3000/api/health → { "status": "ok", "db": "connected" }5Алиас @ работаетИмпорты вида @/config/knex.js резолвятся без ошибок6Логгер пишет файлыПосле старта появляются logs/error.log и logs/combined.log7Структура папок соответствует схемеВсе директории из Шага 1 присутствуют