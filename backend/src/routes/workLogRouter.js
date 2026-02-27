import { Router } from 'express';
import { WorkLogController } from '../controllers/workLog.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { checkMonthClosed } from '../middlewares/checkMonthClosed.js';

const router = Router();

router.use(authenticate);

router.get('/', WorkLogController.list);
router.post('/', checkMonthClosed, WorkLogController.create);
router.patch('/:id', checkMonthClosed, WorkLogController.update);
router.delete('/:id', checkMonthClosed, WorkLogController.delete);

export default router;
