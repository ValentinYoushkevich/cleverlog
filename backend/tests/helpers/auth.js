import request from 'supertest';
import app from '../../app.js';
import { ROLES } from '../../src/constants/roles.js';
import { createUserWithPassword } from './factories.js';

// Создаёт пользователя, логинит его и возвращает supertest agent с установленной cookie.

export async function loginAs({
  role = ROLES.USER,
  status = 'active',
  email,
  password = 'Password123!',
  ...overrides
} = {}) {
  const user = await createUserWithPassword({
    email,
    password,
    role,
    status,
    ...overrides,
  });

  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password });

  return { agent, user, res };
}
