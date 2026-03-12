import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createInvitedUser,
  createUser,
  createUserWithPassword,
} from '../helpers/factories.js';

vi.mock('../../src/utils/mailer.js', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('User module', () => {
  beforeEach(async () => {
    await db('users').whereNotNull('id'); // noop to ensure db import
  });

  describe('GET /api/users', () => {
    it('1–4. Список, фильтры и отсутствие чувствительных полей', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-list@test.local' });

      const active = await createUser({ email: 'users-active@test.local', status: 'active', role: ROLES.USER });
      await createUser({ email: 'users-inactive@test.local', status: 'inactive', role: ROLES.USER });
      await createUser({ email: 'users-admin@test.local', status: 'active', role: ROLES.ADMIN });

      let res = await agent.get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body.some((u) => u.id === active.id)).toBe(true);

      res = await agent.get('/api/users?status=inactive');
      expect(res.status).toBe(200);
      expect(res.body.every((u) => u.status === 'inactive')).toBe(true);

      res = await agent.get(`/api/users?role=${ROLES.ADMIN}`);
      expect(res.status).toBe(200);
      expect(res.body.every((u) => u.role === ROLES.ADMIN)).toBe(true);

      res = await agent.get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body.every((u) => u.password_hash === undefined)).toBe(true);
      expect(res.body.every((u) => u.invite_token_hash === undefined)).toBe(true);

    });

    it('5. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'users-user@test.local' });
      const res = await agent.get('/api/users');
      expect(res.status).toBe(403);
    });

    it('6. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('7. Успешно возвращает пользователя по id', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-get@test.local' });
      const user = await createUser({ email: 'users-get-user@test.local' });

      const res = await agent.get(`/api/users/${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
    });

    it('8–9. invite_link для link-инвайта и отсутствие для зарегистрированного', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-invite-link@test.local' });
      const linkUser = await createUser({
        first_name: 'Link',
        last_name: 'User',
        invite_mode: 'link',
        invite_token_hash: 'token123',
        invite_expires_at: new Date(Date.now() + 3600_000),
        password_hash: null,
      });

      const registered = await createUserWithPassword({ email: 'users-registered@test.local' });

      let res = await agent.get(`/api/users/${linkUser.id}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.invite_link === 'string').toBe(true);

      res = await agent.get(`/api/users/${registered.id}`);
      expect(res.status).toBe(200);
      expect(res.body.invite_link).toBeUndefined();
    });

    it('10. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-get-404@test.local' });
      const res = await agent.get('/api/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/users', () => {
    it('11. Успешное создание пользователя с invite_mode: email', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-create-email@test.local' });

      const res = await agent
        .post('/api/users')
        .send({
          email: 'create-email@test.local',
          first_name: 'First',
          last_name: 'Last',
          role: ROLES.USER,
          department: 'IT',
          invite_mode: 'email',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('12. Успешное создание пользователя с invite_mode: link', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-create-link@test.local' });

      const res = await agent
        .post('/api/users')
        .send({
          first_name: 'Link',
          last_name: 'User',
          role: ROLES.USER,
          department: 'IT',
          invite_mode: 'link',
        });

      expect(res.status).toBe(201);
      expect(res.body.invite_link).toBeDefined();
    });

    it('13. Email уже занят возвращает 409', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-create-exists@test.local' });
      await createUser({ email: 'exists@test.local' });

      const res = await agent
        .post('/api/users')
        .send({
          email: 'exists@test.local',
          first_name: 'Dup',
          last_name: 'User',
          role: ROLES.USER,
          department: 'IT',
          invite_mode: 'email',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_EXISTS');
    });

    it('14. invite_mode: email без email возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-create-noemail@test.local' });

      const res = await agent
        .post('/api/users')
        .send({
          first_name: 'No',
          last_name: 'Email',
          role: ROLES.USER,
          department: 'IT',
          invite_mode: 'email',
        });

      expect(res.status).toBe(400);
    });

    it('15. Невалидные данные не проходят Zod', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-create-invalid@test.local' });

      const res = await agent
        .post('/api/users')
        .send({ first_name: 'Only' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('16–17. Обновление имени/позиции и смена роли', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-patch@test.local' });
      const user = await createUser({ email: 'users-patch-user@test.local', role: ROLES.USER });

      let res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ first_name: 'New', last_name: 'Name', position: 'Dev' });
      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe('New');

      res = await agent
        .patch(`/api/users/${user.id}`)
        .send({ role: ROLES.ADMIN });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe(ROLES.ADMIN);
    });

    it('18–19. Деактивация инвалидирует сессии и реактивация', async () => {
      const password = 'Password123!';
      const { agent: userAgent, user } = await loginAs({
        email: 'users-deactivate@test.local',
        password,
      });

      const { agent: adminAgent } = await loginAs({ role: ROLES.ADMIN, email: 'users-deactivate-admin@test.local' });

      const res1 = await adminAgent
        .patch(`/api/users/${user.id}`)
        .send({ status: 'inactive' });
      expect(res1.status).toBe(200);

      const meRes = await userAgent.get('/api/auth/me');
      expect(meRes.status).toBe(401);

      const res2 = await adminAgent
        .patch(`/api/users/${user.id}`)
        .send({ status: 'active' });
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('active');
    });

    it('20. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-patch-404@test.local' });
      const res = await agent
        .patch('/api/users/00000000-0000-0000-0000-000000000000')
        .send({ first_name: 'New' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/users/:id/resend-invite', () => {
    it('21. Успешная повторная отправка инвайта', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-resend@test.local' });
      const user = await createInvitedUser({
        email: 'resend@test.local',
        token: 'token-resend',
      });

      const res = await agent.post(`/api/users/${user.id}/resend-invite`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Инвайт отправлен повторно');
    });

    it('22. Уже зарегистрированному пользователю возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-resend-registered@test.local' });
      const user = await createUserWithPassword({ email: 'registered@test.local' });

      const res = await agent.post(`/api/users/${user.id}/resend-invite`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALREADY_REGISTERED');
    });

    it('23. Истёкший токен блокирует повторную отправку', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-resend-expired@test.local' });
      const user = await createUser({
        email: 'expired@test.local',
        invite_token_hash: 'old',
        invite_expires_at: new Date(Date.now() - 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${user.id}/resend-invite`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVITE_EXPIRED');
    });
  });

  describe('POST /api/users/:id/regenerate-link', () => {
    it('24. Успешная регенерация ссылки', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-reg-link@test.local' });
      const user = await createUser({
        invite_mode: 'link',
        invite_token_hash: 'old',
        invite_expires_at: new Date(Date.now() - 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${user.id}/regenerate-link`);
      expect(res.status).toBe(200);
      expect(res.body.invite_link).toBeDefined();
    });

    it('25–27. Ошибки для неправильного режима/активного/зарегистрированного', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-reg-link-errors@test.local' });
      const emailMode = await createUser({ invite_mode: 'email' });
      const activeLink = await createUser({
        invite_mode: 'link',
        invite_token_hash: 'active',
        invite_expires_at: new Date(Date.now() + 3600 * 1000),
      });
      const registered = await createUserWithPassword({ email: 'reg-link@test.local' });

      let res = await agent.post(`/api/users/${emailMode.id}/regenerate-link`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WRONG_INVITE_MODE');

      res = await agent.post(`/api/users/${activeLink.id}/regenerate-link`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVITE_ACTIVE');

      res = await agent.post(`/api/users/${registered.id}/regenerate-link`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALREADY_REGISTERED');
    });
  });

  describe('POST /api/users/:id/regenerate-email-invite', () => {
    it('28. Успешная регенерация email-инвайта', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-reg-email@test.local' });
      const user = await createUser({
        email: 'email-reg@test.local',
        invite_mode: 'email',
        invite_token_hash: 'old',
        invite_expires_at: new Date(Date.now() - 3600 * 1000),
      });

      const res = await agent.post(`/api/users/${user.id}/regenerate-email-invite`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Инвайт перегенерирован');
    });

    it('29–31. Ошибки WRONG_INVITE_MODE/INVITE_ACTIVE/EMAIL_REQUIRED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'users-reg-email-errors@test.local' });

      const linkMode = await createUser({ invite_mode: 'link' });
      const active = await createUser({
        email: 'active-email@test.local',
        invite_mode: 'email',
        invite_token_hash: 'active',
        invite_expires_at: new Date(Date.now() + 3600 * 1000),
      });
      const noEmail = await createUser({
        invite_mode: 'email',
        email: null,
        invite_token_hash: 'old',
        invite_expires_at: new Date(Date.now() - 3600 * 1000),
      });

      let res = await agent.post(`/api/users/${linkMode.id}/regenerate-email-invite`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WRONG_INVITE_MODE');

      res = await agent.post(`/api/users/${active.id}/regenerate-email-invite`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVITE_ACTIVE');

      res = await agent.post(`/api/users/${noEmail.id}/regenerate-email-invite`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EMAIL_REQUIRED');
    });
  });
});
