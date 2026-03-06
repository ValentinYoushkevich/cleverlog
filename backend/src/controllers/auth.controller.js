import jwt from 'jsonwebtoken';
import { JWT_COOKIE_NAME } from '../constants/auth.js';
import { AuthService } from '../services/auth.service.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // In dev (http://localhost) browsers reject SameSite=None without Secure.
  // We only need SameSite=None in production deployments with separate frontend domain.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const AuthController = {
  async register(req, res, next) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await AuthService.register({ ...data, ip: req.ip });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const { token, user } = await AuthService.login({ ...data, ip: req.ip });
      res.cookie(JWT_COOKIE_NAME, token, COOKIE_OPTIONS);
      return res.json({ user });
    } catch (err) {
      return next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const token = req.cookies[JWT_COOKIE_NAME];
      let tokenPayload = null;

      if (token) {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === 'object') {
          tokenPayload = decoded;
        }
      }

      await AuthService.logout({ tokenPayload, ip: req.ip });
      res.clearCookie(JWT_COOKIE_NAME, COOKIE_OPTIONS);
      return res.json({ message: 'Выход выполнен' });
    } catch (err) {
      return next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const data = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword({
        ...data,
        userId: req.user.id,
        ip: req.ip,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const result = await AuthService.updateProfile({
        ...data,
        userId: req.user.id,
        ip: req.ip,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  me(req, res) {
    const {
      id,
      email,
      role,
      first_name: firstName,
      last_name: lastName,
      position,
      status,
    } = req.user;

    return res.json({
      id,
      email,
      role,
      first_name: firstName,
      last_name: lastName,
      position,
      status,
    });
  },
};
