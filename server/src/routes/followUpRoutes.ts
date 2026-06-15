import { Router } from 'express';
import * as ctrl from '../controllers/followUpController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listFollowUps);
router.patch('/:id/done', ctrl.markFollowUpDone);

export default router;
