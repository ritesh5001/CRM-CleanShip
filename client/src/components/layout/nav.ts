import {
  LayoutDashboard,
  Users,
  Contact,
  Star,
  ListChecks,
  CalendarClock,
  PhoneCall,
  Plug,
  Mic,
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
    { to: '/telecallers', label: 'Users', icon: Users },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/recents', label: 'Recents', icon: PhoneCall },
    { to: '/device-test', label: 'Device Test', icon: Mic },
    { to: '/integrations', label: 'Integrations', icon: Plug },
  ],
  telecaller: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/recents', label: 'Recents', icon: PhoneCall },
    { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
    { to: '/device-test', label: 'Device Test', icon: Mic },
  ],
};
