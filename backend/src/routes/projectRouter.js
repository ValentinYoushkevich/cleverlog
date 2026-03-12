import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { ProjectController } from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/', authenticate, ProjectController.list);
router.get('/:id', authenticate, ProjectController.getById);
router.post('/', authenticate, authorize(ROLES.ADMIN), ProjectController.create);
router.patch('/:id', authenticate, authorize(ROLES.ADMIN), ProjectController.update);

export default router;
