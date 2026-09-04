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
  Phone,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  /** Shorter label for the phone tab bar, where ~9 characters fit. */
  shortLabel?: string;
  icon: LucideIcon;
}

export const NAV: Record<Role, NavItem[]> = {
  superadmin: [
    { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
    { to: '/telecallers', label: 'Users', icon: Users },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/dialer', label: 'Dialer', icon: Phone },
    { to: '/recents', label: 'Recents', icon: PhoneCall },
    { to: '/device-test', label: 'Device Test', shortLabel: 'Devices', icon: Mic },
    { to: '/integrations', label: 'Integrations', shortLabel: 'Setup', icon: Plug },
  ],
  telecaller: [
    { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
    { to: '/contacts', label: 'Contacts', icon: Contact },
    { to: '/leads', label: 'Leads', icon: Star },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/dialer', label: 'Dialer', icon: Phone },
    { to: '/recents', label: 'Recents', icon: PhoneCall },
    { to: '/followups', label: 'Follow-ups', icon: CalendarClock },
    { to: '/device-test', label: 'Device Test', shortLabel: 'Devices', icon: Mic },
  ],
};

/**
 * The four routes that get their own tab in the phone tab bar. Nine tabs plus a
 * logout button does not fit across a phone — everything else lives one tap
 * away behind "More", which lists the *complete* nav, so nothing is lost.
 *
 * These are the screens each role opens many times a day: the admin assigns and
 * reviews work; the telecaller works their contacts, tasks and follow-ups.
 */
export const MOBILE_PRIMARY: Record<Role, string[]> = {
  superadmin: ['/', '/contacts', '/leads', '/tasks'],
  telecaller: ['/', '/contacts', '/tasks', '/followups'],
};
