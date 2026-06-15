import {
  LayoutDashboard,
  Users,
  Contact,
  Star,
  ListChecks,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: Record<Role, NavItem[]> = {
  superadmin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/telecallers', label: 'Telecallers', icon: Users },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
  ],
  telecaller: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
  ],
};
