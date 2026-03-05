import { Router } from 'express';
import { DirectoryController } from '../controllers/directory.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/departments', DirectoryController.listDepartments);

export default router;
