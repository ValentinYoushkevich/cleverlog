import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { CustomFieldController } from '../controllers/customField.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, CustomFieldController.getProjectFields);
router.post('/', authenticate, authorize(ROLES.ADMIN), CustomFieldController.attachToProject);
router.patch('/:fieldId', authenticate, authorize(ROLES.ADMIN), CustomFieldController.updateProjectField);
router.delete('/:fieldId', authenticate, authorize(ROLES.ADMIN), CustomFieldController.detachFromProject);

export default router;
