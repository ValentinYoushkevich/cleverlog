import { Router } from 'express';
import { CustomFieldController } from '../controllers/customField.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', CustomFieldController.list);
router.post('/', CustomFieldController.create);
router.patch('/:id', CustomFieldController.update);
router.delete('/:id', CustomFieldController.softDelete);
router.post('/:id/restore', CustomFieldController.restore);

router.get('/:id/options', CustomFieldController.getOptions);
router.post('/:id/options', CustomFieldController.addOption);
router.delete('/:id/options/:optionId', CustomFieldController.deprecateOption);

export default router;
