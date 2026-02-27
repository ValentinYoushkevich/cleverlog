import { Router } from 'express';
import { CustomFieldController } from '../controllers/customField.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, CustomFieldController.getProjectFields);
router.post('/', authenticate, authorize('admin'), CustomFieldController.attachToProject);
router.patch('/:fieldId', authenticate, authorize('admin'), CustomFieldController.updateProjectField);
router.delete('/:fieldId', authenticate, authorize('admin'), CustomFieldController.detachFromProject);

export default router;
