import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import leadRoutes from './leadRoutes.js';
import taskRoutes from './taskRoutes.js';
import callRoutes from './callRoutes.js';
import followUpRoutes from './followUpRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import reportRoutes from './reportRoutes.js';
import integrationRoutes from './integrationRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/users', userRoutes);
router.use('/leads', leadRoutes);
router.use('/tasks', taskRoutes);
router.use('/calls', callRoutes);
router.use('/followups', followUpRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/integrations', integrationRoutes);

export default router;
