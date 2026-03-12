import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', DashboardController.getSummary);
router.get('/users', DashboardController.getDetailList);

export default router;
