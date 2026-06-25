import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Phone, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { useCallConfig } from '@/api/calls';
import { useCallStore } from '@/store/call';
import { CallBar } from '@/features/calls/CallBar';
import { CallDispositionModal } from '@/features/calls/CallDispositionModal';
import { NAV } from './nav';
import { NotificationBell } from './NotificationBell';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const callingEnabled = useCallConfig().data?.enabled ?? false;
  const initDevice = useCallStore((s) => s.initDevice);

  // Warm up the Twilio softphone once we know calling is configured (no mic
  // prompt yet — that only happens on the first actual call).
  useEffect(() => {
    if (callingEnabled) void initDevice();
  }, [callingEnabled, initDevice]);

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const items = user ? NAV[user.role] : [];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className={`flex items-center py-4 ${collapsed ? 'justify-center px-2' : 'gap-2 px-5'}`}>
          <div className="rounded-lg bg-brand-600 p-1.5 text-white">
            <Phone size={18} />
          </div>
          {!collapsed && <span className="font-bold text-slate-800 dark:text-slate-100">CleanShip CRM</span>}
        </div>
        <nav className="flex-1 space-y-1 px-2 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center' : 'gap-3'
                } ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <item.icon size={18} />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 ${
            collapsed ? 'justify-center' : 'gap-3 px-5'
          }`}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && 'Collapse'}
        </button>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={`flex items-center py-4 text-sm font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 ${
            collapsed ? 'justify-center px-3' : 'gap-3 px-5'
          }`}
        >
          <LogOut size={18} /> {!collapsed && 'Log out'}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="md:hidden">
            <span className="font-bold text-slate-800 dark:text-slate-100">CleanShip CRM</span>
          </div>
          <div className="hidden text-sm text-slate-500 dark:text-slate-400 md:block">
            {user?.role === 'superadmin' ? 'Administrator' : 'User'} workspace
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <LogOut size={20} />
            Logout
          </button>
        </nav>
      </div>

      {/* Global Twilio softphone UI (no-op until a call is placed). */}
      <CallBar />
      <CallDispositionModal />
    </div>
  );
}
