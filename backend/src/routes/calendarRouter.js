import { Router } from 'express';
import { CalendarController } from '../controllers/calendar.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/:year/:month', authenticate, CalendarController.getMonth);
router.get('/norm/:year/:month', authenticate, CalendarController.getNorm);

router.patch('/days/:date', authenticate, authorize('admin'), CalendarController.updateDay);
router.put('/norm/:year/:month', authenticate, authorize('admin'), CalendarController.updateNorm);

export default router;
