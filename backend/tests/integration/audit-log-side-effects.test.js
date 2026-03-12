import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createAbsence,
  createCustomField,
  createInvitedUser,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

const YEAR = 2025;
const MONTH = 1;

async function getLastAudit() {
  const row = await db('audit_logs').orderBy('timestamp', 'desc').first();
  return row;
}

describe('Audit log side effects', () => {
  beforeEach(async () => {
    await db('audit_logs').del();
  });

  describe('Auth', () => {
    it('1. Успешный логин создаёт запись LOGIN', async () => {
      const user = await createUserWithPassword({ email: 'audit-auth-login@test.local' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('LOGIN');
      expect(audit.result).toBe('success');
      expect(audit.entity_type).toBe('user');
      expect(audit.actor_id).toBe(user.id);
    });

    it('2. Неверный пароль создаёт запись LOGIN_FAILED', async () => {
      const user = await createUserWithPassword({ email: 'audit-auth-fail@test.local' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPass1!' });
      expect(res.status).toBeGreaterThanOrEqual(400);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('LOGIN_FAILED');
      expect(audit.result).toBe('failure');
    });

    it('3. Логин заблокированного аккаунта создаёт LOGIN_FAILED с reason ACCOUNT_LOCKED', async () => {
      const user = await createUserWithPassword({ email: 'audit-auth-locked@test.local' });

      // искусственно залочим пользователя
      await db('users').where({ id: user.id }).update({
        locked_until: new Date(Date.now() + 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      expect(res.status).toBeGreaterThanOrEqual(400);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('LOGIN_FAILED');
      expect(audit.result).toBe('failure');
      const after = audit.after;
      expect(after.reason).toBe('ACCOUNT_LOCKED');
    });

    it('4. Логаут создаёт запись LOGOUT', async () => {
      const { agent, user } = await loginAs({ email: 'audit-auth-logout@test.local' });

      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('LOGOUT');
      expect(audit.result).toBe('success');
      expect(audit.actor_id).toBe(user.id);
    });
  });

  describe('Users', () => {
    it('8. Создание пользователя создаёт запись USER_CREATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-user-create-admin@test.local' });

      const res = await agent
        .post('/api/users')
        .send({
          email: 'audit-user-created@test.local',
          first_name: 'First',
          last_name: 'Last',
          role: ROLES.USER,
          department: 'IT',
          invite_mode: 'email',
        });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('USER_CREATED');
      const after = audit.after;
      expect(after.email).toBe('audit-user-created@test.local');
      expect(after.role).toBe(ROLES.USER);
    });

    it('9. Обновление пользователя создаёт запись USER_UPDATED с before/after', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-user-update-admin@test.local' });
      const user = await createUserWithPassword({ email: 'audit-user-update@test.local', role: ROLES.USER });

      const res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ first_name: 'New', last_name: 'Name' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('USER_UPDATED');
      const before = audit.before;
      const after = audit.after;
      expect(before.first_name).toBe(user.first_name);
      expect(after.first_name).toBe('New');
    });

    it('10. Повторная отправка инвайта создаёт запись INVITE_RESENT', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-invite-resent-admin@test.local' });
      const invited = await createInvitedUser({
        email: 'audit-invite-resent@test.local',
        token: 'token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${invited.id}/resend-invite`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('INVITE_RESENT');
      expect(audit.entity_id).toBe(invited.id);
    });

    it('11. Регенерация ссылки создаёт запись INVITE_LINK_REGENERATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-link-reg-admin@test.local' });
      const user = await createInvitedUser({
        email: 'audit-link-reg@test.local',
        invite_mode: 'link',
        token: 'old',
        expiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${user.id}/regenerate-link`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('INVITE_LINK_REGENERATED');
      expect(audit.entity_id).toBe(user.id);
    });

    it('12. Регенерация email-инвайта создаёт запись INVITE_EMAIL_REGENERATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-email-reg-admin@test.local' });
      const user = await createInvitedUser({
        email: 'audit-email-reg@test.local',
        invite_mode: 'email',
        token: 'old',
        expiresAt: new Date(Date.now() - 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${user.id}/regenerate-email-invite`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('INVITE_EMAIL_REGENERATED');
      expect(audit.entity_id).toBe(user.id);
    });
  });

  describe('Projects', () => {
    it('13. Создание проекта создаёт запись PROJECT_CREATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-project-create@test.local' });

      const res = await agent
        .post('/api/projects')
        .send({ name: 'Audit Project' });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('PROJECT_CREATED');
      const after = audit.after;
      expect(after.name).toBe('Audit Project');
      expect(audit.entity_type).toBe('project');
    });

    it('14. Обновление проекта создаёт запись PROJECT_UPDATED с before/after', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-project-update@test.local' });
      const project = await createProject({ name: 'P-old', status: 'active' });

      const res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ status: 'closed' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('PROJECT_UPDATED');
      const before = audit.before;
      const after = audit.after;
      expect(before.status).toBe('active');
      expect(after.status).toBe('closed');
    });
  });

  describe('Work Logs', () => {
    it('15. Создание work_log создаёт запись WORK_LOG_CREATED', async () => {
      const { agent, user } = await loginAs({ email: 'audit-wl-create@test.local' });
      const project = await createProject();

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Audit create',
          task_number: 'AUD-1',
          user_id: user.id,
        });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('WORK_LOG_CREATED');
      const after = audit.after;
      expect(after.date).toBeTruthy();
      expect(after.project_id).toBe(project.id);
    });

    it('16. Обновление work_log создаёт запись WORK_LOG_UPDATED с before/after', async () => {
      const { agent, user } = await loginAs({ email: 'audit-wl-update@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 1,
        comment: 'Old',
      });

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ comment: 'New comment' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('WORK_LOG_UPDATED');
      const before = audit.before;
      const after = audit.after;
      expect(before).toBeTruthy();
      expect(after).toBeTruthy();
    });

    it('17. Удаление work_log создаёт запись WORK_LOG_DELETED с before', async () => {
      const { agent, user } = await loginAs({ email: 'audit-wl-delete@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 2,
      });

      const res = await agent.delete(`/api/work-logs/${log.id}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('WORK_LOG_DELETED');
      const before = audit.before;
      expect(before.date).toBeTruthy();
      expect(Number(before.duration_days)).toBe(2);
    });
  });

  describe('Absences', () => {
    it('18. Создание absence создаёт запись ABSENCE_CREATED', async () => {
      const { agent } = await loginAs({ email: 'audit-abs-create@test.local' });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-10',
          date_to: '2025-01-12',
        });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('ABSENCE_CREATED');
      const after = audit.after;
      expect(after.type).toBe('vacation');
      expect(Array.isArray(after.dates)).toBe(true);
      expect(after.dates.length).toBeGreaterThanOrEqual(1);
    });

    it('19. Обновление absence создаёт запись ABSENCE_UPDATED с before/after', async () => {
      const { agent, user } = await loginAs({ email: 'audit-abs-update@test.local' });
      const absence = await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-10',
        duration_days: 1,
      });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({
          type: 'sick_leave',
          date_from: '2025-01-11',
          date_to: '2025-01-11',
        });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('ABSENCE_UPDATED');
      const before = audit.before;
      expect(before.type).toBe('vacation');
    });

    it('20. Удаление absence создаёт запись ABSENCE_DELETED с before', async () => {
      const { agent, user } = await loginAs({ email: 'audit-abs-delete@test.local' });
      const absence = await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-10',
        duration_days: 1,
      });

      const res = await agent.delete(`/api/absences/${absence.id}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('ABSENCE_DELETED');
      const before = audit.before;
      expect(before.date).toBeTruthy();
      expect(before.type).toBe('vacation');
    });
  });

  describe('Calendar', () => {
    it('21. Изменение статуса дня создаёт запись CALENDAR_DAY_UPDATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cal-day@test.local' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-10')
        .send({ day_type: 'holiday' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CALENDAR_DAY_UPDATED');
      const after = audit.after;
      expect(after.date.startsWith('2025-01-10')).toBe(true);
      expect(after.day_type).toBe('holiday');
    });

    it('22. Изменение статуса существующего дня сохраняет before', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cal-day-before@test.local' });

      await agent
        .patch('/api/calendar/days/2025-01-11')
        .send({ day_type: 'holiday' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-11')
        .send({ day_type: 'working' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CALENDAR_DAY_UPDATED');
      const before = audit.before;
      expect(before.day_type).toBe('holiday');
    });

    it('23. Изменение нормы создаёт запись CALENDAR_NORM_UPDATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cal-norm@test.local' });

      const res = await agent
        .put(`/api/calendar/norm/${YEAR}/${MONTH}`)
        .send({ norm_hours: 160 });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CALENDAR_NORM_UPDATED');
      const after = audit.after;
      expect(after.norm_hours).toBe(160);
    });
  });

  describe('Month Closures', () => {
    it('24. Закрытие месяца создаёт запись MONTH_CLOSED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-mc-close@test.local' });

      const res = await agent
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('MONTH_CLOSED');
      const after = audit.after;
      expect(after.year).toBe(YEAR);
      expect(after.month).toBe(MONTH);
    });

    it('25. Открытие месяца создаёт запись MONTH_OPENED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-mc-open@test.local' });

      await agent
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });

      const res = await agent.delete(`/api/month-closures/${YEAR}/${MONTH}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('MONTH_OPENED');
      const before = audit.before;
      expect(before.year).toBe(YEAR);
      expect(before.month).toBe(MONTH);
    });
  });

  describe('Custom Fields', () => {
    it('26. Создание кастомного поля создаёт запись CUSTOM_FIELD_CREATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-create@test.local' });

      const res = await agent
        .post('/api/custom-fields')
        .send({ name: 'CF Audit', type: 'text' });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_CREATED');
      const after = audit.after;
      expect(after.name).toBe('CF Audit');
      expect(after.type).toBe('text');
    });

    it('27. Обновление кастомного поля создаёт CUSTOM_FIELD_UPDATED с before/after', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-update@test.local' });
      const field = await createCustomField({ name: 'Old CF', type: 'text' });

      const res = await agent
        .patch(`/api/custom-fields/${field.id}`)
        .send({ name: 'New CF' });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_UPDATED');
      const before = audit.before;
      const after = audit.after;
      expect(before.name).toBe('Old CF');
      expect(after.name).toBe('New CF');
    });

    it('28. Soft delete создаёт запись CUSTOM_FIELD_DELETED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-delete@test.local' });
      const field = await createCustomField({ name: 'To Delete' });

      const res = await agent.delete(`/api/custom-fields/${field.id}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_DELETED');
      expect(audit.entity_id).toBe(field.id);
    });

    it('29. Restore создаёт запись CUSTOM_FIELD_RESTORED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-restore@test.local' });
      const field = await createCustomField({ name: 'To Restore' });

      await agent.delete(`/api/custom-fields/${field.id}`);

      const res = await agent.post(`/api/custom-fields/${field.id}/restore`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_RESTORED');
      expect(audit.entity_id).toBe(field.id);
    });

    it('30. Добавление опции создаёт запись CUSTOM_FIELD_OPTION_ADDED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-option-add@test.local' });
      const field = await createCustomField({ name: 'With Option', type: 'dropdown' });

      const res = await agent
        .post(`/api/custom-fields/${field.id}/options`)
        .send({ label: 'Opt1' });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_OPTION_ADDED');
      const after = audit.after;
      expect(after.label).toBe('Opt1');
    });

    it('31. Deprecate опции создаёт запись CUSTOM_FIELD_OPTION_DEPRECATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-cf-option-depr@test.local' });
      const field = await createCustomField({ name: 'With Option 2', type: 'dropdown' });

      const [option] = await db('custom_field_options')
        .insert({ custom_field_id: field.id, label: 'Deprecated', sort_order: 0 })
        .returning('*');

      const res = await agent.delete(`/api/custom-fields/${field.id}/options/${option.id}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_OPTION_DEPRECATED');
      const after = audit.after;
      expect(after.option_id).toBe(option.id);
    });
  });

  describe('Project Custom Fields', () => {
    it('32. Привязка поля к проекту создаёт запись CUSTOM_FIELD_ATTACHED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-pcf-attach@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });
      expect(res.status).toBe(201);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_ATTACHED');
      expect(audit.entity_type).toBe('project');
      expect(audit.entity_id).toBe(project.id);
    });

    it('33. Обновление привязки создаёт запись CUSTOM_FIELD_PROJECT_UPDATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-pcf-update@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      await db('project_custom_fields').insert({
        project_id: project.id,
        custom_field_id: field.id,
        is_required: false,
        is_enabled: true,
      });

      const res = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_required: true });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_PROJECT_UPDATED');
    });

    it('34. Открепление поля создаёт запись CUSTOM_FIELD_DETACHED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-pcf-detach@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      await db('project_custom_fields').insert({
        project_id: project.id,
        custom_field_id: field.id,
        is_required: false,
        is_enabled: true,
      });

      const res = await agent.delete(`/api/projects/${project.id}/custom-fields/${field.id}`);
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('CUSTOM_FIELD_DETACHED');
      const after = audit.after;
      expect(after.custom_field_id).toBe(field.id);
    });
  });

  describe('Notifications', () => {
    it('35. Обновление глобальных настроек создаёт запись NOTIFICATIONS_GLOBAL_UPDATED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'audit-notif-global@test.local' });

      const res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('NOTIFICATIONS_GLOBAL_UPDATED');
      const after = audit.after;
      expect(after.global_enabled).toBe(false);
    });

    it('36. Обновление настроек пользователя создаёт запись NOTIFICATIONS_USER_UPDATED', async () => {
      const { agent, user } = await loginAs({ role: ROLES.ADMIN, email: 'audit-notif-user@test.local' });

      const res = await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });
      expect(res.status).toBe(200);

      const audit = await getLastAudit();
      expect(audit.event_type).toBe('NOTIFICATIONS_USER_UPDATED');
      expect(audit.entity_id).toBe(user.id);
      const after = audit.after;
      expect(after.enabled).toBe(false);
    });
  });

  describe('Общие проверки', () => {
    it('37. Каждая audit_log запись содержит ip адрес', async () => {
      const user = await createUserWithPassword({ email: 'audit-ip@test.local' });

      await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Password123!' });

      const audit = await getLastAudit();
      expect(typeof audit.ip).toBe('string');
      expect(audit.ip.length).toBeGreaterThan(0);
    });

    it('38. actor_id корректно проставляется для всех операций', async () => {
      const { agent, user } = await loginAs({ role: ROLES.ADMIN, email: 'audit-actor@test.local' });

      await agent
        .post('/api/projects')
        .send({ name: 'Actor Project' });

      const audit = await getLastAudit();
      expect(audit.actor_id).toBe(user.id);
    });

    it('39. Неудачные операции не создают лишних success-записей', async () => {
      const { agent } = await loginAs({ email: 'audit-fail-op@test.local' });

      const before = await db('audit_logs').count('* as c').where({ result: 'success' }).first();
      const beforeCount = Number(before?.c || 0);

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: '00000000-0000-0000-0000-000000000000',
          date: '2025-01-06',
          duration: '8h',
        });
      expect(res.status).toBeGreaterThanOrEqual(400);

      const after = await db('audit_logs').count('* as c').where({ result: 'success' }).first();
      const afterCount = Number(after?.c || 0);
      expect(afterCount).toBe(beforeCount);
    });
  });
});
