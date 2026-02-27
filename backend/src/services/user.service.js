import { UserRepository } from '../repositories/user.repository.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { generateInviteToken } from '../utils/token.js';
import { AuditService } from './audit.service.js';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const UserService = {
  async list(filters) {
    return UserRepository.findAll(filters);
  },

  async getById(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    return user;
  },

  async create({ actorId, actorRole, ip, ...data }) {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw appError(409, 'EMAIL_EXISTS', 'Email уже занят');
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const user = await UserRepository.create({
      ...data,
      invite_token_hash: inviteToken,
      invite_expires_at: inviteExpiresAt,
      status: data.status || 'active',
    });

    await sendInviteEmail({
      to: user.email,
      inviteToken,
      firstName: user.first_name,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      after: { email: user.email, role: user.role },
      ip,
      result: 'success',
    });

    return user;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    const updated = await UserRepository.updateById(id, data);

    if (!updated) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    if (user.status !== 'inactive' && data.status === 'inactive') {
      await UserRepository.deleteSessionsByUserId(id);
    }

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      before: {
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status,
        position: user.position,
      },
      after: data,
      ip,
      result: 'success',
    });

    return updated;
  },

  async resendInvite({ id, actorId, actorRole, ip }) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    if (user.password_hash) {
      throw appError(400, 'ALREADY_REGISTERED', 'Пользователь уже зарегистрирован');
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await UserRepository.updateById(id, {
      invite_token_hash: inviteToken,
      invite_expires_at: inviteExpiresAt,
    });

    await sendInviteEmail({
      to: user.email,
      inviteToken,
      firstName: user.first_name,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'INVITE_RESENT',
      entityType: 'user',
      entityId: id,
      ip,
      result: 'success',
    });

    return { message: 'Инвайт отправлен повторно' };
  },
};
