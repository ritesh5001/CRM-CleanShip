import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Phone } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NAV } from './nav';
import { NotificationBell } from './NotificationBell';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const items = user ? NAV[user.role] : [];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="rounded-lg bg-brand-600 p-1.5 text-white">
            <Phone size={18} />
          </div>
          <span className="font-bold text-slate-800">CleanShip CRM</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-5 py-4 text-sm font-medium text-slate-500 hover:text-rose-600"
        >
          <LogOut size={18} /> Log out
        </button>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="md:hidden">
            <span className="font-bold text-slate-800">CleanShip CRM</span>
          </div>
          <div className="hidden text-sm text-slate-500 md:block">
            {user?.role === 'superadmin' ? 'Administrator' : 'Telecaller'} workspace
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-700">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-200 bg-white md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  isActive ? 'text-brand-600' : 'text-slate-500'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500"
          >
            <LogOut size={20} />
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}
