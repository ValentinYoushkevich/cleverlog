import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/settings', NotificationController.getGlobal);
router.patch('/settings', NotificationController.updateGlobal);
router.patch('/users/:userId', NotificationController.updateUserSetting);
router.post('/trigger', NotificationController.triggerManual);

export default router;
