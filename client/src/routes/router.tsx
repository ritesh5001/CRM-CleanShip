import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, RoleRoute } from './guards';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TelecallersPage } from '@/pages/TelecallersPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { TasksPage } from '@/pages/TasksPage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/telecallers"
          element={
            <RoleRoute role="superadmin">
              <TelecallersPage />
            </RoleRoute>
          }
        />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/followups" element={<FollowUpsPage />} />
        <Route
          path="/integrations"
          element={
            <RoleRoute role="superadmin">
              <IntegrationsPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
