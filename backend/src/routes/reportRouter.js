import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { ReportController } from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/user', ReportController.userReport);
router.get('/user/export', ReportController.exportUser);

router.get('/project', authorize(ROLES.ADMIN), ReportController.projectReport);
router.get('/project/export', authorize(ROLES.ADMIN), ReportController.exportProject);
router.get('/monthly-summary', authorize(ROLES.ADMIN), ReportController.monthlySummary);
router.get('/monthly-summary/export', authorize(ROLES.ADMIN), ReportController.exportMonthlySummary);
router.get('/unlogged', authorize(ROLES.ADMIN), ReportController.unlogged);
router.get('/unlogged/export', authorize(ROLES.ADMIN), ReportController.exportUnlogged);

export default router;
