import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { JsErrorController } from '../controllers/jsError.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', JsErrorController.list);

export default router;
