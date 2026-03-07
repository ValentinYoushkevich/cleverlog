# Добавление Vitest + Supertest в проект (ESM, Node.js, Docker-контейнер на каждый запуск)

## Флоу

```
npm test
  → globalSetup: docker run postgres:16  (порт 5433)
  → ждём готовности БД через pg.connect() retry
  → knex migrate:latest
  → тесты (beforeEach: TRUNCATE)
  → globalTeardown: docker stop + docker rm
```

Dev-база на порту `5432` не затрагивается никогда.

---

## 1. Установка зависимостей

```bash
npm install --save-dev vitest @vitest/coverage-v8 supertest dotenv-cli
```

> `dotenv-cli` — подгружает `.env.test` при запуске скриптов.  
> `supertest` — HTTP-клиент для Express без реального запуска сервера.  
> `@vitest/coverage-v8` — провайдер покрытия, встроенный в Node.js.

---

## 2. Переменные окружения

Создай файл `.env.test` в корне:

```env
NODE_ENV=test
PORT=3001

DB_HOST=localhost
DB_PORT=5433
DB_NAME=cleverlog_test
DB_USER=postgres
DB_PASSWORD=testpassword

JWT_SECRET=test_jwt_secret_key
JWT_EXPIRES_IN=1h

COOKIE_SECRET=test_cookie_secret
```

> Порт `5433` — чтобы не конфликтовать с dev-базой на `5432`.

Добавь в `.gitignore`:
```
.env.test
```

---

## 3. Конфигурация Knex

В `knexfile.js` добавь секцию `test`:

```js
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

const base = {
  client: 'pg',
  migrations: { directory: './src/db/migrations' },
  seeds: { directory: './src/db/seeds' },
}

export default {
  development: {
    ...base,
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
  },

  test: {
    ...base,
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: { min: 1, max: 5 },
  },
}
```

---

## 4. Global Setup

Создай файл `tests/globalSetup.js`. Запускается **один раз** перед всей тест-сессией.

```js
import { execSync, spawnSync } from 'child_process'
import pg from 'pg'
import knex from 'knex'
import * as dotenv from 'dotenv'
import knexConfig from '../knexfile.js'

dotenv.config({ path: '.env.test' })

const CONTAINER_NAME = 'cleverlog_test_db'
const DB_PORT = process.env.DB_PORT || 5433
const DB_NAME = process.env.DB_NAME || 'cleverlog_test'
const DB_USER = process.env.DB_USER || 'postgres'
const DB_PASSWORD = process.env.DB_PASSWORD || 'testpassword'

// Ждём готовности PostgreSQL через retry на чистом pg.Client
async function waitForPostgres(retries = 15, delayMs = 1000) {
  const client = new pg.Client({
    host: 'localhost',
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  })

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.connect()
      await client.end()
      console.log(`[globalSetup] PostgreSQL готов (попытка ${attempt})`)
      return
    } catch {
      console.log(`[globalSetup] Ожидаем PostgreSQL... (${attempt}/${retries})`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  throw new Error(`[globalSetup] PostgreSQL не поднялся за ${retries} попыток`)
}

export async function setup() {
  // Убиваем старый контейнер если остался с прошлого запуска
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' })

  // Поднимаем свежий контейнер
  execSync(
    `docker run -d \
      --name ${CONTAINER_NAME} \
      -e POSTGRES_DB=${DB_NAME} \
      -e POSTGRES_USER=${DB_USER} \
      -e POSTGRES_PASSWORD=${DB_PASSWORD} \
      -p ${DB_PORT}:5432 \
      postgres:16`,
    { stdio: 'inherit' }
  )

  console.log('[globalSetup] Контейнер запущен, ждём готовности БД...')

  // Ждём пока PostgreSQL примет соединения
  await waitForPostgres()

  // Накатываем все миграции
  const db = knex(knexConfig['test'])
  await db.migrate.latest()
  await db.destroy()

  console.log('[globalSetup] Миграции применены, тесты запускаются')
}

export async function teardown() {
  // Останавливаем и удаляем контейнер после всех тестов
  spawnSync('docker', ['stop', CONTAINER_NAME], { stdio: 'ignore' })
  spawnSync('docker', ['rm', CONTAINER_NAME], { stdio: 'ignore' })

  console.log('[globalSetup] Тестовый контейнер удалён')
}
```

---

## 5. Setup файл (перед каждым тестом)

Создай файл `tests/setup.js`. Запускается **перед каждым тест-файлом**.

```js
import { beforeEach, afterAll } from 'vitest'
import db from '../src/db/index.js' // твой knex-инстанс

// Чистим все таблицы перед каждым тестом (порядок важен для FK)
beforeEach(async () => {
  await db.raw(`
    TRUNCATE TABLE
      audit_logs,
      work_log_custom_values,
      work_logs,
      absences,
      month_closures,
      notification_settings,
      project_custom_fields,
      custom_field_options,
      custom_fields,
      calendar_days,
      calendar_settings,
      projects,
      users
    RESTART IDENTITY CASCADE
  `)
})

// Закрываем соединение после всех тестов в файле
afterAll(async () => {
  await db.destroy()
})
```

---

## 6. Настройка Vitest

Создай `vitest.config.js` в корне:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // все тесты последовательно — безопасно для БД
      },
    },
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
    },
    env: {
      NODE_ENV: 'test',
    },
  },
})
```

---

## 7. Скрипты в package.json

```json
"scripts": {
  "test": "dotenv -e .env.test -- vitest run",
  "test:watch": "dotenv -e .env.test -- vitest",
  "test:coverage": "dotenv -e .env.test -- vitest run --coverage"
}
```

---

## 8. Структура тест-файлов

```
tests/
├── globalSetup.js          # docker run / docker rm, миграции — один раз
├── setup.js                # TRUNCATE перед каждым тестом
├── helpers/
│   ├── factories.js        # createUser(), createProject(), createWorkLog() ...
│   └── auth.js             # loginAs(role) → возвращает agent с cookie
└── integration/
    ├── auth.test.js
    ├── users.test.js
    ├── projects.test.js
    ├── work-logs.test.js
    ├── absences.test.js
    ├── calendar.test.js
    ├── custom-fields.test.js
    ├── month-closures.test.js
    ├── reports.test.js
    ├── dashboard.test.js
    └── audit-logs.test.js
```

---

## 9. Пример теста

```js
// tests/integration/auth.test.js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import { createUser } from '../helpers/factories.js'

describe('POST /api/auth/login', () => {
  it('возвращает 200 и устанавливает cookie при верных данных', async () => {
    await createUser({ email: 'admin@test.com', password: 'Password123!', role: 'admin' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })

    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('возвращает 401 при неверном пароле', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrong' })

    expect(res.status).toBe(401)
  })
})
```

---

## 10. Первый запуск

```bash
# Убедиться что Docker Desktop запущен
docker info

# Установить зависимости
npm install --save-dev vitest @vitest/coverage-v8 supertest dotenv-cli

# Запустить тесты
npm test
```

В консоли увидишь:
```
[globalSetup] Контейнер запущен, ждём готовности БД...
[globalSetup] Ожидаем PostgreSQL... (1/15)
[globalSetup] Ожидаем PostgreSQL... (2/15)
[globalSetup] PostgreSQL готов (попытка 3)
[globalSetup] Миграции применены, тесты запускаются
...тесты...
[globalSetup] Тестовый контейнер удалён
```
