import { afterAll, beforeEach } from 'vitest';
import db from '../src/config/knex.js';

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
  `);
});

afterAll(async () => {
  await db.destroy();
});
