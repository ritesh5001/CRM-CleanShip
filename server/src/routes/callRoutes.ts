import { Router } from 'express';
import * as ctrl from '../controllers/callController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logCallSchema } from '../validators/callValidators.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listCalls);
router.post('/', validate(logCallSchema), ctrl.logCall);

export default router;
