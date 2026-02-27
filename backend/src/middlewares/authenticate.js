import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { JWT_COOKIE_NAME } from '../constants/auth.js';
import { UserRepository } from '../repositories/user.repository.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies[JWT_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Не авторизован' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserRepository.findById(payload.userId);

    if (!user || user.status === 'inactive') {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Сессия недействительна' });
    }

    req.user = user;
    return next();
  } catch (error_) {
    logger.warn('Invalid auth token', { message: error_.message });
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Токен недействителен' });
  }
}
