export type Role = 'superadmin' | 'telecaller';

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  dailyTarget: number;
  lastLoginAt?: string;
  createdAt: string;
}

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'interested'
  | 'callback'
  | 'not_interested'
  | 'converted'
  | 'dnd';

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  company?: string;
  city?: string;
  source?: string;
  tags?: string[];
  status: LeadStatus;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: User | string | null;
  assignedAt?: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
  createdAt: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  type: 'call' | 'follow_up' | 'custom';
  relatedLead?: Lead | string | null;
  assignedTo?: User | string;
  assignedBy?: User | string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
}

export type Disposition =
  | 'interested'
  | 'callback'
  | 'not_interested'
  | 'busy'
  | 'switched_off'
  | 'wrong_number'
  | 'dnd'
  | 'converted';

export interface CallLog {
  _id: string;
  lead: Lead | string;
  telecaller: User | string;
  disposition: Disposition;
  notes?: string;
  durationSec?: number;
  nextFollowUpAt?: string;
  createdAt: string;
}

export interface FollowUp {
  _id: string;
  lead: Lead | string;
  telecaller: User | string;
  scheduledAt: string;
  status: 'pending' | 'done' | 'missed';
  notes?: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}
