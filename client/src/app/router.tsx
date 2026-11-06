import { createBrowserRouter } from 'react-router';
import { AuthLayout } from '../features/auth/AuthLayout';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { PublicOnly, RequireAuth } from '../features/auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ReportPage } from '../features/reports/ReportPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { CalendarPage } from '../features/training/CalendarPage';
import { HistoryPage } from '../features/training/HistoryPage';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  // Reachable with or without a session: the link comes from an email.
  {
    element: <AuthLayout />,
    children: [{ path: 'reset-password', element: <ResetPasswordPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'reports/:weekStart', element: <ReportPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
