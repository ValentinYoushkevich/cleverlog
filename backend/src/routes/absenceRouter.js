import { Router } from 'express';
import { AbsenceController } from '../controllers/absence.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { checkMonthClosed } from '../middlewares/checkMonthClosed.js';
import { AbsenceRepository } from '../repositories/absence.repository.js';

const router = Router();

async function injectAbsenceDate(req, _res, next) {
  try {
    const absence = await AbsenceRepository.findById(req.params.id);
    if (absence?.date) {
      req.workLogDate = absence.date;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function injectRangeStartDate(req, _res, next) {
  if (req.body?.date_from) {
    req.workLogDate = req.body.date_from;
  }
  return next();
}

router.use(authenticate);

router.get('/', AbsenceController.list);
router.post('/', injectRangeStartDate, checkMonthClosed, AbsenceController.create);
router.patch('/:id', injectAbsenceDate, checkMonthClosed, AbsenceController.update);
router.delete('/:id', injectAbsenceDate, checkMonthClosed, AbsenceController.delete);

export default router;
