import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  resetPasswordSchema,
  setStatusSchema,
  setTargetSchema,
  setTwilioNumberSchema,
  updateUserSchema,
} from '../validators/userValidators.js';

const router = Router();

// All telecaller management is superadmin-only.
router.use(authenticate, requireRole('superadmin'));

router.get('/', ctrl.listUsers);
router.post('/', validate(createUserSchema), ctrl.createUser);
router.get('/:id', ctrl.getUser);
router.put('/:id', validate(updateUserSchema), ctrl.updateUser);
router.delete('/:id', ctrl.deleteUser);
router.patch('/:id/status', validate(setStatusSchema), ctrl.setUserStatus);
router.patch('/:id/target', validate(setTargetSchema), ctrl.setUserTarget);
router.patch('/:id/twilio-number', validate(setTwilioNumberSchema), ctrl.setUserTwilioNumber);
router.patch('/:id/reset-password', validate(resetPasswordSchema), ctrl.resetUserPassword);

export default router;
