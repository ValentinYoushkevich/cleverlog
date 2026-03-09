import { Router } from 'express';
import { JsErrorController } from '../controllers/jsError.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));
router.get('/', JsErrorController.list);

export default router;
