import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();

router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.patch('/auth/profile', authenticate, AuthController.updateProfile);
router.post('/auth/change-password', authenticate, AuthController.changePassword);
router.get('/auth/me', authenticate, AuthController.me);

export default router;
