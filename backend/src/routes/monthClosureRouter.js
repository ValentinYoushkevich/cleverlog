import { Router } from 'express';
import { MonthClosureController } from '../controllers/monthClosure.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/status/:year/:month', authenticate, MonthClosureController.status);

router.use(authenticate, authorize('admin'));
router.get('/', MonthClosureController.list);
router.post('/', MonthClosureController.close);
router.delete('/:year/:month', MonthClosureController.open);

export default router;
