import { Router } from 'express';
import * as ctrl from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authenticate);

router.get('/overview', requireRole('superadmin'), ctrl.overview);
router.get('/me', ctrl.myStats);

export default router;
