import { Router } from 'express';
import * as ctrl from '../controllers/integrationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { updateTwilioSchema } from '../validators/integrationValidators.js';

const router = Router();

// Integration settings are superadmin-only.
router.use(authenticate, requireRole('superadmin'));

router.get('/twilio', ctrl.getTwilioIntegration);
router.put('/twilio', validate(updateTwilioSchema), ctrl.updateTwilioIntegration);

export default router;
