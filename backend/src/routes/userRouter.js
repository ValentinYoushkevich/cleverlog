import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', UserController.list);
router.get('/:id', UserController.getById);
router.post('/', UserController.create);
router.patch('/:id', UserController.update);
router.post('/:id/resend-invite', UserController.resendInvite);
router.post('/:id/regenerate-link', UserController.regenerateInviteLink);
router.post('/:id/regenerate-email-invite', UserController.regenerateEmailInvite);

export default router;
