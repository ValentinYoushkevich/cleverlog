import * as dotenv from 'dotenv';
import knex from 'knex';
import { execSync, spawnSync } from 'node:child_process';
import pg from 'pg';
import knexConfig from '../knexfile.js';

dotenv.config({ path: '.env.test' });

const CONTAINER_NAME = 'cleverlog_test_db';
const DB_PORT = process.env.DB_PORT || 5433;
const DB_NAME = process.env.DB_NAME || 'cleverlog_test';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'testpassword';

async function waitForPostgres(retries = 60, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const client = new pg.Client({
      host: 'localhost',
      port: Number(DB_PORT),
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    try {
      await client.connect();
      await client.end();
      console.log(`[globalSetup] PostgreSQL готов (попытка ${attempt})`);
      return;
    } catch (err) {
      console.log(
        `[globalSetup] Ожидаем PostgreSQL... (${attempt}/${retries})`,
        '- ошибка:',
        err?.message ?? err,
      );
      try {
        await client.end();
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`[globalSetup] PostgreSQL не поднялся за ${retries} попыток`);
}

export async function setup() {
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });

  execSync(
    `docker run -d \
      --name ${CONTAINER_NAME} \
      -e POSTGRES_DB=${DB_NAME} \
      -e POSTGRES_USER=${DB_USER} \
      -e POSTGRES_PASSWORD=${DB_PASSWORD} \
      -p ${DB_PORT}:5432 \
      postgres:16`,
    { stdio: 'inherit' },
  );

  console.log('[globalSetup] Контейнер запущен, ждём готовности БД...');

  await waitForPostgres();

  const db = knex(knexConfig.test);
  await db.migrate.latest();
  await db.destroy();

  console.log('[globalSetup] Миграции применены, тесты запускаются');
}

export function teardown() {
  spawnSync('docker', ['stop', CONTAINER_NAME], { stdio: 'ignore' });
  spawnSync('docker', ['rm', CONTAINER_NAME], { stdio: 'ignore' });

  console.log('[globalSetup] Тестовый контейнер удалён');
}
