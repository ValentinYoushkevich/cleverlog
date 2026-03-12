import { UserRepository } from '../repositories/user.repository.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { generateInviteToken } from '../utils/token.js';
import { AuditService } from './audit.service.js';

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeEmailForCreate(rawEmail) {
  const v = rawEmail ?? null;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

async function ensureEmailNotTaken(normalizedEmail) {
  if (!normalizedEmail) { return; }
  const existing = await UserRepository.findByEmail(normalizedEmail);
  if (existing) { throw appError(409, 'EMAIL_EXISTS', 'Email уже занят'); }
}

export const UserService = {
  async list(filters) {
    const users = await UserRepository.findAll(filters);
    return users;
  },

  async getById(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    const { invite_token_hash, ...rest } = user;
    const result = { ...rest };

    if (
      rest.invite_mode === 'link' &&
      invite_token_hash &&
      !rest.password_hash &&
      rest.invite_expires_at &&
      new Date(rest.invite_expires_at) > new Date()
    ) {
      result.invite_link = `${process.env.CLIENT_URL}/register/${invite_token_hash}`;
    }

    return result;
  },

  async create({ actorId, actorRole, ip, invite_mode = 'email', ...data }) {
    const mode = invite_mode === 'link' ? 'link' : 'email';
    const normalizedEmail = normalizeEmailForCreate(data.email);
    if (mode === 'email') { await ensureEmailNotTaken(normalizedEmail); }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const user = await UserRepository.create({
      ...data, email: normalizedEmail, invite_mode: mode,
      invite_token_hash: inviteToken, invite_expires_at: inviteExpiresAt, status: data.status || 'active',
    });
    const inviteLink = `${process.env.CLIENT_URL}/register/${inviteToken}`;

    if (invite_mode === 'email') {
      if (!user.email) { throw appError(400, 'EMAIL_REQUIRED', 'Email обязателен для отправки инвайта'); }
      await sendInviteEmail({ to: user.email, inviteToken, firstName: user.first_name });
    }
    await AuditService.log({
      actorId, actorRole, eventType: 'USER_CREATED', entityType: 'user', entityId: user.id,
      after: { email: user.email, role: user.role }, ip, result: 'success',
    });
    return invite_mode === 'link' ? { user, invite_link: inviteLink } : user;
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

    const now = new Date();
    if (!user.invite_token_hash || !user.invite_expires_at || new Date(user.invite_expires_at) <= now) {
      throw appError(400, 'INVITE_EXPIRED', 'Инвайт истёк. Сначала перегенерируйте токен.');
    }

    await sendInviteEmail({
      to: user.email,
      inviteToken: user.invite_token_hash,
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

  async regenerateInviteLink({ id, actorId, actorRole, ip }) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    if (user.password_hash) {
      throw appError(400, 'ALREADY_REGISTERED', 'Пользователь уже зарегистрирован');
    }

    if (user.invite_mode !== 'link') {
      throw appError(400, 'WRONG_INVITE_MODE', 'Для этого пользователя используется приглашение по email');
    }

    const now = new Date();
    if (user.invite_token_hash && user.invite_expires_at && new Date(user.invite_expires_at) > now) {
      throw appError(400, 'INVITE_ACTIVE', 'У пользователя уже есть активная ссылка для регистрации');
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    await UserRepository.updateById(id, {
      invite_token_hash: inviteToken,
      invite_expires_at: inviteExpiresAt,
    });

    const inviteLink = `${process.env.CLIENT_URL}/register/${inviteToken}`;

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'INVITE_LINK_REGENERATED',
      entityType: 'user',
      entityId: id,
      ip,
      result: 'success',
    });

    return { invite_link: inviteLink };
  },

  async regenerateEmailInvite({ id, actorId, actorRole, ip }) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw appError(404, 'NOT_FOUND', 'Пользователь не найден');
    }

    if (user.password_hash) {
      throw appError(400, 'ALREADY_REGISTERED', 'Пользователь уже зарегистрирован');
    }

    if (user.invite_mode !== 'email') {
      throw appError(400, 'WRONG_INVITE_MODE', 'Для этого пользователя используется приглашение по ссылке в чат');
    }

    if (!user.email) {
      throw appError(400, 'EMAIL_REQUIRED', 'Email обязателен для перегенерации инвайта');
    }

    const now = new Date();
    if (user.invite_token_hash && user.invite_expires_at && new Date(user.invite_expires_at) > now) {
      throw appError(400, 'INVITE_ACTIVE', 'У пользователя уже есть активный инвайт');
    }

    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    await UserRepository.updateById(id, {
      invite_token_hash: inviteToken,
      invite_expires_at: inviteExpiresAt,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'INVITE_EMAIL_REGENERATED',
      entityType: 'user',
      entityId: id,
      ip,
      result: 'success',
    });

    return { message: 'Инвайт перегенерирован' };
  },
};
