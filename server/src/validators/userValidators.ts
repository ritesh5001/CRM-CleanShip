import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  dailyTarget: z.number().int().min(0).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  dailyTarget: z.number().int().min(0).optional(),
});

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const setTargetSchema = z.object({
  dailyTarget: z.number().int().min(0),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
