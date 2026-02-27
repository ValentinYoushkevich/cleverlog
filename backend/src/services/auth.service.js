import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { LOCK_DURATION_MS, MAX_LOGIN_ATTEMPTS } from '../constants/auth.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AuditService } from './audit.service.js';

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const AuthService = {
  async register({ token, password, ip }) {
    const user = await UserRepository.findByInviteToken(token);
    if (!user) {
      throw appError(400, 'INVALID_TOKEN', 'Инвайт недействителен');
    }

    if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
      throw appError(400, 'TOKEN_EXPIRED', 'Инвайт истёк');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await UserRepository.updateById(user.id, {
      password_hash: passwordHash,
      invite_token_hash: null,
      invite_expires_at: null,
      failed_attempts: 0,
      locked_until: null,
    });

    await AuditService.log({
      actorId: user.id,
      actorRole: user.role,
      eventType: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      ip,
      result: 'success',
    });

    return { message: 'Регистрация успешна' };
  },

  async login({ email, password, ip }) {
    const user = await UserRepository.findByEmail(email);
    if (!user?.password_hash) {
      throw appError(401, 'INVALID_CREDENTIALS', 'Неверные учётные данные');
    }

    if (user.status === 'inactive') {
      throw appError(403, 'ACCOUNT_INACTIVE', 'Аккаунт деактивирован');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        eventType: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        after: { reason: 'ACCOUNT_LOCKED' },
        ip,
        result: 'failure',
      });

      throw appError(429, 'ACCOUNT_LOCKED', 'Аккаунт временно заблокирован');
    }

    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      const attempts = (user.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

      await UserRepository.updateById(user.id, {
        failed_attempts: attempts,
        locked_until: lockedUntil,
      });

      await AuditService.log({
        actorId: user.id,
        actorRole: user.role,
        eventType: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        ip,
        result: 'failure',
      });

      throw appError(401, 'INVALID_CREDENTIALS', 'Неверные учётные данные');
    }

    await UserRepository.updateById(user.id, {
      failed_attempts: 0,
      locked_until: null,
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await AuditService.log({
      actorId: user.id,
      actorRole: user.role,
      eventType: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ip,
      result: 'success',
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
  },

  async logout({ tokenPayload, ip }) {
    if (tokenPayload?.userId) {
      await AuditService.log({
        actorId: tokenPayload.userId,
        actorRole: tokenPayload.role,
        eventType: 'LOGOUT',
        entityType: 'user',
        entityId: tokenPayload.userId,
        ip,
        result: 'success',
      });
    }
  },

  async changePassword({ userId, current_password: currentPassword, new_password: newPassword, ip }) {
    const user = await UserRepository.findById(userId);
    if (!user?.password_hash) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    const isValid = await argon2.verify(user.password_hash, currentPassword);
    if (!isValid) {
      throw appError(400, 'INVALID_PASSWORD', 'Текущий пароль неверен');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await UserRepository.updateById(userId, { password_hash: passwordHash });

    await AuditService.log({
      actorId: user.id,
      actorRole: user.role,
      eventType: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: user.id,
      ip,
      result: 'success',
    });

    return { message: 'Пароль изменён' };
  },
};
