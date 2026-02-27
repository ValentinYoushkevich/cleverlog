import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLog.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', AuditLogController.list);
router.get('/filter-options', AuditLogController.filterOptions);
router.get('/export', AuditLogController.export);

export default router;
