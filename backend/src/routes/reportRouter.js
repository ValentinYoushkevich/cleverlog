import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/user', ReportController.userReport);
router.get('/user/export', ReportController.exportUser);

router.get('/project', authorize('admin'), ReportController.projectReport);
router.get('/project/export', authorize('admin'), ReportController.exportProject);
router.get('/monthly-summary', authorize('admin'), ReportController.monthlySummary);
router.get('/monthly-summary/export', authorize('admin'), ReportController.exportMonthlySummary);
router.get('/unlogged', authorize('admin'), ReportController.unlogged);
router.get('/unlogged/export', authorize('admin'), ReportController.exportUnlogged);

export default router;
