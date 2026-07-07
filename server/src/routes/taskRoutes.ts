import { Router } from 'express';
import * as ctrl from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';
import { resolveWorkspace, requireWorkspace } from '../middleware/workspace.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/taskValidators.js';

const router = Router();
router.use(authenticate, resolveWorkspace, requireWorkspace);

router.get('/', ctrl.listTasks);
router.post('/', requireRole('superadmin'), validate(createTaskSchema), ctrl.createTask);
router.get('/:id', ctrl.getTask);
router.put('/:id', requireRole('superadmin'), validate(updateTaskSchema), ctrl.updateTask);
router.patch('/:id/status', validate(updateTaskStatusSchema), ctrl.updateTaskStatus);
router.delete('/:id', requireRole('superadmin'), ctrl.deleteTask);

export default router;
