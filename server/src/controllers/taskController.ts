import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { getPagination, paginated } from '../utils/pagination.js';
import { notify } from '../services/notificationService.js';
import { idOf } from '../utils/idOf.js';

function buildFilter(req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = { workspace: req.workspaceId };
  if (req.user!.role === 'telecaller') {
    filter.assignedTo = req.user!.id;
  } else if (typeof req.query.assignedTo === 'string' && req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo;
  }
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.priority === 'string' && req.query.priority) filter.priority = req.query.priority;
  return filter;
}

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const pg = getPagination(req.query);
  const filter = buildFilter(req);

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name')
      .populate('relatedLead', 'name phone')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(pg.skip)
      .limit(pg.limit),
    Task.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginated(tasks, total, pg) });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findOne({ _id: req.params.id, workspace: req.workspaceId })
    .populate('assignedTo', 'name email')
    .populate('relatedLead', 'name phone');
  if (!task) throw ApiError.notFound('Task not found');
  if (req.user!.role === 'telecaller' && idOf(task.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This task is not assigned to you');
  }
  res.json({ success: true, task });
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const assignee = await User.findOne({
    _id: req.body.assignedTo,
    role: 'telecaller',
    isActive: true,
    workspace: req.workspaceId,
  });
  if (!assignee) throw ApiError.badRequest('Invalid or inactive telecaller');

  const task = await Task.create({ ...req.body, assignedBy: req.user!.id, workspace: req.workspaceId });
  await notify({
    recipient: String(task.assignedTo),
    type: 'task_assigned',
    title: 'New task assigned',
    message: task.title,
    link: `/tasks/${task._id}`,
    workspace: req.workspaceId,
  });
  res.status(201).json({ success: true, task });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspaceId },
    { $set: req.body },
    { new: true }
  );
  if (!task) throw ApiError.notFound('Task not found');
  res.json({ success: true, task });
});

export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!task) throw ApiError.notFound('Task not found');

  // Telecallers can only update status of their own tasks.
  if (req.user!.role === 'telecaller' && String(task.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This task is not assigned to you');
  }

  task.status = req.body.status;
  task.completedAt = req.body.status === 'completed' ? new Date() : undefined;
  await task.save();

  // Notify the assigner when a telecaller completes a task.
  if (req.user!.role === 'telecaller' && req.body.status === 'completed') {
    await notify({
      recipient: String(task.assignedBy),
      type: 'task_updated',
      title: 'Task completed',
      message: `${req.user!.name} completed "${task.title}"`,
      link: `/tasks/${task._id}`,
      workspace: req.workspaceId,
    });
  }
  res.json({ success: true, task });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
  if (!task) throw ApiError.notFound('Task not found');
  res.json({ success: true, message: 'Task deleted' });
});
