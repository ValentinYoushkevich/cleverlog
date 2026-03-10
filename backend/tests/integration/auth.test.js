import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { loginAs } from '../helpers/auth.js';
import { createInvitedUser, createUserWithPassword } from '../helpers/factories.js';

describe('Auth module', () => {
  describe('POST /api/auth/register', () => {
    it('1. Успешная регистрация по валидному инвайту', async () => {
      const token = 'valid-token';
      const invited = await createInvitedUser({
        email: null,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token,
          email: 'new-user@test.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Регистрация успешна');

      const updated = await db('users').where({ id: invited.id }).first();
      expect(updated.invite_token_hash).toBeNull();
      expect(updated.invite_expires_at).toBeNull();
      expect(updated.password_hash).toBeTruthy();
    });

    it('2. Невалидный токен инвайта', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token: 'non-existing-token',
          email: 'user@test.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('3. Истёкший токен инвайта', async () => {
      const token = 'expired-token';
      await createInvitedUser({
        token,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token,
          email: 'user@test.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('4. Email не совпадает с тем что задал админ', async () => {
      const token = 'email-mismatch-token';
      await createInvitedUser({
        email: 'fixed@test.local',
        token,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token,
          email: 'other@test.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EMAIL_MISMATCH');
    });

    it('5. Email уже занят другим пользователем', async () => {
      const existing = await createUserWithPassword({
        email: 'taken@test.local',
      });

      const token = 'email-exists-token';
      await createInvitedUser({
        email: null,
        token,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token,
          email: existing.email,
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_EXISTS');
    });

    it('6. Слабый пароль не проходит валидацию Zod', async () => {
      const token = 'weak-password-token';
      await createInvitedUser({ token });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          token,
          email: 'user@test.local',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('7. Успешный логин', async () => {
      const password = 'Password123!';
      const user = await createUserWithPassword({
        email: 'login-success@test.local',
        password,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password });

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.body.user).toMatchObject({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('8. Неверный пароль увеличивает failed_attempts', async () => {
      const password = 'Password123!';
      const user = await createUserWithPassword({
        email: 'wrong-pass@test.local',
        password,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Wrong123!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');

      const updated = await db('users').where({ id: user.id }).first();
      expect(updated.failed_attempts).toBe(1);
    });

    it('9. Пользователь не существует', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'no-user@test.local', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('10. Аккаунт неактивен', async () => {
      const password = 'Password123!';
      const user = await createUserWithPassword({
        email: 'inactive@test.local',
        password,
        status: 'inactive',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_INACTIVE');
    });

    it('11. Аккаунт заблокирован после 5 неверных попыток', async () => {
      const password = 'Password123!';
      const user = await createUserWithPassword({
        email: 'locked@test.local',
        password,
      });

      for (let i = 0; i < 5; i += 1) {
         
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'Wrong123!' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'Wrong123!' });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('12. Успешный логин сбрасывает счётчик failed_attempts', async () => {
      const password = 'Password123!';
      const user = await createUserWithPassword({
        email: 'reset-attempts@test.local',
        password,
        failed_attempts: 3,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password });

      expect(res.status).toBe(200);

      const updated = await db('users').where({ id: user.id }).first();
      expect(updated.failed_attempts).toBe(0);
      expect(updated.locked_until).toBeNull();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('13. Успешный логаут очищает cookie', async () => {
      const { agent } = await loginAs();

      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('14. Логаут без токена возвращает 200', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/auth/me', () => {
    it('15. Возвращает данные текущего пользователя', async () => {
      const { agent, user } = await loginAs({ email: 'me@test.local' });

      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });

    it('16. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('17. Успешное обновление профиля', async () => {
      const { agent } = await loginAs({ email: 'profile@test.local' });

      const res = await agent
        .patch('/api/auth/profile')
        .send({ first_name: 'New', last_name: 'Name', position: 'Dev' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        first_name: 'New',
        last_name: 'Name',
        position: 'Dev',
      });
    });

    it('18. Без токена возвращает 401', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .send({ first_name: 'New' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('19. Невалидные данные не проходят Zod', async () => {
      const { agent } = await loginAs({ email: 'invalid-profile@test.local' });

      const res = await agent
        .patch('/api/auth/profile')
        .send({ first_name: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('20. position можно сбросить в null', async () => {
      const { agent } = await loginAs({
        email: 'position-null@test.local',
        position: 'Manager',
      });

      const res = await agent
        .patch('/api/auth/profile')
        .send({ first_name: 'New', last_name: 'Name', position: null });

      expect(res.status).toBe(200);
      expect(res.body.position).toBeNull();
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('21. Успешная смена пароля', async () => {
      const password = 'Password123!';
      const { agent, user } = await loginAs({
        email: 'change-pass@test.local',
        password,
      });

      const res = await agent
        .post('/api/auth/change-password')
        .send({
          current_password: password,
          new_password: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Пароль изменён');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'NewPassword123!' });

      expect(loginRes.status).toBe(200);
    });

    it('22. Неверный текущий пароль', async () => {
      const { agent } = await loginAs({
        email: 'invalid-current-pass@test.local',
        password: 'Password123!',
      });

      const res = await agent
        .post('/api/auth/change-password')
        .send({
          current_password: 'Wrong123!',
          new_password: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PASSWORD');
    });

    it('23. Новый пароль не проходит политику Zod', async () => {
      const { agent } = await loginAs({
        email: 'weak-new-pass@test.local',
        password: 'Password123!',
      });

      const res = await agent
        .post('/api/auth/change-password')
        .send({
          current_password: 'Password123!',
          new_password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('24. Без токена возвращает 401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({
          current_password: 'Password123!',
          new_password: 'NewPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });
});
