import { Router } from 'express';
import { JsErrorController } from '../controllers/jsError.controller.js';

const router = Router();

router.post('/log-js-error', JsErrorController.log);

export default router;
